// Uso: pnpm artwork:remove <id>
// Borra las imágenes de la obra en R2 y la quita del manifest.json local.
// Después ejecuta `pnpm manifest:publish` para que deje de aparecer en Wallflow.

import { SIZES, artworkKey, readManifest, writeManifest } from "./lib/manifest.mjs";
import { assertEnv, deleteObjects } from "./lib/r2.mjs";

const id = process.argv[2];
if (!id) {
  console.error("✗ Falta el id. Uso: pnpm artwork:remove <id>");
  process.exit(1);
}

assertEnv();
const manifest = await readManifest();
const inManifest = manifest.items.some((it) => it.id === id);

await deleteObjects(SIZES.map((size) => artworkKey(id, size)));

if (inManifest) {
  manifest.items = manifest.items.filter((it) => it.id !== id);
  await writeManifest(manifest);
  console.log(`✓ ${id} borrada de R2 y quitada del manifest.`);
} else {
  console.log(`✓ Imágenes de ${id} borradas de R2 (no estaba en el manifest).`);
}
console.log("  Ejecuta `pnpm manifest:publish` para que el cambio llegue a Wallflow.");
