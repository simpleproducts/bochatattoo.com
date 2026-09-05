/**
 * Web Crypto primitives for the booking link scheme.
 *
 * Edge-safe by construction: no Node built-ins, no `server-only`, nothing that
 * pulls in the S3 SDK — so this module is importable from any runtime.
 *
 * `toBase64Url`, `fromBase64Url` and `timingSafeEqual` are deliberate verbatim
 * copies of the private helpers in src/lib/admin-auth.ts, NOT imports. That
 * file is loaded by middleware.ts on the Edge runtime and guards every admin
 * request; the project has no test suite that would catch a regression in it,
 * so the bookings feature duplicates six lines rather than refactor the module
 * holding the door shut. The dependency must never be created in either
 * direction: admin-auth.ts does not import from here, and this file does not
 * import from admin-auth.ts.
 */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * crypto.subtle takes a `BufferSource`, which TypeScript's generic typed arrays
 * narrow to `ArrayBufferView<ArrayBuffer> | ArrayBuffer` — a plain `Uint8Array`
 * (backed by `ArrayBufferLike`) does not satisfy it. Copying into a fresh
 * ArrayBuffer keeps every call site cast-free, and detaches the bytes from
 * whatever pooled or shared buffer they arrived in.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Full 32-byte HMAC-SHA256, base64url. Callers truncate; this never does. */
export async function hmacBase64Url(message: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(sig));
}

/** Lowercase hex SHA-256. Used to content-address receipt blobs. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  const out = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, "0");
  return hex;
}

/** CSPRNG bytes as base64url. 16 bytes → 22 chars, which is what BOOKING_ID_RE expects. */
export function randomBase64Url(nBytes: number): string {
  const bytes = new Uint8Array(nBytes);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}
