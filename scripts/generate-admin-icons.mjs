#!/usr/bin/env node
/**
 * Renders the PWA icon set for the ADMIN app (not the public site) by
 * compositing public/logo/logo-white.png onto the brand background colour.
 *
 * Usage:
 *   node scripts/generate-admin-icons.mjs            # default out: public/icons
 *   node scripts/generate-admin-icons.mjs public/foo # custom out dir
 *
 * Why this exists at all, rather than reusing src/app/icon.png:
 *   - src/app/{icon,apple-icon}.png are the PUBLIC marketing site's favicons.
 *     They are 32px and 180px and are wired into every route by Next's
 *     file-based metadata convention. Installing an app needs 192/512 plus a
 *     maskable variant, and it needs them at a URL middleware does not guard.
 *   - logo-white.png is a WHITE mark on transparency. Handed to Android or iOS
 *     as-is it is flattened onto white and disappears. Every icon here is
 *     therefore baked opaque against --color-bg before it is written.
 *
 * Outputs land in `public/`, deliberately: middleware guards /admin and
 * /api/admin, and the browser fetches manifest icons WITHOUT the session
 * cookie's context mattering — an icon behind the guard would 302 to the login
 * page and the install would silently fail.
 *
 * Idempotent — safe to re-run; existing files are overwritten.
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE = "public/logo/logo-white.png";
const OUT_DIR = process.argv[2] || "public/icons";
const CSS_PATH = "src/app/globals.css";
const FALLBACK_BG = "#0a0a0a";

/**
 * `coverage` is the fraction of the canvas edge the logo's longest side may
 * occupy. The three values are not taste, they are three different masks:
 *
 *  - any (0.76)      Android draws these inside its own container with a small
 *                    inset, so a normal app-icon margin is all it needs.
 *  - maskable (0.62) The spec guarantees only the middle 80% CIRCLE survives an
 *                    aggressive mask. The mark is 1274x1594 (ratio 0.80), so a
 *                    box of side s has diagonal s*sqrt(1+0.8^2) = 1.28s; for
 *                    that to fit a circle of diameter 0.8 the box must be
 *                    <= 0.625 of the canvas. 0.62 clears it with room to spare.
 *                    Undershooting here costs a little size; overshooting
 *                    clips the logo on a circular launcher and cannot be
 *                    fixed from CSS.
 *  - apple (0.70)    iOS applies a fixed squircle that bites ~10% off each
 *                    corner and adds no inset of its own, so the mark needs
 *                    more margin than the Android "any" case but less than a
 *                    full circular mask.
 */
const TARGETS = [
  { file: "admin-icon-192.png", size: 192, coverage: 0.76 },
  { file: "admin-icon-512.png", size: 512, coverage: 0.76 },
  { file: "admin-icon-maskable-192.png", size: 192, coverage: 0.62 },
  { file: "admin-icon-maskable-512.png", size: 512, coverage: 0.62 },
  { file: "admin-apple-touch-icon.png", size: 180, coverage: 0.7 },
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Read --color-bg out of the @theme block rather than hardcoding a second copy.
 * The icon, the manifest's background_color and the app's own background have
 * to be the same colour or the install shows a seam between the splash screen
 * and the first paint; one of the three drifting is exactly the kind of thing
 * nobody notices until it ships.
 */
async function brandBackground() {
  const css = await readFile(CSS_PATH, "utf8").catch(() => "");
  const match = css.match(/--color-bg:\s*(#[0-9a-fA-F]{3,6})\s*;/);
  if (!match) {
    console.warn(
      `Could not find --color-bg in ${CSS_PATH} — falling back to ${FALLBACK_BG}`,
    );
    return { hex: FALLBACK_BG, ...hexToRgb(FALLBACK_BG) };
  }
  return { hex: match[1].toLowerCase(), ...hexToRgb(match[1]) };
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Source logo not found: ${SOURCE}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const bg = await brandBackground();
  console.log(`Brand background: ${bg.hex} (from ${CSS_PATH})`);

  // The white mark sits inside a large transparent square. Trim to its real
  // bounding box first, so "62% of the canvas" means 62% of the LOGO and not of
  // whatever padding happened to be baked into the source file.
  const { data: mark, info: markInfo } = await sharp(SOURCE)
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  console.log(
    `Source: ${SOURCE} → trimmed mark ${markInfo.width}x${markInfo.height}`,
  );

  for (const { file, size, coverage } of TARGETS) {
    const inner = Math.round(size * coverage);
    const logo = await sharp(mark)
      .resize({ width: inner, height: inner, fit: "inside" })
      .png()
      .toBuffer();

    const out = join(OUT_DIR, file);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
      },
    })
      .composite([{ input: logo, gravity: "centre" }])
      // Opaque on purpose. A maskable icon with transparent corners defeats the
      // mask, and iOS composites an alpha apple-touch-icon onto black without
      // asking — so drop the channel rather than leave it to the platform.
      .removeAlpha()
      .png({ compressionLevel: 9, palette: true })
      .toFile(out);

    const { size: bytes } = await stat(out);
    console.log(`  ${out}  ${size}x${size}  ${(bytes / 1024).toFixed(1)} KB`);
  }

  console.log(`\nWrote ${TARGETS.length} icon(s) to ${OUT_DIR}/`);
  console.log(
    "Referenced by public/manifest.webmanifest and src/app/admin/layout.tsx.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
