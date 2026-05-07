#!/usr/bin/env node
/**
 * One-time migration: bootstrap manifest.json + categories.json on R2 from
 * the current bundled data. Safe to re-run — overwrites both files.
 *
 *   pnpm tsx scripts/migrate-to-r2.mjs    (or `node` if you don't use tsx)
 *
 * Reads:
 *   - src/data/images.json                (legacy flat manifest)
 *   - src/data/hidden-slugs.ts            (TS file, parsed as text)
 *
 * Writes to R2:
 *   - manifest.json                       (new shape: { version, images, featuredSlugs })
 *   - categories.json                     ({ version, categories: [...] })
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

// Tiny env loader (.env then .env.local override).
async function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const value = m[2].replace(/^['"]|['"]$/g, "");
      if (file === ".env.local" || !process.env[m[1]]) {
        process.env[m[1]] = value;
      }
    }
  }
}

const FEATURED_SLUGS = [
  "tarot-img-5127",
  "retratos-img-5967",
  "retratos-img-4109",
  "random-img-5994",
  "playmobil-img-3626",
  "personas-img-2108",
  "personas-img-1596",
  "peliculas-img-5044",
  "musica-img-6186",
  "musica-img-5292",
  "flashes-img-2094",
  "compo-img-6495",
  "compo-img-5146",
  "compo-img-4830",
  "compo-img-3597",
  "botanica-img-4779",
  "botanica-img-4353",
  "botanica-img-3359",
];

const CATEGORY_ORDER = [
  "animales",
  "botanica",
  "retratos",
  "personas",
  "peliculas",
  "musica",
  "arte",
  "antiguedad",
  "anatom",
  "autos",
  "comida",
  "tarot",
  "argentina",
  "playmobil",
  "minis",
  "flashes",
  "dibujos",
  "compo",
  "ig2024",
  "best-tattoos",
  "random",
];

const LABELS_ES = {
  animales: "Animales",
  botanica: "Botánica",
  retratos: "Retratos",
  personas: "Personas",
  peliculas: "Películas",
  musica: "Música",
  arte: "Arte",
  antiguedad: "Antigüedad",
  anatom: "Anatomía",
  autos: "Autos",
  comida: "Comida",
  tarot: "Tarot",
  argentina: "Argentina",
  playmobil: "Playmobil",
  minis: "Minis",
  flashes: "Flashes",
  dibujos: "Dibujos",
  "best-tattoos": "Destacados",
  compo: "Composiciones",
  ig2024: "Varios",
  random: "Random",
};

const LABELS_EN = {
  animales: "Animals",
  botanica: "Botanical",
  retratos: "Portraits",
  personas: "People",
  peliculas: "Films",
  musica: "Music",
  arte: "Art",
  antiguedad: "Antiquity",
  anatom: "Anatomy",
  autos: "Cars",
  comida: "Food",
  tarot: "Tarot",
  argentina: "Argentina",
  playmobil: "Playmobil",
  minis: "Minis",
  flashes: "Flash",
  dibujos: "Drawings",
  "best-tattoos": "Featured",
  compo: "Compositions",
  ig2024: "Miscellaneous",
  random: "Random",
};

async function readHiddenSlugs() {
  const path = "src/data/hidden-slugs.ts";
  if (!existsSync(path)) return new Set();
  const text = await readFile(path, "utf8");
  const matches = text.match(/"([^"]+)"/g) ?? [];
  return new Set(matches.map((m) => m.slice(1, -1)));
}

async function main() {
  await loadEnv();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error("Missing R2 credentials. See .env.example.");
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

  // 1) categories.json
  const categories = CATEGORY_ORDER.map((slug, i) => ({
    slug,
    labels: { es: LABELS_ES[slug] ?? slug, en: LABELS_EN[slug] ?? slug },
    order: i,
    hidden: false,
  }));
  const categoriesData = { version: 1, categories };

  // 2) manifest.json
  const legacy = JSON.parse(
    await readFile("src/data/images.json", "utf8").catch(() => "{}"),
  );
  const hidden = await readHiddenSlugs();
  const images = {};
  for (const [slug, entry] of Object.entries(legacy)) {
    images[slug] = {
      ...entry,
      hidden: hidden.has(slug) || undefined,
    };
  }
  const manifest = {
    version: 1,
    images,
    featuredSlugs: FEATURED_SLUGS,
  };

  for (const [key, body] of [
    ["categories.json", categoriesData],
    ["manifest.json", manifest],
  ]) {
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: JSON.stringify(body, null, 2),
        ContentType: "application/json",
        CacheControl: "public, max-age=30, must-revalidate",
      }),
    );
    console.log(`↑ ${key}`);
  }

  console.log(
    `\nManifest: ${Object.keys(images).length} images, ${FEATURED_SLUGS.length} featured.`,
  );
  console.log(`Categories: ${categories.length}.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
