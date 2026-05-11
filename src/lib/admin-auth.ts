/**
 * Tiny HMAC-signed cookie session, Edge-runtime safe (Web Crypto only).
 *
 * Env vars:
 *   ADMIN_PASSWORD         — plaintext compare against the submitted password
 *   ADMIN_SESSION_SECRET   — HMAC-SHA256 key for signing the session cookie
 *                            (generate: `openssl rand -hex 32`)
 *
 * Cookie format (single httpOnly cookie named "ba_admin"):
 *   <base64url-payload>.<base64url-signature>
 *   payload = JSON { v: 1, exp: <unix-seconds> }
 *
 * No DB. No external service. Single-user. Sessions last 7 days, with sliding
 * renewal each time the middleware sees a still-valid cookie within the last
 * 24h of its lifetime (handled in middleware.ts).
 */
const COOKIE_NAME = "ba_admin";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_TTL = SESSION_TTL_SECONDS;

type Payload = { v: 1; exp: number; ep: number };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return new Uint8Array(sig);
}

export async function createSessionCookie(
  secret: string,
  epoch: number,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: Payload = { v: 1, exp, ep: epoch };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = toBase64Url(await hmac(payloadB64, secret));
  return `${payloadB64}.${sig}`;
}

export async function verifySessionCookie(
  cookie: string | undefined,
  secret: string,
  currentEpoch: number,
): Promise<{ valid: true; exp: number; ep: number } | { valid: false }> {
  if (!cookie) return { valid: false };
  const [payloadB64, sigB64] = cookie.split(".");
  if (!payloadB64 || !sigB64) return { valid: false };
  const expectedSig = await hmac(payloadB64, secret);
  let givenSig: Uint8Array;
  try {
    givenSig = fromBase64Url(sigB64);
  } catch {
    return { valid: false };
  }
  if (!timingSafeEqual(expectedSig, givenSig)) return { valid: false };
  let payload: Payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
  } catch {
    return { valid: false };
  }
  if (
    payload.v !== 1 ||
    typeof payload.exp !== "number" ||
    typeof payload.ep !== "number"
  ) {
    return { valid: false };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return { valid: false };
  // Logout / "kick everyone" check.
  if (payload.ep < currentEpoch) return { valid: false };
  return { valid: true, exp: payload.exp, ep: payload.ep };
}

/**
 * Standard JSON error response for admin API routes. Always returns the
 * same shape — `{ error: <code>, message: <human-readable> }` — so the
 * client only has to look in one place.
 */
export function adminError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error: code, message, ...(extra ?? {}) }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

/** Constant-time string compare (fine for short equal-length passwords). */
export function passwordsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  return timingSafeEqual(ae, be);
}

/**
 * Server-side guard for admin pages. Belt-and-suspenders alongside middleware:
 * if anything ever causes the matcher to miss a path, the page itself still
 * refuses to render unauthorized content.
 */
export async function requireAdmin(): Promise<void> {
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { getAdminEpoch } = await import("./admin-epoch");
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    redirect("/admin/login");
    return;
  }
  const [cookieJar, epoch] = await Promise.all([cookies(), getAdminEpoch()]);
  const cookie = cookieJar.get(ADMIN_COOKIE)?.value;
  const result = await verifySessionCookie(cookie, secret, epoch);
  if (!result.valid) redirect("/admin/login");
}

/**
 * API-route guard. Returns a 401 Response if the request is not authenticated
 * OR if the Origin header is not the same as the request host (basic CSRF
 * defense). Returns null when the request is good — caller should continue.
 *
 * Pattern in routes:
 *   const guard = await assertAdminApi(req);
 *   if (guard) return guard;
 */
export async function assertAdminApi(req: Request): Promise<Response | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return adminError(
      "admin-not-configured",
      "ADMIN_SESSION_SECRET is not set on the server.",
      503,
    );
  }
  // CSRF: any mutating verb must come from the same origin.
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host) {
      return adminError(
        "missing-origin",
        "Request is missing the Origin or Host header.",
        400,
      );
    }
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return adminError("bad-origin", "Origin header is not a valid URL.", 400);
    }
    if (originHost !== host) {
      return adminError(
        "cross-origin-blocked",
        "Cross-origin admin requests are not allowed.",
        403,
      );
    }
  }
  const { cookies } = await import("next/headers");
  const { getAdminEpoch } = await import("./admin-epoch");
  const [cookieJar, epoch] = await Promise.all([cookies(), getAdminEpoch()]);
  const cookie = cookieJar.get(ADMIN_COOKIE)?.value;
  const result = await verifySessionCookie(cookie, secret, epoch);
  if (!result.valid) {
    return adminError(
      "unauthorized",
      "Session is missing, expired, or revoked. Sign in again.",
      401,
    );
  }
  return null;
}
