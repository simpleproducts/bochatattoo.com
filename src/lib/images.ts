import manifest from "@/data/images.json";
import { HIDDEN_SLUGS } from "@/data/hidden-slugs";

export type ImageEntry = {
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** Pre-rendered widths in pixels, ascending. */
  sizes: number[];
  /** Optional file extension override; defaults to "avif". */
  format?: "avif" | "webp" | "jpg";
  /** Top-level source folder slug (e.g. "best-tattoos", "animales"). */
  category?: string;
};

export type ImageManifest = Record<string, ImageEntry>;
export type ImageWithSlug = { slug: string } & ImageEntry;

const MANIFEST = manifest as ImageManifest;
const HIDDEN = new Set(HIDDEN_SLUGS);

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

export function isHidden(slug: string): boolean {
  return HIDDEN.has(slug);
}

export function getImage(slug: string): ImageEntry | undefined {
  if (HIDDEN.has(slug)) return undefined;
  return MANIFEST[slug];
}

export function listImages(): ImageWithSlug[] {
  return Object.entries(MANIFEST)
    .filter(([slug]) => !HIDDEN.has(slug))
    .map(([slug, entry]) => ({ slug, ...entry }));
}

export function listImagesByCategory(category: string): ImageWithSlug[] {
  return listImages()
    .filter((i) => i.category === category)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [slug, entry] of Object.entries(MANIFEST)) {
    if (HIDDEN.has(slug) || !entry.category) continue;
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  }
  return counts;
}

export function pickSize(sizes: number[], requested: number): number {
  for (const w of sizes) if (w >= requested) return w;
  return sizes[sizes.length - 1];
}

export function imageUrl(slug: string, width: number, format = "avif"): string {
  return `${BASE}/${slug}-${width}.${format}`;
}

/** Bin a width/height pair into a coarse aspect-ratio bucket for tile grids. */
export function ratioBucket(
  width: number,
  height: number,
): "tall" | "portrait" | "square" | "landscape" {
  const r = width / height;
  if (r < 0.7) return "tall";
  if (r < 0.95) return "portrait";
  if (r < 1.15) return "square";
  return "landscape";
}
