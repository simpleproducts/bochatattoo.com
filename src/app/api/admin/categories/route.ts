import { NextResponse } from "next/server";
import {
  bustImagesCache,
  loadCategories,
  saveCategories,
  slugify,
} from "@/lib/r2";
import type { CategoryEntry } from "@/lib/images-types";

export const runtime = "nodejs";

export async function GET() {
  const data = await loadCategories();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  let body: {
    slug?: string;
    labels?: { es?: string; en?: string };
    order?: number;
    hidden?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const slug = slugify(body.slug ?? "");
  if (!slug) {
    return NextResponse.json({ error: "missing-slug" }, { status: 400 });
  }
  const labelEs = body.labels?.es?.trim() ?? "";
  const labelEn = body.labels?.en?.trim() ?? "";
  if (!labelEs && !labelEn) {
    return NextResponse.json({ error: "missing-labels" }, { status: 400 });
  }

  const data = await loadCategories();
  if (data.categories.some((c) => c.slug === slug)) {
    return NextResponse.json({ error: "already-exists" }, { status: 409 });
  }

  const order =
    typeof body.order === "number"
      ? body.order
      : (data.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1);

  const entry: CategoryEntry = {
    slug,
    labels: { es: labelEs || labelEn, en: labelEn || labelEs },
    order,
    hidden: Boolean(body.hidden),
  };
  data.categories.push(entry);
  await saveCategories(data);
  bustImagesCache();
  return NextResponse.json({ ok: true, category: entry });
}

export async function PUT(req: Request) {
  // Replace the entire ordered list. Useful for drag-to-reorder UI.
  let body: { categories?: CategoryEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!Array.isArray(body.categories)) {
    return NextResponse.json({ error: "missing-categories" }, { status: 400 });
  }
  const next = {
    version: 1 as const,
    categories: body.categories.map((c, i) => ({
      slug: slugify(c.slug),
      labels: {
        es: c.labels?.es ?? "",
        en: c.labels?.en ?? "",
      },
      order: typeof c.order === "number" ? c.order : i,
      hidden: Boolean(c.hidden),
    })),
  };
  await saveCategories(next);
  bustImagesCache();
  return NextResponse.json({ ok: true });
}
