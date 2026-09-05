/**
 * Magic-byte sniffing for uploaded payment receipts.
 *
 * The client's declared content type is deliberately NOT a parameter of this
 * function and is consulted nowhere in the upload path: `File.type` and the
 * multipart part header are attacker-controlled, while the value returned here
 * is what gets stored on the record and later echoed back verbatim as the
 * `Content-Type` of the admin receipt route. Only the real leading bytes decide.
 *
 * Pure and dependency-free — no `server-only`, no I/O, and no decoding: nothing
 * on the booking path ever hands untrusted bytes to an image library.
 */
import type { ReceiptContentType, ReceiptExt } from "./bookings-types";

export type SniffedReceipt = { contentType: ReceiptContentType; ext: ReceiptExt };

/**
 * ISO-BMFF major brands that mean HEIC/HEIF. iPhones shoot these by default,
 * no browser renders them, and transcoding would mean decoding untrusted bytes
 * on the server — so they are matched explicitly and then rejected, rather than
 * falling through, so a future reader can see the omission was a decision.
 */
const HEIF_BRANDS = new Set([
  "heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1",
]);

function matches(b: Uint8Array, signature: number[], offset = 0): boolean {
  if (b.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (b[offset + i] !== signature[i]) return false;
  }
  return true;
}

function ascii(b: Uint8Array, offset: number, length: number): string {
  if (b.length < offset + length) return "";
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(b[offset + i]);
  return s;
}

/** `null` means "we will not store this" — the route answers 415 unsupported-type. */
export function sniffReceipt(b: Uint8Array): SniffedReceipt | null {
  // "%PDF-"
  if (matches(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { contentType: "application/pdf", ext: "pdf" };
  }
  // JPEG SOI + first marker
  if (matches(b, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  // PNG 8-byte signature
  if (matches(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", ext: "png" };
  }
  // RIFF container whose form type is WEBP — the size field sits between them.
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }
  // HEIC/HEIF: recognised, then refused. The client is told to send a screenshot.
  if (ascii(b, 4, 4) === "ftyp" && HEIF_BRANDS.has(ascii(b, 8, 4))) {
    return null;
  }
  return null;
}
