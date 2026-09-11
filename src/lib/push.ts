/**
 * The Web Push transport: one VAPID-signed, EMPTY POST to a push service, and
 * the fan-out that sends it to every device the admin has opted in from.
 *
 * ── NO PAYLOAD, AND WHAT THAT BUYS ───────────────────────────────────────────
 * The message this module sends carries no body at all. RFC 8291 payload
 * encryption (ECDH against the subscription's p256dh, HKDF, AES128GCM, a
 * 103-byte header) is the other half of every push library, and skipping it
 * buys three things:
 *
 *   - NO BOOKING DATA EVER TRAVERSES APPLE'S OR GOOGLE'S INFRASTRUCTURE. Not a
 *     client's name, not an amount, not a time. The push service learns that
 *     *something* happened and nothing else. An encrypted payload would be
 *     opaque to them too, in theory — but only for as long as the encryption is
 *     right, and it is not the kind of code that tells you when it is wrong.
 *   - THERE IS NO ENCRYPTION CODE HERE TO GET SUBTLY WRONG. A mistake in an
 *     HKDF info string does not throw; it produces a message the browser
 *     silently discards, and the symptom is a phone that quietly stops buzzing.
 *   - THE SERVICE WORKER IS FORCED TO READ LIVE STATE. It wakes on a
 *     contentless message, fetches /api/admin/push/summary with the admin's own
 *     cookie, and builds the notification from what is true right now — not from
 *     what was true when the message was queued, possibly hours earlier.
 *
 * ── VAPID IS THE PART THAT MUST BE RIGHT (RFC 8292) ──────────────────────────
 * A P-256 ECDSA key pair identifies this server to the push service. Each send
 * carries:
 *
 *     Authorization: vapid t=<JWT>, k=<base64url raw public key>
 *
 * where the JWT is ES256 over { aud, exp, sub }, and:
 *
 *   - `aud` IS THE ORIGIN OF THE SUBSCRIPTION ENDPOINT, not the whole URL. A
 *     token minted for https://web.push.apple.com is rejected by
 *     https://fcm.googleapis.com, so the audience differs per SUBSCRIBER —
 *     which is exactly why the token is signed per send rather than once and
 *     cached. Signing is sub-millisecond; a cache keyed wrong is a 403 nobody
 *     would connect to the cause.
 *   - `exp` is 12 hours out. The spec's ceiling is 24; half of it leaves room
 *     for a server whose clock is a few minutes fast, which is otherwise an
 *     instant rejection.
 *   - `sub` is a `mailto:` or `https:` contact the push service operator can
 *     reach if this server starts misbehaving. A bare email address is the
 *     mistake everyone makes and is normalised below rather than refused.
 *
 * THE SIGNATURE FORMAT IS THE ONE TRAP. JOSE's ES256 signature is the raw
 * 64-byte r||s concatenation. Node's webcrypto ECDSA sign already returns
 * exactly that — it is NOT DER, and DER-encoding it (which is what you get by
 * reaching for node:crypto's Sign class instead) produces a token every push
 * service refuses. Nothing in this file touches DER, and nothing should.
 *
 * ── NOTHING HERE EVER THROWS AT ITS CALLER ───────────────────────────────────
 * Both exported send functions return rather than throw, and the reason is the
 * same one the email layer has: the caller is always a request whose record has
 * ALREADY COMMITTED — a client's receipt upload, or a MercadoPago webhook — and
 * a notification that failed must never turn a confirmed booking into a 500 the
 * client reads as "your comprobante did not upload". `pushConfigured()` exists
 * so callers can check rather than catch.
 */
import "server-only";
import { fromBase64Url, toBase64Url } from "./booking-crypto";
import { listPushSubscriptions, prunePushSubscriptions } from "./push-store";
import { PUSH_TTL_SECONDS, type PushSendResult } from "./push-types";

/**
 * How long one POST to a push service may take. Generous enough for Apple's
 * gateway on a bad minute, short enough that a fan-out cannot eat a meaningful
 * slice of the 30-second budget the confirmation path runs in.
 */
const PUSH_TIMEOUT_MS = 8_000;

/** JWT lifetime. RFC 8292 caps it at 24h; half of that absorbs clock skew. */
const JWT_TTL_SECONDS = 12 * 60 * 60;

/** A push service's error body is for the log, not for a response. Bound it. */
const ERROR_BODY_MAX = 200;

/* ────────────────────────── configuration ────────────────────────── */

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Warned at most once per process, so a misconfiguration is visible but not a firehose. */
let warnedAboutSubject = false;

/**
 * The `sub` claim: a contact the push service operator can reach. Returns "" —
 * which reads as "not configured" — for anything that is not a usable one.
 *
 * A bare `bocha@example.com` is normalised to `mailto:bocha@example.com`
 * instead of being refused, because it is the overwhelmingly common way to fill
 * this variable in and the intent is unambiguous. Anything else that is neither
 * mailto: nor https: is REFUSED rather than guessed at: a push service answers
 * a bad `sub` with a 403, on every send, forever, and "the phone stopped
 * buzzing" is not a symptom anyone traces back to an env var. Better to have
 * the feature report itself as off.
 */
function vapidSubject(): string {
  const raw = env("VAPID_SUBJECT");
  if (!raw) return "";
  if (raw.startsWith("mailto:") || raw.startsWith("https://")) return raw;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) return `mailto:${raw}`;
  if (!warnedAboutSubject) {
    warnedAboutSubject = true;
    console.error(
      "push: VAPID_SUBJECT must be a mailto: or https: URL (or a bare email " +
        "address) — push notifications are disabled until it is.",
    );
  }
  return "";
}

/**
 * Whether this deploy can send a push at all. Every caller CHECKS this rather
 * than catching a failure, so an unconfigured deploy does no work and logs
 * nothing: the feature is simply off, and the admin UI says so.
 *
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY is deliberately NOT part of this. That variable
 * is what lets a browser subscribe; these three are what let the server send.
 * A deploy missing only the public one has no subscriptions to send to, so this
 * returning true there costs nothing and keeps the two gates honest about which
 * half is broken.
 */
export function pushConfigured(): boolean {
  return Boolean(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY") && vapidSubject());
}

/* ────────────────────────── signing ────────────────────────── */

/**
 * crypto.subtle takes a `BufferSource`, which TypeScript's generic typed arrays
 * narrow to `ArrayBufferView<ArrayBuffer> | ArrayBuffer` — a plain `Uint8Array`
 * (backed by `ArrayBufferLike`) does not satisfy it. A verbatim copy of the
 * private helper in booking-crypto.ts, for the same reason it is private there.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

/**
 * The imported private key, cached across sends in one process.
 *
 * Keyed on the env string rather than held in a bare variable so the cache can
 * never outlive the material it was built from, and a FAILED import is never
 * cached — a malformed key would otherwise be re-reported from a stale promise
 * with no clue where it came from.
 */
let signingKeyCache: { material: string; key: Promise<CryptoKey> } | null = null;

function vapidSigningKey(material: string): Promise<CryptoKey> {
  if (signingKeyCache?.material === material) return signingKeyCache.key;
  const key = crypto.subtle
    .importKey(
      // pkcs8 is what scripts/generate-vapid-keys.mjs prints, base64url-encoded.
      "pkcs8",
      toArrayBuffer(fromBase64Url(material)),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    )
    .catch((err: unknown) => {
      if (signingKeyCache?.material === material) signingKeyCache = null;
      throw err;
    });
  signingKeyCache = { material, key };
  return key;
}

function b64urlJson(value: Record<string, string | number>): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * The whole `Authorization` header for one audience.
 *
 * `k` is re-encoded through fromBase64Url/toBase64Url rather than passed
 * through: the header must be base64url and unpadded, and a key pasted from a
 * tool that emits standard base64 (`+`, `/`, trailing `=`) would otherwise be
 * sent verbatim and rejected. The round trip is a no-op for a correct value.
 */
async function vapidAuthorization(audience: string): Promise<string> {
  const header = b64urlJson({ typ: "JWT", alg: "ES256" });
  const payload = b64urlJson({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS,
    sub: vapidSubject(),
  });
  const signingInput = `${header}.${payload}`;

  const key = await vapidSigningKey(env("VAPID_PRIVATE_KEY"));
  // Raw r||s, 64 bytes — already the JOSE format. Never DER-encode this.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  const publicKey = toBase64Url(fromBase64Url(env("VAPID_PUBLIC_KEY")));
  return `vapid t=${signingInput}.${toBase64Url(new Uint8Array(signature))}, k=${publicKey}`;
}

/* ────────────────────────── sending ────────────────────────── */

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * An endpoint is a capability: anyone holding one can wake that device. Logs go
 * to a hosting provider's aggregator, so they get the origin plus a tail long
 * enough to tell two devices apart and far too short to replay.
 */
function fingerprint(endpoint: string): string {
  try {
    return `${new URL(endpoint).host}/…${endpoint.slice(-8)}`;
  } catch {
    return "…invalid-endpoint";
  }
}

/**
 * Undici holds the connection open until a response body is read or cancelled.
 * Nothing here wants the success body, so it is dropped explicitly rather than
 * left to the garbage collector.
 */
async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // A body that is already consumed or errored has nothing to release.
  }
}

/**
 * One contentless push to one device. NEVER THROWS — see the file header.
 *
 * Three headers and no body:
 *   - `TTL` is required by RFC 8030. See PUSH_TTL_SECONDS for the value.
 *   - `Content-Length: 0` is sent explicitly because several push services
 *     reject a POST that declares no length at all.
 *   - `Urgency: high` asks the push service not to hold the message while the
 *     device is idle. A booking just turned green and the admin is the person
 *     who has to act on it; a notification batched until morning is noise.
 *
 * There is deliberately NO `Content-Type` and NO `Content-Encoding`: those
 * announce an encrypted payload, and sending them with an empty body is how you
 * get a 400 that reads like a signing problem.
 */
export async function sendPush(subscription: {
  endpoint: string;
}): Promise<PushSendResult> {
  const { endpoint } = subscription;
  try {
    if (!pushConfigured()) {
      return { status: "failed", endpoint, message: "VAPID is not configured." };
    }

    // The ORIGIN, never the whole URL — the single most common VAPID mistake.
    const audience = new URL(endpoint).origin;
    const authorization = await vapidAuthorization(audience);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        TTL: String(PUSH_TTL_SECONDS),
        "Content-Length": "0",
        Urgency: "high",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });

    // The push service has spoken: this subscription does not exist. The ONLY
    // answer that may delete anything — see PushSendResult.
    if (res.status === 404 || res.status === 410) {
      await discard(res);
      return { status: "gone", endpoint, httpStatus: res.status };
    }

    if (res.ok) {
      await discard(res);
      return { status: "delivered", endpoint, httpStatus: res.status };
    }

    // Everything else is transient as far as this module is concerned: a 429, a
    // 5xx, a 403 from a rotated key. The body usually names the real problem
    // and is the only thing that makes a signing bug diagnosable.
    let detail = "";
    try {
      detail = (await res.text()).trim().slice(0, ERROR_BODY_MAX);
    } catch {
      await discard(res);
    }
    return {
      status: "failed",
      endpoint,
      httpStatus: res.status,
      message: detail || `Push service answered ${res.status}.`,
    };
  } catch (err) {
    // A timeout, DNS, TLS, or a malformed endpoint that failed `new URL`.
    return { status: "failed", endpoint, message: describe(err) };
  }
}

/**
 * Wake every device the admin has opted in from, prune the dead ones, and
 * return. NEVER THROWS, and never fails the caller's request.
 *
 * `context` is a log tag ("booking bk_… confirmed"), never anything sent to a
 * device: the message is empty, by design.
 *
 * Fanned out in parallel because the list is capped at MAX_PUSH_SUBSCRIPTIONS
 * and a client is waiting on the response that triggered this. Pruning happens
 * in ONE write after the fan-out settles, so two dead endpoints cannot start
 * two compare-and-swap loops that invalidate each other's ETag.
 */
export async function notifyAdminDevices(context: string): Promise<void> {
  // Checked, not caught: an unconfigured deploy does no I/O and logs nothing.
  if (!pushConfigured()) return;
  try {
    const subscriptions = await listPushSubscriptions();
    if (subscriptions.length === 0) return;

    // Safe as Promise.all rather than allSettled: sendPush returns its failures
    // instead of throwing them, which is the entire point of PushSendResult.
    const results = await Promise.all(subscriptions.map((s) => sendPush(s)));

    const gone: string[] = [];
    for (const result of results) {
      if (result.status === "gone") {
        gone.push(result.endpoint);
      } else if (result.status === "failed") {
        console.error(
          `push: ${context} — ${fingerprint(result.endpoint)} failed ` +
            `(${result.httpStatus ?? "no response"}): ${result.message}`,
        );
      }
    }

    if (gone.length > 0) {
      const removed = await prunePushSubscriptions(gone);
      console.info(
        `push: ${context} — pruned ${removed} dead subscription(s): ` +
          gone.map(fingerprint).join(", "),
      );
    }
  } catch (err) {
    // A bucket read that failed, or a prune that lost four CAS races. Both cost
    // a notification and nothing else; the booking is already committed.
    console.error(`push: ${context} — notification step failed`, err);
  }
}
