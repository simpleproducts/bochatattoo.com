/**
 * Admin session epoch — bumped on logout to revoke every previously-issued
 * cookie server-side.
 *
 * Stored as `admin-state.json` at the R2 bucket root, served from the same
 * public domain as images. Reading is Edge-safe (plain fetch). Writing
 * happens only from Node-runtime API routes via the S3 SDK in lib/r2.ts.
 *
 * Cookies include the epoch they were minted at. Verification rejects
 * anything below the current epoch — so logout instantly invalidates every
 * outstanding session, not just the one whose cookie was cleared.
 */

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

const TTL_MS = 15_000;
let cached: { epoch: number; ts: number } | null = null;

export const ADMIN_STATE_KEY = "admin-state.json";

/**
 * Edge-safe reader. Fetches the public admin-state.json with a small
 * in-memory TTL so middleware doesn't hammer R2 on every request.
 *
 * Returns 0 on any error (including "file not yet uploaded") — safe default.
 */
export async function getAdminEpoch(): Promise<number> {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.epoch;
  if (!BASE) {
    cached = { epoch: 0, ts: Date.now() };
    return 0;
  }
  try {
    const res = await fetch(
      `${BASE}/${ADMIN_STATE_KEY}?t=${Math.floor(Date.now() / TTL_MS)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      cached = { epoch: 0, ts: Date.now() };
      return 0;
    }
    const data = (await res.json()) as { epoch?: number };
    const epoch = typeof data.epoch === "number" ? data.epoch : 0;
    cached = { epoch, ts: Date.now() };
    return epoch;
  } catch {
    cached = { epoch: 0, ts: Date.now() };
    return 0;
  }
}

/** Drop the in-memory cache so the next read goes to R2. */
export function invalidateAdminEpochCache(): void {
  cached = null;
}
