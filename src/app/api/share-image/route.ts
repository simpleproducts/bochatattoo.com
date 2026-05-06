import { NextResponse } from "next/server";
import sharp from "sharp";
import { getImage, imageUrl } from "@/lib/images";

export const runtime = "nodejs";

/**
 * Same-origin image proxy used by the lightbox Share button. Two purposes:
 *
 *  1. R2's public bucket doesn't return CORS headers, so a direct browser
 *     fetch is opaque and useless for the File / Web Share APIs. Proxying
 *     server-side gives us readable bytes.
 *  2. The bucket serves AVIF / WebP, which Instagram (and most other story
 *     destinations) refuse to treat as photos — the share sheet falls back
 *     to sharing the link instead. We transcode to JPEG here so the OS and
 *     Instagram recognise it as a real image to post.
 *
 * Only slugs present in the manifest are accepted, so this can't be turned
 * into a generic open proxy.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  if (!slug) {
    return NextResponse.json({ error: "missing-slug" }, { status: 400 });
  }
  const entry = getImage(slug);
  if (!entry) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const width = entry.sizes[entry.sizes.length - 1];
  const remote = imageUrl(slug, width, entry.format ?? "avif");

  const upstream = await fetch(remote);
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
  const input = Buffer.from(await upstream.arrayBuffer());

  let jpeg: Buffer;
  try {
    jpeg = await sharp(input)
      .rotate() // honour EXIF orientation if any
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "transcode-failed" }, { status: 500 });
  }

  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(jpeg.byteLength),
      "content-disposition": `inline; filename="bocha-${slug}.jpg"`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
