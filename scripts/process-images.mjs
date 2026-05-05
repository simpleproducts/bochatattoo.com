#!/usr/bin/env node
/**
 * Walks a source directory recursively, resizes every image to AVIF + WebP at
 * 640/1280/2560 widths, and rewrites src/data/images.json with dimensions and
 * a tiny blurDataURL for each slug.
 *
 * Usage:
 *   pnpm images:process                       # default source: ./raw-images
 *   pnpm images:process public/images/tattoos # custom source dir
 *
 * Slug = `${parent-folder-chain}-${filename}`, lowercased and hyphenated.
 * Outputs land in /processed-images. Idempotent — safe to re-run; existing
 * variants are overwritten and the manifest preserves any human-edited `alt`.
 */
import { readdir, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse, relative, sep } from "node:path";
import sharp from "sharp";

const SOURCE = process.argv[2] || "raw-images";
const OUT_DIR = "processed-images";
const MANIFEST = "src/data/images.json";
const WIDTHS = [640, 1280, 2560];
const FORMATS = [
  { ext: "avif", options: { quality: 55, effort: 4 } },
  { ext: "webp", options: { quality: 75 } },
];
const IMAGE_RE = /\.(jpe?g|png|tiff?|webp|avif|heic)$/i;
const SKIP_DIR = new Set([".git", "node_modules", ".next", ".DS_Store"]);

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIR.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
      yield full;
    }
  }
}

async function blurPlaceholder(input) {
  const buf = await sharp(input).resize(16).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Source directory not found: ${SOURCE}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const existing = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{}"));
  const manifest = { ...existing };

  const files = [];
  for await (const f of walk(SOURCE)) files.push(f);
  if (files.length === 0) {
    console.log(`No source images found under ${SOURCE}/.`);
    return;
  }

  console.log(`Found ${files.length} image(s) under ${SOURCE}/`);

  async function flush() {
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  }

  let done = 0;
  let skipped = 0;
  let processed = 0;
  for (const src of files) {
    const rel = relative(SOURCE, src);
    const { name } = parse(rel);
    const dirParts = rel.split(sep).slice(0, -1);
    const slug = slugify([...dirParts, name].join("-"));
    const category = dirParts.length > 0 ? slugify(dirParts[0]) : "uncategorized";

    let meta;
    try {
      meta = await sharp(src).metadata();
    } catch (err) {
      console.warn(`Skipping ${rel} — could not read (${err.message})`);
      done++;
      continue;
    }
    const intrinsicW = meta.width ?? 0;
    const intrinsicH = meta.height ?? 0;
    if (!intrinsicW || !intrinsicH) {
      console.warn(`Skipping ${rel} — no dimensions`);
      done++;
      continue;
    }

    const sizes = WIDTHS.filter((w) => w <= intrinsicW);
    if (sizes.length === 0) sizes.push(intrinsicW);

    // Resume support: if the manifest already has this entry AND every expected
    // variant exists on disk, skip the (expensive) re-encode.
    const allVariantsExist = sizes.every((w) =>
      FORMATS.every(({ ext }) => existsSync(join(OUT_DIR, `${slug}-${w}.${ext}`))),
    );
    if (manifest[slug] && allVariantsExist) {
      skipped++;
      done++;
      continue;
    }

    for (const width of sizes) {
      const height = Math.round((width / intrinsicW) * intrinsicH);
      for (const { ext, options } of FORMATS) {
        const out = join(OUT_DIR, `${slug}-${width}.${ext}`);
        try {
          await sharp(src)
            .rotate() // honor EXIF orientation
            .resize({ width, height, fit: "inside" })
            [ext](options)
            .toFile(out);
        } catch (err) {
          console.warn(`Failed ${rel} → ${out}: ${err.message}`);
        }
      }
    }

    manifest[slug] = {
      alt: existing[slug]?.alt ?? slug.replace(/-/g, " "),
      width: intrinsicW,
      height: intrinsicH,
      blurDataURL: await blurPlaceholder(src),
      sizes,
      format: "avif",
      category,
    };

    processed++;
    done++;
    // Checkpoint every 25 fresh entries so an interrupt doesn't lose progress.
    if (processed % 25 === 0) {
      await flush();
      console.log(`  ${done}/${files.length} (processed ${processed}, skipped ${skipped})`);
    }
  }

  await flush();
  console.log(`\nManifest: ${MANIFEST} (${Object.keys(manifest).length} entries)`);
  console.log(`Processed ${processed}, skipped ${skipped} (already done).`);
  console.log(`Variants: ${OUT_DIR}/  →  upload with \`pnpm images:upload\``);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
