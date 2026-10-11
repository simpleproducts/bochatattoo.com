import "server-only";
import { cache } from "react";
import {
  EMPTY_CATEGORIES,
  EMPTY_MANIFEST,
  type CategoriesData,
  type ImageEntry,
  type ImagesData,
  type ImagesManifest,
} from "./images-types";

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/${path}`, {
      // Tag-based invalidation is the ONLY mechanism — every admin write
      // calls revalidateTag('images'), which wipes this entry instantly.
      //
      // WHY no TTL: every public page renders through this fetch, so its
      // revalidate becomes the revalidate of every ISR page on the site. A
      // 300s TTL re-rendered ~54 pages every 5 minutes, each writing ~1MB of
      // HTML + RSC (the whole manifest ships to the client), and burned
      // ~460k Vercel ISR write units a month on a manifest that had not
      // changed since May. The stale-CDN race the TTL guarded against is
      // closed at the source: r2.ts writes the manifest with `no-cache`.
      cache: "force-cache",
      next: { tags: ["images"] },
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
 * The slice of the manifest one public page actually renders, for its
 * ImagesProvider.
 *
 * WHY per page and not once in the layout: whatever the provider receives is
 * serialized into that page's HTML and RSC payload. The whole manifest is
 * ~290KB (blur placeholders included), so shipping it from the layout put it
 * on every page — guest-spot pages that show no images at all, a home strip
 * that shows twelve — and made every ISR write and read that much heavier.
 *
 * Hidden pieces are dropped here rather than flagged: every public consumer
 * filters them out anyway, so leaving them out is the same render with fewer
 * bytes. Categories and featuredSlugs are tiny and stay whole — the archive
 * needs hidden categories to keep their images out of its "tail".
 */
export function pickImages(
  data: ImagesData,
  slugs: Iterable<string>,
): ImagesData {
  const images: Record<string, ImageEntry> = {};
  for (const slug of slugs) {
    const entry = data.manifest.images[slug];
    if (entry && !entry.hidden) images[slug] = entry;
  }
  return {
    manifest: { ...data.manifest, images },
    categoriesData: data.categoriesData,
  };
}

/** Every visible piece — for /work, the one page that shows the whole archive. */
export async function getArchiveImagesData(): Promise<ImagesData> {
  const data = await getImagesData();
  return pickImages(data, Object.keys(data.manifest.images));
}

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
