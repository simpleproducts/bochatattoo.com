import { NextResponse } from "next/server";
import {
  bustImagesCache,
  getBytes,
  loadManifest,
  putBytes,
  saveManifest,
  variantKey,
} from "@/lib/r2";
import { processImage } from "@/lib/process-image";
import type { ImageEntry } from "@/lib/images-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
};

export async function POST(req: Request) {
  let body: { slug?: string; key?: string; category?: string; alt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { slug, key, category, alt } = body;
  if (!slug || !key) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

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

  const manifest = await loadManifest();
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
