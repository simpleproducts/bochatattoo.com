import { NextResponse } from "next/server";
import {
  bustImagesCache,
  loadCategories,
  loadManifest,
  saveCategories,
} from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  let body: {
    labels?: { es?: string; en?: string };
    order?: number;
    hidden?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const data = await loadCategories();
  const entry = data.categories.find((c) => c.slug === slug);
  if (!entry) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  if (body.labels) {
    if (typeof body.labels.es === "string") entry.labels.es = body.labels.es;
    if (typeof body.labels.en === "string") entry.labels.en = body.labels.en;
  }
  if (typeof body.order === "number") entry.order = body.order;
  if (typeof body.hidden === "boolean") entry.hidden = body.hidden;

  await saveCategories(data);
  bustImagesCache();
  return NextResponse.json({ ok: true, category: entry });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const manifest = await loadManifest();
  const inUse = Object.values(manifest.images).some((e) => e.category === slug);
  if (inUse) {
    return NextResponse.json(
      { error: "in-use", message: "Move or delete the images in this category first." },
      { status: 409 },
    );
  }
  const data = await loadCategories();
  data.categories = data.categories.filter((c) => c.slug !== slug);
  await saveCategories(data);
  bustImagesCache();
  return NextResponse.json({ ok: true });
}
