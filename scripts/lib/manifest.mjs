import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const MANIFEST_PATH = fileURLToPath(new URL("../../manifest.json", import.meta.url));

export const LICENSES = { cc0: "CC0-1.0", "cc-by": "CC-BY-4.0" };
const SPDX = new Set(Object.values(LICENSES));

export const SIZES = ["full", "preview", "thumb"];
export const artworkKey = (id, size) => `artworks/${id}/${size}.jpg`;

export async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
}

export async function writeManifest(manifest) {
  manifest.items.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id));
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

/** Minúsculas, sin acentos, solo [a-z0-9-]. */
export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Devuelve la lista de problemas del manifest (vacía si es válido). */
export function validateManifest(manifest) {
  const problems = [];
  if (manifest.version !== 1) problems.push(`version debe ser 1 (es ${manifest.version})`);
  if (!Array.isArray(manifest.items)) return [...problems, "items debe ser un arreglo"];
  const seen = new Set();
  for (const [i, it] of manifest.items.entries()) {
    const where = `items[${i}]${it?.id ? ` (${it.id})` : ""}`;
    for (const field of ["id", "title", "author", "license", "addedAt"]) {
      if (typeof it[field] !== "string" || !it[field].trim()) problems.push(`${where}: falta ${field}`);
    }
    if (!Number.isInteger(it.width) || !Number.isInteger(it.height)) problems.push(`${where}: width/height inválidos`);
    if (it.license && !SPDX.has(it.license)) problems.push(`${where}: licencia desconocida ${it.license}`);
    if (it.tags && !Array.isArray(it.tags)) problems.push(`${where}: tags debe ser un arreglo`);
    if (it.authorUrl && !/^https?:\/\//.test(it.authorUrl)) problems.push(`${where}: authorUrl debe empezar con http(s)://`);
    if (it.id && seen.has(it.id)) problems.push(`${where}: id duplicado`);
    seen.add(it.id);
  }
  return problems;
}
