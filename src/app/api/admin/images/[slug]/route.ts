import { NextResponse } from "next/server";
import {
  bustImagesCache,
  deleteKey,
  loadManifest,
  saveManifest,
  variantKey,
} from "@/lib/r2";
import { assertAdminApi } from "@/lib/admin-auth";
import type { ImagesManifest } from "@/lib/images-types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

async function safeLoadManifest(): Promise<
  { ok: true; manifest: ImagesManifest } | { ok: false; response: Response }
> {
  try {
    const manifest = await loadManifest();
    return { ok: true, manifest };
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "manifest-load-failed",
          message: (err as Error).message,
        },
        { status: 500 },
      ),
    };
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
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

  const loaded = await safeLoadManifest();
  if (!loaded.ok) return loaded.response;
  const manifest = loaded.manifest;

  const entry = manifest.images[slug];
  if (!entry) {
    return NextResponse.json(
      {
        error: "not-found",
        message: `Slug "${slug}" is not in the live manifest. Refresh and try again.`,
        manifestSize: Object.keys(manifest.images).length,
      },
      { status: 404 },
    );
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
  try {
    await saveManifest(manifest);
  } catch (err) {
    return NextResponse.json(
      { error: "manifest-save-failed", message: (err as Error).message },
      { status: 500 },
    );
  }
  bustImagesCache();
  return NextResponse.json({ ok: true, slug, entry });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { slug } = await ctx.params;

  const loaded = await safeLoadManifest();
  if (!loaded.ok) return loaded.response;
  const manifest = loaded.manifest;

  const entry = manifest.images[slug];
  if (!entry) {
    return NextResponse.json(
      {
        error: "not-found",
        message: `Slug "${slug}" is not in the live manifest.`,
      },
      { status: 404 },
    );
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
  try {
    await saveManifest(manifest);
  } catch (err) {
    return NextResponse.json(
      { error: "manifest-save-failed", message: (err as Error).message },
      { status: 500 },
    );
  }
  bustImagesCache();
  return NextResponse.json({ ok: true, slug });
}
