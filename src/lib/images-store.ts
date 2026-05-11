import "server-only";
import { cache } from "react";
import {
  EMPTY_CATEGORIES,
  EMPTY_MANIFEST,
  type CategoriesData,
  type ImagesData,
  type ImagesManifest,
} from "./images-types";

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/${path}`, {
      // Tag-based invalidation is the primary mechanism — every admin write
      // calls revalidateTag('images'), which wipes this entry instantly.
      // The TTL is just a safety net for cases where the tag invalidation
      // doesn't fully propagate (e.g., a CDN sitting in front of Vercel).
      // 5 minutes is a reasonable balance between freshness and R2 GET cost.
      next: { tags: ["images"], revalidate: 300 },
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

/**
 * Always-fresh variant for the admin dashboard. Bypasses Next's data cache
 * and CDN caching by reading from R2 directly via the S3 SDK. Use only on
 * pages that already opt into dynamic rendering (e.g. /admin/page.tsx).
 */
export const getImagesDataFresh = cache(async (): Promise<ImagesData> => {
  // Lazy-import so the bundle for non-admin routes doesn't pull the S3 SDK.
  const { loadManifest, loadCategories } = await import("./r2");
  try {
    const [manifest, categoriesData] = await Promise.all([
      loadManifest(),
      loadCategories(),
    ]);
    return { manifest, categoriesData };
  } catch {
    // If R2 creds are missing on the server, fall back to the cached path so
    // the admin page still renders (the user will see the empty/stale view
    // and any subsequent action surfaces the real error).
    return getImagesData();
  }
});
