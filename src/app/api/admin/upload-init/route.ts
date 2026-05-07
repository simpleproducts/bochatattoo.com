import { NextResponse } from "next/server";
import {
  originalKey,
  presignPut,
  shortId,
  slugify,
} from "@/lib/r2";
import { assertAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
]);

function extFromContentType(ct: string): string {
  switch (ct) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/tiff":
      return "tiff";
    default:
      return "jpg";
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  let body: { filename?: string; contentType?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { filename, contentType, category } = body;
  if (!filename || !contentType) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "unsupported-type", contentType },
      { status: 415 },
    );
  }

  const cat = category ? slugify(category) : "uncategorized";
  const base = slugify(filename.replace(/\.[^.]+$/, "")) || "image";
  const slug = `${cat}-${base}-${shortId()}`;
  const ext = extFromContentType(contentType);
  const key = originalKey(slug, ext);

  try {
    const putUrl = await presignPut(key, contentType, 600);
    return NextResponse.json({ slug, key, ext, category: cat, putUrl });
  } catch (err) {
    return NextResponse.json(
      { error: "presign-failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
