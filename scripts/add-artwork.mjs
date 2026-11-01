// Uso:
//   pnpm artwork:add <archivo> --title "…" --author "…" --license cc0|cc-by [--url https://…] [--tags a,b] [--date AAAA-MM-DD] [--dry-run]
//
// Valida la obra contra LINEAMIENTOS.md, genera full/preview/thumb sin metadatos, los sube a R2
// y agrega la entrada al manifest.json local. No publica: después ejecuta `pnpm manifest:publish`.
// Con --dry-run guarda las imágenes en .out/<id>/ y no sube ni modifica nada.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { LICENSES, artworkKey, readManifest, slugify, writeManifest } from "./lib/manifest.mjs";
import { IMMUTABLE, assertEnv, publicUrl, putObject } from "./lib/r2.mjs";

// Mismos mínimos que la fuente del Art Institute en Wallflow (src/sources/artic.ts).
const MIN_WIDTH = 2560;
const MIN_HEIGHT = 1440;
const MIN_RATIO = 1.3;
const FORMATS = new Set(["jpeg", "png"]);

const RENDITIONS = {
  full: { resize: { width: 5120, height: 5120, fit: "inside", withoutEnlargement: true }, quality: 90 },
  preview: { resize: { width: 1280 }, quality: 85 },
  thumb: { resize: { width: 400 }, quality: 80 },
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

let opts, positionals;
try {
  ({ values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: "string" },
      author: { type: "string" },
      license: { type: "string" },
      url: { type: "string" },
      tags: { type: "string" },
      date: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  }));
} catch (err) {
  fail(err.message);
}

const file = positionals[0];
if (!file) fail("Falta el archivo. Uso: pnpm artwork:add <archivo> --title … --author … --license cc0|cc-by");
const title = opts.title?.trim();
const author = opts.author?.trim();
if (!title) fail("Falta --title");
if (!author) fail("Falta --author");
const license = LICENSES[opts.license?.toLowerCase()];
if (!license) fail(`--license debe ser cc0 o cc-by (recibido: ${opts.license ?? "nada"})`);
if (opts.url && !/^https?:\/\//.test(opts.url)) fail("--url debe empezar con http:// o https://");
const addedAt = opts.date ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(addedAt)) fail("--date debe tener el formato AAAA-MM-DD");
if (!opts["dry-run"]) {
  try {
    assertEnv();
  } catch (err) {
    fail(`${err.message}. Para validar sin subir, usa --dry-run.`);
  }
}
const tags = [...new Set((opts.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];

// --- Validación contra los lineamientos ---
let meta;
try {
  meta = await sharp(file).metadata();
} catch (err) {
  fail(`No se pudo leer la imagen (${err.message})`);
}
if (!FORMATS.has(meta.format)) fail(`Formato ${meta.format?.toUpperCase() ?? "desconocido"} no admitido: solo JPG o PNG`);
if ((meta.pages ?? 1) > 1) fail("Las imágenes animadas no se admiten");

// Dimensiones tal como se ven (la orientación EXIF 5–8 intercambia ancho y alto).
const rotated = (meta.orientation ?? 1) >= 5;
const width = rotated ? meta.height : meta.width;
const height = rotated ? meta.width : meta.height;
const ratio = width / height;

if (width < height) fail(`La obra es vertical (${width}×${height}); debe ser horizontal`);
if (width < MIN_WIDTH || height < MIN_HEIGHT) {
  fail(`Resolución ${width}×${height} insuficiente: el mínimo es ${MIN_WIDTH}×${MIN_HEIGHT}`);
}
if (ratio < MIN_RATIO) fail(`Proporción ${ratio.toFixed(2)} demasiado cuadrada: el mínimo es ${MIN_RATIO} (16:9 = 1.78)`);

// --- Id único ---
const id = slugify(`${title} ${author}`);
if (!id) fail("No se pudo generar un id a partir del título y el autor");
const manifest = await readManifest();
if (manifest.items.some((it) => it.id === id)) {
  fail(`Ya existe una obra con id «${id}». Si es otra obra, usa un título distinto.`);
}

// --- Generar tamaños (sRGB, sin EXIF ni otros metadatos) ---
const outputs = {};
for (const [size, r] of Object.entries(RENDITIONS)) {
  const { data, info } = await sharp(file)
    .rotate()
    .resize(r.resize)
    .toColourspace("srgb")
    .withIccProfile("srgb")
    .jpeg({ quality: r.quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  outputs[size] = { data, info };
}

const entry = {
  id,
  title,
  author,
  ...(opts.url ? { authorUrl: opts.url } : {}),
  license,
  tags,
  width: outputs.full.info.width,
  height: outputs.full.info.height,
  addedAt,
};

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
for (const [size, { data, info }] of Object.entries(outputs)) {
  console.log(`  ${size.padEnd(7)} ${info.width}×${info.height}  ${mb(data.length)}`);
}

if (opts["dry-run"]) {
  const dir = join(".out", id);
  await mkdir(dir, { recursive: true });
  for (const [size, { data }] of Object.entries(outputs)) await writeFile(join(dir, `${size}.jpg`), data);
  console.log(`\n✓ Válida (simulación). Imágenes en ${dir}/. Entrada que se agregaría:`);
  console.log(JSON.stringify(entry, null, 2));
  process.exit(0);
}

// --- Subir a R2 (thumb al final: publish usa su existencia como comprobación) ---
for (const size of ["full", "preview", "thumb"]) {
  const key = artworkKey(id, size);
  try {
    await putObject(key, outputs[size].data, "image/jpeg", IMMUTABLE);
  } catch (err) {
    fail(`Falló la subida de ${key}: ${err.message}. El manifest no se modificó; puedes reintentar.`);
  }
}

manifest.items.push(entry);
await writeManifest(manifest);

console.log(`\n✓ «${title}» de ${author} subida como ${id}`);
console.log(`  ${publicUrl(artworkKey(id, "thumb"))}`);
console.log("  Revisa el diff de manifest.json y ejecuta `pnpm manifest:publish` para que aparezca en Wallflow.");
