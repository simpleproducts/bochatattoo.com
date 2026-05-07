import { NextResponse } from "next/server";
import {
  bustImagesCache,
  deleteKey,
  getBytes,
  headObject,
  loadManifest,
  originalKey,
  putBytes,
  saveManifest,
  variantKey,
} from "@/lib/r2";
import { processImage } from "@/lib/process-image";
import type { ImageEntry } from "@/lib/images-types";
import { assertAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "heic",
  "heif",
  "tiff",
]);
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  let body: { slug?: string; ext?: string; category?: string; alt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { slug, ext, category, alt } = body;
  if (!slug || !ext) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }
  if (!SLUG_RE.test(slug) || slug.length > 120) {
    return NextResponse.json({ error: "bad-slug" }, { status: 400 });
  }
  if (!ALLOWED_EXT.has(ext.toLowerCase())) {
    return NextResponse.json({ error: "bad-ext" }, { status: 400 });
  }

  const manifest = await loadManifest();
  if (manifest.images[slug]) {
    return NextResponse.json({ error: "slug-taken" }, { status: 409 });
  }

  const key = originalKey(slug, ext.toLowerCase());

  // Best-effort cleanup helper — delete the original we just refused so we
  // don't leave orphans in R2.
  const cleanup = async () => {
    try {
      await deleteKey(key);
    } catch (err) {
      console.error(`finalize: failed to delete ${key}`, err);
    }
  };

  // Server-side size enforcement. Browser-side check is also in place but
  // never trust the client.
  const head = await headObject(key);
  if (!head) {
    return NextResponse.json(
      { error: "original-not-found" },
      { status: 404 },
    );
  }
  if (head.contentLength > MAX_BYTES) {
    await cleanup();
    return NextResponse.json(
      {
        error: "too-large",
        size: head.contentLength,
        max: MAX_BYTES,
      },
      { status: 413 },
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await getBytes(key);
  } catch (err) {
    await cleanup();
    return NextResponse.json(
      { error: "fetch-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  let processed;
  try {
    processed = await processImage(bytes, alt || slug.replace(/-/g, " "));
  } catch (err) {
    await cleanup();
    return NextResponse.json(
      { error: "process-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  try {
    await Promise.all(
      processed.variants.map((v) =>
        putBytes(
          variantKey(slug, v.width, v.ext),
          v.bytes,
          CONTENT_TYPES[v.ext] ?? "application/octet-stream",
        ),
      ),
    );
  } catch (err) {
    // Best-effort: also try to clean up any variants we partially uploaded.
    await Promise.allSettled([
      cleanup(),
      ...processed.variants.map((v) =>
        deleteKey(variantKey(slug, v.width, v.ext)).catch(() => undefined),
      ),
    ]);
    return NextResponse.json(
      { error: "variant-upload-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  const entry: ImageEntry = {
    ...processed.entry,
    category: category || undefined,
    createdAt: new Date().toISOString(),
  };
  manifest.images[slug] = entry;
  await saveManifest(manifest);
  bustImagesCache();

  // Variants are uploaded and the manifest entry is committed — we don't
  // need the original anymore. Best-effort delete; an orphan won't break
  // the site, just costs a few cents in R2 storage.
  try {
    await deleteKey(key);
  } catch (err) {
    console.error(`finalize: failed to delete original ${key}`, err);
  }

  return NextResponse.json({ ok: true, slug, entry });
}
