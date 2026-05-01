#!/usr/bin/env node
/**
 * Reads originals from /raw-images, writes resized AVIF + WebP variants to
 * /processed-images, and rewrites src/data/images.json with dimensions and
 * a tiny blurDataURL for each slug. Idempotent — safe to re-run.
 *
 * Naming: each output file is `<slug>-<width>.<ext>`. The slug is the original
 * filename without extension, lowercased and hyphenated.
 */
import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const RAW_DIR = "raw-images";
const OUT_DIR = "processed-images";
const MANIFEST = "src/data/images.json";
const WIDTHS = [640, 1280, 2560];
const FORMATS = [
  { ext: "avif", options: { quality: 55, effort: 4 } },
  { ext: "webp", options: { quality: 75 } },
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function blurPlaceholder(input) {
  const buf = await sharp(input)
    .resize(16)
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR}/ directory. Drop originals there and re-run.`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const existing = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{}"));
  const manifest = { ...existing };

  const files = (await readdir(RAW_DIR)).filter((f) =>
    /\.(jpe?g|png|tiff?|webp|avif)$/i.test(f),
  );

  if (files.length === 0) {
    console.log(`No source images in ${RAW_DIR}/.`);
    return;
  }

  for (const file of files) {
    const slug = slugify(parse(file).name);
    const src = join(RAW_DIR, file);
    const meta = await sharp(src).metadata();
    const intrinsicWidth = meta.width ?? 0;
    const intrinsicHeight = meta.height ?? 0;

    if (!intrinsicWidth || !intrinsicHeight) {
      console.warn(`Skipping ${file} — could not read dimensions.`);
      continue;
    }

    const sizes = WIDTHS.filter((w) => w <= intrinsicWidth);
    if (sizes.length === 0) sizes.push(intrinsicWidth);

    for (const width of sizes) {
      const height = Math.round((width / intrinsicWidth) * intrinsicHeight);
      for (const { ext, options } of FORMATS) {
        const out = join(OUT_DIR, `${slug}-${width}.${ext}`);
        const pipeline = sharp(src).resize({ width, height, fit: "inside" });
        await pipeline[ext](options).toFile(out);
      }
    }

    manifest[slug] = {
      alt: existing[slug]?.alt ?? slug.replace(/-/g, " "),
      width: intrinsicWidth,
      height: intrinsicHeight,
      blurDataURL: await blurPlaceholder(src),
      sizes,
      format: "avif",
    };

    console.log(`✓ ${slug} (${sizes.join(", ")})`);
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nManifest written: ${MANIFEST}`);
  console.log(`Variants in: ${OUT_DIR}/  →  upload with \`pnpm images:upload\`.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
