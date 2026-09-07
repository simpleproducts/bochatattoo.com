/**
 * GET /api/booking/<token> — read one booking through its private link.
 *
 * This file and its two siblings (submit, receipt) are the only unauthenticated
 * endpoints in the project that act on a stranger's behalf, and the only
 * credential any of them has is the token in the path. Four rules hold across
 * all three:
 *
 *   1. They live OUTSIDE /api/admin deliberately. middleware.ts matches
 *      "/api/admin/:path*" and its PUBLIC_PATHS set is exact-string, so a
 *      booking route parked under that prefix would 401 the exact people it
 *      exists to serve. Moving it is not a refactor, it is an outage.
 *
 *   2. THE ORACLE RULE. Every refusal from verifyBookingAccess collapses to the
 *      identical body { error: "invalid-link" } at 404 — a forged token, a
 *      booking id that was never minted, a revoked link and a cancelled
 *      appointment are indistinguishable from outside, so this endpoint can
 *      never be used to test whether a booking exists. The one exception is
 *      `link-expired` at 410, which is only reachable after the HMAC check has
 *      already passed: whoever sees it demonstrably holds a link we signed, and
 *      it tells them nothing they could not already prove.
 *
 *   3. Codes only. No SDK message, no bucket name, no stack trace ever reaches
 *      a client from here. Failures are logged server-side and answered with a
 *      bare kebab-case code that src/components/booking/contract.ts turns into
 *      a sentence in the reader's language.
 *
 *   4. Every response is `no-store`. These bodies are scoped to one token and
 *      carry a name, an email and a phone number; none of it may sit in a CDN
 *      or in a shared browser cache.
 */
import { NextResponse } from "next/server";
import { toPublicView, verifyBookingAccess } from "@/lib/bookings-store";
import type { BookingAccessReason } from "@/lib/bookings-types";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import { loadPublicPaymentSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(
  code: string,
  status: number,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: code },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

/** The oracle rule in one expression: five distinct reasons, two answers. */
function refuse(reason: BookingAccessReason): NextResponse {
  return reason === "link-expired"
    ? fail("link-expired", 410)
    : fail("invalid-link", 404);
}

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const limited = rateLimit("book-view", ipFromHeaders(req.headers), {
    limit: 60,
    windowMs: 300_000,
  });
  if (!limited.ok) {
    return fail("rate-limited", 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  const { token } = await ctx.params;

  try {
    const access = await verifyBookingAccess(token);
    if (!access.ok) return refuse(access.reason);
    // Read only after the token has proven itself, so a burst of forged links
    // costs one R2 GET each and not two. Never throws — see the helper.
    const paymentSettings = await loadPublicPaymentSettings();
    return NextResponse.json(
      { ok: true, view: toPublicView(access.record, paymentSettings) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      console.error("booking view: bookings are not configured", err);
      return fail("bookings-not-configured", 503);
    }
    console.error("booking view: failed to read booking", err);
    return fail("store-failed", 500);
  }
}
