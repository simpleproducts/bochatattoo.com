import { NextResponse } from "next/server";
import { bustImagesCache, loadManifest, saveManifest } from "@/lib/r2";
import { assertAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  let body: { featuredSlugs?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!Array.isArray(body.featuredSlugs)) {
    return NextResponse.json({ error: "missing-featured" }, { status: 400 });
  }

  const manifest = await loadManifest();
  // Drop any slugs that no longer exist in the manifest.
  manifest.featuredSlugs = body.featuredSlugs.filter(
    (slug) => Boolean(manifest.images[slug]),
  );
  await saveManifest(manifest);
  bustImagesCache();
  return NextResponse.json({ ok: true, featuredSlugs: manifest.featuredSlugs });
}
