import "server-only";
import sharp from "sharp";
import type { ImageEntry } from "./images-types";

const WIDTHS: number[] = [640, 1280, 2560];

const FORMATS = [
  { ext: "avif" as const, options: { quality: 55, effort: 4 } },
  { ext: "webp" as const, options: { quality: 75 } },
];

export type ProcessedVariant = {
  width: number;
  ext: "avif" | "webp";
  bytes: Uint8Array;
};

export type ProcessedImage = {
  variants: ProcessedVariant[];
  entry: Pick<
    ImageEntry,
    "alt" | "width" | "height" | "blurDataURL" | "sizes" | "format"
  >;
};

async function blurPlaceholder(input: Buffer): Promise<string> {
  const buf = await sharp(input)
    .resize(16)
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

export async function processImage(
  input: Buffer | Uint8Array,
  alt: string,
): Promise<ProcessedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const meta = await sharp(buf).metadata();
  const intrinsicW = meta.width ?? 0;
  const intrinsicH = meta.height ?? 0;
  if (!intrinsicW || !intrinsicH) {
    throw new Error("Could not read image dimensions");
  }

  const sizes = WIDTHS.filter((w) => w <= intrinsicW);
  if (sizes.length === 0) sizes.push(intrinsicW);

  const variants: ProcessedVariant[] = [];
  for (const width of sizes) {
    const height = Math.round((width / intrinsicW) * intrinsicH);
    for (const { ext, options } of FORMATS) {
      const out = await sharp(buf)
        .rotate()
        .resize({ width, height, fit: "inside" })
        [ext](options)
        .toBuffer();
      variants.push({ width, ext, bytes: new Uint8Array(out) });
    }
  }

  const blurDataURL = await blurPlaceholder(buf);

  return {
    variants,
    entry: {
      alt,
      width: intrinsicW,
      height: intrinsicH,
      blurDataURL,
      sizes: [...sizes],
      format: "avif",
    },
  };
}
