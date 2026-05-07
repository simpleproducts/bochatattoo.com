import { NextResponse } from "next/server";
import {
  bustImagesCache,
  deleteKey,
  loadManifest,
  saveManifest,
  variantKey,
} from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  let body: {
    category?: string | null;
    alt?: string;
    hidden?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const manifest = await loadManifest();
  const entry = manifest.images[slug];
  if (!entry) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  if (body.category !== undefined) {
    entry.category = body.category || undefined;
  }
  if (body.alt !== undefined) {
    entry.alt = body.alt;
  }
  if (body.hidden !== undefined) {
    entry.hidden = Boolean(body.hidden);
  }

  manifest.images[slug] = entry;
  await saveManifest(manifest);
  bustImagesCache();
  return NextResponse.json({ ok: true, slug, entry });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const manifest = await loadManifest();
  const entry = manifest.images[slug];
  if (!entry) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  // Best-effort variant cleanup. We don't fail the request on individual
  // delete errors — R2 might already be missing some variants.
  const formats: ("avif" | "webp")[] = ["avif", "webp"];
  await Promise.allSettled(
    entry.sizes.flatMap((w) =>
      formats.map((f) => deleteKey(variantKey(slug, w, f))),
    ),
  );

  delete manifest.images[slug];
  // Also drop from featured if present.
  manifest.featuredSlugs = manifest.featuredSlugs.filter((s) => s !== slug);
  await saveManifest(manifest);
  bustImagesCache();
  return NextResponse.json({ ok: true, slug });
}
