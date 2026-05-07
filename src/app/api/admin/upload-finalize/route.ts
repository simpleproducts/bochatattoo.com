import { NextResponse } from "next/server";
import {
  bustImagesCache,
  getBytes,
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
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "tiff"]);

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
  // Reject slugs that could escape the bucket prefix or look like paths.
  if (!SLUG_RE.test(slug) || slug.length > 120) {
    return NextResponse.json({ error: "bad-slug" }, { status: 400 });
  }
  if (!ALLOWED_EXT.has(ext.toLowerCase())) {
    return NextResponse.json({ error: "bad-ext" }, { status: 400 });
  }

  // Reject overwrites — a finalize call must register a new entry, never
  // clobber an existing one (collision is exceedingly rare given the random
  // suffix, but treat it as an error so we don't lose data).
  const manifest = await loadManifest();
  if (manifest.images[slug]) {
    return NextResponse.json({ error: "slug-taken" }, { status: 409 });
  }

  // Re-derive the originals key server-side. Never trust a client-supplied key.
  const key = originalKey(slug, ext.toLowerCase());

  let bytes: Uint8Array;
  try {
    bytes = await getBytes(key);
  } catch (err) {
    return NextResponse.json(
      { error: "original-not-found", message: (err as Error).message },
      { status: 404 },
    );
  }

  let processed;
  try {
    processed = await processImage(
      bytes,
      alt || slug.replace(/-/g, " "),
    );
  } catch (err) {
    return NextResponse.json(
      { error: "process-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  // Upload variants in parallel — IO bound.
  await Promise.all(
    processed.variants.map((v) =>
      putBytes(
        variantKey(slug, v.width, v.ext),
        v.bytes,
        CONTENT_TYPES[v.ext] ?? "application/octet-stream",
      ),
    ),
  );

  const entry: ImageEntry = {
    ...processed.entry,
    category: category || undefined,
    createdAt: new Date().toISOString(),
  };
  manifest.images[slug] = entry;
  await saveManifest(manifest);
  bustImagesCache();

  return NextResponse.json({ ok: true, slug, entry });
}
