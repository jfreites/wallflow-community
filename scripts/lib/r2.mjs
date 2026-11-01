import { S3Client, PutObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

export const IMMUTABLE = "public, max-age=31536000, immutable";
export const MANIFEST_CACHE = "public, max-age=60";

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

let client;

// Errores legibles en la terminal, sin stack trace.
process.on("uncaughtException", (err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});

export function assertEnv() {
  env();
}

function env() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Faltan variables en .env: ${missing.join(", ")} (copia .env.example a .env y complétalo)`);
  }
  return process.env;
}

function s3() {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
    });
  }
  return client;
}

const bucket = () => env().R2_BUCKET;

export async function putObject(key, body, contentType, cacheControl) {
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }),
  );
}

export async function exists(key) {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function deleteObjects(keys) {
  if (!keys.length) return;
  const res = await s3().send(
    new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
  );
  if (res.Errors?.length) {
    throw new Error(`No se pudieron borrar: ${res.Errors.map((e) => `${e.Key} (${e.Message})`).join(", ")}`);
  }
}

export function publicUrl(key) {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : key;
}
