import manifest from "@/data/images.json";

export type ImageEntry = {
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** Pre-rendered widths in pixels, ascending. */
  sizes: number[];
  /** Optional file extension override; defaults to "avif". */
  format?: "avif" | "webp" | "jpg";
};

export type ImageManifest = Record<string, ImageEntry>;

const MANIFEST = manifest as ImageManifest;

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

export function getImage(slug: string): ImageEntry | undefined {
  return MANIFEST[slug];
}

export function listImages(): Array<{ slug: string } & ImageEntry> {
  return Object.entries(MANIFEST).map(([slug, entry]) => ({ slug, ...entry }));
}

/** Pick the smallest pre-rendered width that satisfies the requested width. */
export function pickSize(sizes: number[], requested: number): number {
  for (const w of sizes) if (w >= requested) return w;
  return sizes[sizes.length - 1];
}

export function imageUrl(slug: string, width: number, format = "avif"): string {
  return `${BASE}/${slug}-${width}.${format}`;
}
