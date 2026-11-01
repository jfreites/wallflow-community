// Uso: pnpm manifest:publish
// Valida manifest.json, comprueba que cada obra tenga sus imágenes en R2 y lo sube.

import { artworkKey, readManifest, validateManifest, writeManifest } from "./lib/manifest.mjs";
import { MANIFEST_CACHE, assertEnv, exists, publicUrl, putObject } from "./lib/r2.mjs";

assertEnv();
const manifest = await readManifest();
const problems = validateManifest(manifest);
if (problems.length) {
  console.error("✗ El manifest tiene problemas:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

const missing = [];
for (const it of manifest.items) {
  if (!(await exists(artworkKey(it.id, "thumb")))) missing.push(it.id);
}
if (missing.length) {
  console.error(`✗ Estas obras no tienen imágenes en R2: ${missing.join(", ")}`);
  console.error("  Vuelve a subirlas con `pnpm artwork:add` o quítalas del manifest.");
  process.exit(1);
}

manifest.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
manifest.items.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id));
await putObject("manifest.json", JSON.stringify(manifest), "application/json", MANIFEST_CACHE);
await writeManifest(manifest);

console.log(`✓ Manifest publicado con ${manifest.items.length} obra(s): ${publicUrl("manifest.json")}`);
console.log("  No olvides hacer commit y push de manifest.json.");
