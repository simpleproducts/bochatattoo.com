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
      // Short revalidate so admin edits show up on the public site within
      // ~60s even if the bustImagesCache → revalidateTag path doesn't fully
      // propagate (e.g. CDN in front of Vercel). The tag is still the
      // primary invalidation mechanism — admin actions wipe it instantly.
      next: { tags: ["images"], revalidate: 60 },
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
