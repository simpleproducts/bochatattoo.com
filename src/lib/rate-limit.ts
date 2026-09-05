import "server-only";

/**
 * Per-IP fixed-window throttle for the public booking routes and pages.
 *
 * Best-effort by design: the window lives in this instance's memory, and
 * serverless instances share nothing, so a client spread across instances gets
 * a multiple of `limit`. That is acceptable here because the real ceiling is
 * durable — `counters.submitAttempts` / `counters.uploadAttempts` on the
 * booking record, checked inside the CAS write. This layer exists only to make
 * a burst cheap to refuse before any R2 read happens.
 *
 * Unlike the login route's map (which is deliberately left untouched), this one
 * sweeps expired entries so a long-lived instance cannot grow without bound.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Sweeping on a call counter rather than a timer: no handle to keep alive. */
const SWEEP_EVERY = 500;
let callsSinceSweep = 0;

export function ipFromHeaders(h: Headers): string {
  // On Vercel, `x-real-ip` is set by the platform itself (after stripping
  // any client-supplied version). `x-forwarded-for` can include
  // client-supplied prefixes — use it only as a fallback. `cf-connecting-ip`
  // covers a Cloudflare proxy in front of Vercel.
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function rateLimit(
  bucket: string,
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();

  if (++callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0;
    for (const [k, w] of windows) {
      if (w.resetAt <= now) windows.delete(k);
    }
  }

  // Bucketed so two limits on the same IP (view vs upload) never share a count.
  const id = `${bucket}:${key}`;
  const cur = windows.get(id);

  if (!cur || cur.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (cur.count >= opts.limit) {
    // Never advertise 0 — a `Retry-After: 0` invites an immediate retry.
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }

  cur.count++;
  return { ok: true };
}
