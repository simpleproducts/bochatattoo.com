import "server-only";
import { cache } from "react";
import type {
  CategoriesData,
  ImagesData,
  ImagesManifest,
} from "./images-types";

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

const EMPTY_MANIFEST: ImagesManifest = {
  version: 1,
  images: {},
  featuredSlugs: [],
};

const EMPTY_CATEGORIES: CategoriesData = {
  version: 1,
  categories: [],
};

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/${path}`, {
      next: { tags: ["images"], revalidate: 3600 },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/**
 * Server-only fetcher for the live manifest + categories. Cached per-request
 * via React `cache` and across requests via Next's data cache (tag: 'images').
 * Admin write-paths call revalidateTag('images') to invalidate.
 */
export const getImagesData = cache(async (): Promise<ImagesData> => {
  const [manifest, categoriesData] = await Promise.all([
    fetchJson<ImagesManifest>("manifest.json", EMPTY_MANIFEST),
    fetchJson<CategoriesData>("categories.json", EMPTY_CATEGORIES),
  ]);
  return { manifest, categoriesData };
});
