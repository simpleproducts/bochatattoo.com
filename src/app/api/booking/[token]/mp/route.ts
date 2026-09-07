/**
 * POST /api/booking/<token>/mp — start a MercadoPago checkout for this
 * booking's deposit and hand back the hosted page to send the client to.
 *
 * THIS ROUTE CHANGES NOTHING. It reads a record, asks MercadoPago for a
 * preference and returns a URL; no mutation, no counter, no trace on the
 * booking at all. That is the whole design: a preference the client never pays
 * is not a fact about the booking, and the only thing that may ever write
 * `record.payment` is the webhook at /api/mp/webhook. A double tap therefore
 * creates a second preference and costs nothing.
 *
 * FIVE REFUSALS, FIVE CODES. Confirmed, terms not accepted, method switched off
 * in settings, no access token on the deploy, nothing to charge — each answers
 * with its own kebab-case code, because "the studio stopped taking card
 * payments" and "this booking has no deposit" are different facts and a support
 * message that says "generic error" for both is a support message nobody can
 * act on. Three of them are unreachable from a page rendered against the same
 * settings this route reads, so the client page maps only the two payment codes
 * to a sentence and lets the rest fall through to `errors.generic` — see
 * ERROR_KEYS in src/components/booking/contract.ts. They are still distinct on
 * the wire and in the log, which is where they are actually read.
 *
 * See ../route.ts for the four rules every public booking route obeys: outside
 * /api/admin, one vague 404 for every access refusal, bare codes and nothing
 * else in a body, and `no-store` on all of them.
 */
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { deriveStatus } from "@/lib/booking-status";
import { verifyBookingAccess } from "@/lib/bookings-store";
import type { BookingAccessReason } from "@/lib/bookings-types";
import {
  createPreference,
  mercadoPagoConfigured,
  MercadoPagoError,
} from "@/lib/mercadopago";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { loadSettings } from "@/lib/settings-store";

export const runtime = "nodejs";
/** Two R2 reads and one call to MercadoPago, all behind a single client tap. */
export const maxDuration = 15;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * What the client sees on MercadoPago's own checkout page, in the language they
 * were reading.
 *
 * It lives here rather than in the dictionaries for the same reason CLIENT_COPY
 * lives inside src/lib/booking-emails.ts: those dictionaries are the copy of
 * OUR page, loaded by components that render it, and this string is neither —
 * it is rendered by mercadopago.com, from a value the server sends once and
 * never reads back. Two entries, both Argentine, keyed by the same Locale union
 * so a third language cannot be added without this line failing to compile.
 */
const ITEM_TITLE: Record<Locale, string> = {
  es: "Seña · Bocha Tattoo",
  en: "Deposit · Bocha Tattoo",
};

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

export async function POST(req: Request, ctx: RouteContext) {
  // Tighter than the view limit and looser than the upload one: every call
  // here costs a request to MercadoPago, and there is no durable counter on
  // the record to fall back on the way the submit and upload routes have one.
  const limited = rateLimit("book-mp", ipFromHeaders(req.headers), {
    limit: 10,
    windowMs: 600_000,
  });
  if (!limited.ok) {
    return fail("rate-limited", 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  // The body carries at most a locale, so an absent or unparseable one is not
  // an error: it falls back to the language the client submitted the form in.
  // Refusing a bodyless POST here would be a 400 for a request that has
  // everything it actually needs in the path.
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // No body, or not JSON. Both mean "use the record's own locale".
  }

  const { token } = await ctx.params;

  try {
    const access = await verifyBookingAccess(token);
    if (!access.ok) return refuse(access.reason);
    const record = access.record;

    // verifyBookingAccess already refuses a cancelled booking; repeated here so
    // the guarantee holds in this file even if that ordering ever changes. No
    // stranger holding an old link may be sent to a checkout for a session that
    // no longer exists.
    if (record.cancelledAt) return fail("invalid-link", 404);

    // Green is finished. Sending a client to a checkout for a deposit already
    // received is how a studio ends up owing a refund.
    if (deriveStatus(record) === "confirmed") {
      return fail("booking-locked", 409);
    }

    // Money before consent is backwards — the same rung, in the same order, as
    // the receipt route: the terms are what the deposit is paid under.
    if (!record.client.termsAcceptedAt) {
      return fail("terms-required", 409);
    }

    const settings = await loadSettings();
    // The studio's switch. Checked even though the page only paints the button
    // when this is on: the page was rendered from a snapshot of these settings
    // and the studio may have turned the method off in the minutes since.
    if (!settings.mercadopago.enabled) {
      return fail("mp-disabled", 409);
    }

    // The deploy's half of the same question. 503 rather than 409 because this
    // one is not a decision anybody made — it is a missing env var, and the
    // status should say "the server, not you".
    if (!mercadoPagoConfigured()) {
      return fail("mp-not-configured", 503);
    }

    const deposit = record.deposit;
    if (!deposit || !(deposit.amount > 0)) {
      return fail("no-deposit", 409);
    }

    // The page they are looking at right now wins: a client who switched
    // language after submitting should be handed a checkout in the language on
    // their screen, not the one recorded days ago.
    const raw = body.locale;
    const locale: Locale =
      typeof raw === "string" && isLocale(raw)
        ? raw
        : (record.client.locale ?? DEFAULT_LOCALE);

    // Client first, seed second: the client's own address is the one they will
    // recognise on the checkout. Neither is required — MercadoPago asks for an
    // email itself when the preference carries none.
    const payerEmail = record.client.email || record.seed.email || undefined;

    const preference = await createPreference({
      bookingId: record.id,
      title: ITEM_TITLE[locale],
      amount: deposit.amount,
      currency: deposit.currency,
      payerEmail,
      locale,
      token,
    });

    // The id is deliberately not returned. The client needs somewhere to go;
    // the preference id is a MercadoPago-side identifier that would only invite
    // the page to reason about a payment it cannot verify.
    return NextResponse.json(
      { ok: true, initPoint: preference.initPoint },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      console.error("booking mp: bookings are not configured", err);
      return fail("bookings-not-configured", 503);
    }
    if (err instanceof MercadoPagoError) {
      // The message was written by src/lib/mercadopago.ts and is safe to log;
      // what reaches the client is one of two codes and nothing more.
      console.error(
        `booking mp: MercadoPago ${err.code} (status ${err.status ?? "none"})`,
        err,
      );
      if (err.code === "not-configured") return fail("mp-not-configured", 503);
      // MercadoPago read the request and refused it, so another method is the
      // useful advice. Everything else — timeout, socket, 5xx, a 2xx in a shape
      // we were not promised — is worth retrying, and nothing was charged in
      // either case.
      const rejected = err.code === "rejected" || err.code === "bad-request";
      return fail(rejected ? "payment-rejected" : "payment-failed", 502);
    }
    console.error("booking mp: failed to start a checkout", err);
    return fail("store-failed", 500);
  }
}
