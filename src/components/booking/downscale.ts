/**
 * Browser-side receipt downscale, run before the file ever leaves the device.
 *
 * This exists so a 12 MB phone photo fits under the 4 MB proxy limit the
 * receipt route enforces, and it strips EXIF/GPS as a free side effect — a
 * receipt photo should not carry the client's home coordinates.
 *
 * No `server-only`: this is browser-only code, imported by ReceiptUploader.
 * It NEVER throws and never rejects a file. Anything it cannot decode (a PDF,
 * a HEIC on a browser with no HEIC decoder, a corrupt JPEG) falls through
 * untouched so the upload still happens and the server — the only party that
 * sniffs magic bytes — decides whether to accept it.
 */
import {
  IMAGE_DOWNSCALE_MAX_EDGE,
  IMAGE_DOWNSCALE_QUALITY,
} from "@/lib/bookings-types";

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Closes the bitmap or revokes the object URL. Called after drawImage. */
  release: () => void;
};

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function downscaleImage(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

  const decoded = await decode(file);
  if (!decoded) return file;

  try {
    // A zero-dimension decode (some SVGs, some broken files) would make the
    // scale factor Infinity, so bail before the arithmetic.
    if (decoded.width <= 0 || decoded.height <= 0) return file;

    const scale = Math.min(
      1,
      IMAGE_DOWNSCALE_MAX_EDGE / Math.max(decoded.width, decoded.height),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob = await encode(canvas, "image/webp");
    // A browser that cannot encode webp either returns null or silently hands
    // back the spec's PNG fallback — which for a photograph is heavier than
    // the original. Either way, retry as JPEG.
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg");
    if (!blob) return file;

    const ext = EXT_BY_TYPE[blob.type];
    if (!ext) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    decoded.release();
  }
}

async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Not fatal: iOS rejects bitmaps over its pixel ceiling and older Safari
      // rejects HEIC here, both of which the <img> path may still handle.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // The URL has to outlive drawImage, so revoking is the release step.
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, IMAGE_DOWNSCALE_QUALITY);
  });
}
