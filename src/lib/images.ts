/**
 * Pure helpers for image URLs and bucketing. The actual manifest is loaded
 * server-side via images-store.ts and provided to client components through
 * ImagesProvider. This module deliberately stays free of manifest reads.
 */
import type { ImageFormat } from "./images-types";

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

export function imageUrl(
  slug: string,
  width: number,
  format: ImageFormat | string = "avif",
): string {
  return `${BASE}/${slug}-${width}.${format}`;
}

export function pickSize(sizes: number[], requested: number): number {
  for (const w of sizes) if (w >= requested) return w;
  return sizes[sizes.length - 1];
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
