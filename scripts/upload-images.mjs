#!/usr/bin/env node
/**
 * Syncs /processed-images to a Cloudflare R2 bucket. Skips files whose
 * size already matches the remote object. Reads creds from .env.local.
 */
import { readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const OUT_DIR = "processed-images";

// Tiny .env.local loader so this script doesn't require a Next.js context.
async function loadEnv() {
  if (!existsSync(".env.local")) return;
  const text = await readFile(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const CONTENT_TYPES = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

async function main() {
  await loadEnv();

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error("Missing R2 credentials. See .env.example.");
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) {
    console.error(`No ${OUT_DIR}/ directory. Run \`pnpm images:process\` first.`);
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const files = await readdir(OUT_DIR);
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const path = join(OUT_DIR, file);
    const local = await stat(path);
    const ext = file.split(".").pop()?.toLowerCase() ?? "";

    let needsUpload = true;
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: R2_BUCKET, Key: file }),
      );
      if (head.ContentLength === local.size) needsUpload = false;
    } catch {
      // 404 → upload
    }

    if (!needsUpload) {
      skipped++;
      continue;
    }

    const body = await readFile(path);
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: file,
        Body: body,
        ContentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded++;
    console.log(`↑ ${file}`);
  }

  console.log(`\nUploaded ${uploaded}, skipped ${skipped} (already in sync).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
