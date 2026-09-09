/**
 * POST /api/booking/<token>/submit — the client's details and their acceptance
 * of the terms, written as ONE record update.
 *
 * That single write is the point of the file. If the details and the consent
 * were two requests, or two mutations, "details on file, terms not accepted"
 * would be a state the record could actually be in — and that state is exactly
 * what the studio would later have to argue about. Here it is unrepresentable:
 * one CAS write sets `name`/`email`/`instagram`/`phone`/`note`, `submittedAt`,
 * `termsAcceptedAt` and `termsVersion` together or sets none of them.
 *
 * `termsAcceptedAt` and `termsVersion` are stamped ONCE and never overwritten.
 * A second submit is an edit to the contact details, not a second consent, so
 * the record keeps saying what was agreed to and when — including which version
 * of the text, which is why a later legal edit can bump TERMS_VERSION without
 * rewriting history.
 *
 * IDEMPOTENCY. The two emails fire only when the record the winning CAS attempt
 * read had no `termsAcceptedAt`. A double-tapped Accept — the single most likely
 * thing a nervous first-time client does — merges the field values, sends
 * nothing, and answers 200. A repeat submit must never show an error: from the
 * client's side they pressed a button twice, and the booking is fine.
 *
 * A REFUSED SUBMIT ALSO COSTS AN ATTEMPT. `counters.submitAttempts` is the only
 * ceiling that survives a cold start — the IP limiter lives in one lambda's
 * memory — so every rung below the ceiling check charges one through
 * `countAttempt`, not just the write at the bottom. The rungs ABOVE it are the
 * two that must never charge anything: the honeypot drop has read no record to
 * charge, and a green booking is finished, so refusing it is not an attempt at
 * anything and may not be turned into a record write.
 *
 * Email ordering, here and in the receipt route: persist first, then send, then
 * write the log back in a SECOND mutation. A send failure lands in
 * `emails.lastError` for the admin sheet's Resend button and never fails the
 * request that already committed.
 *
 * See ../route.ts for the four rules every public booking route obeys — the
 * oracle rule in particular, which is why every refusal below is a bare code.
 */
import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { sendBookingEmails } from "@/lib/booking-emails";
import { deriveStatus } from "@/lib/booking-status";
import { TERMS_VERSION } from "@/lib/booking-terms";
import {
  BookingConflictError,
  mutateBooking,
  toPublicView,
  verifyBookingAccess,
} from "@/lib/bookings-store";
import {
  EMAIL_MAX,
  EMAIL_RE,
  HONEYPOT_FIELD,
  IG_RE,
  MAX_SUBMIT_ATTEMPTS,
  NAME_MAX,
  NOTE_MAX,
  PHONE_RE,
  normalizeEmail,
  normalizeInstagram,
  type BookingAccessReason,
  type BookingEmailKind,
  type BookingId,
  type BookingRecord,
} from "@/lib/bookings-types";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import { loadBookingPageSettings } from "@/lib/settings-store";

export const runtime = "nodejs";
/** Two Brevo calls plus three R2 round trips, all behind one client tap. */
export const maxDuration = 30;

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

function refuse(reason: BookingAccessReason): NextResponse {
  return reason === "link-expired"
    ? fail("link-expired", 410)
    : fail("invalid-link", 404);
}

/** Anything non-string becomes "", so a null or a number reads as absent. */
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Charge a REFUSED submit to the durable ceiling. Best effort: the caller is
 * already returning a 4xx that names the real problem, and a failed counter
 * write is not worth replacing it with a 500.
 *
 * Only ever called below the `MAX_SUBMIT_ATTEMPTS` check, which is what bounds
 * the number of record writes one link can be made to absorb.
 */
async function countAttempt(id: BookingId): Promise<void> {
  try {
    await mutateBooking(id, (current) => ({
      ...current,
      counters: {
        ...current.counters,
        submitAttempts: current.counters.submitAttempts + 1,
      },
    }));
  } catch (err) {
    console.error(`booking submit: attempt not counted for ${id}`, err);
  }
}

/**
 * Persist first, send second, log third — and never fail the client's request
 * for any of it. `sendBookingEmails` is documented not to throw, but this whole
 * step runs after a booking the client already completed has committed, so it
 * is wrapped anyway: nothing that happens out here is worth turning a finished
 * booking into an error on their screen.
 */
async function logEmails(
  record: BookingRecord,
  kinds: BookingEmailKind[],
): Promise<void> {
  try {
    const patch = await sendBookingEmails(record, kinds);
    if (Object.keys(patch).length === 0) return;
    await mutateBooking(record.id, (current) => ({
      ...current,
      emails: { ...current.emails, ...patch },
    }));
  } catch (err) {
    console.error(`booking submit: email step failed for ${record.id}`, err);
  }
}

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const limited = rateLimit("book-submit", ipFromHeaders(req.headers), {
    limit: 10,
    windowMs: 600_000,
  });
  if (!limited.ok) {
    return fail("rate-limited", 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("invalid-body", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("invalid-body", 400);
  }

  // Honeypot, before anything is read from storage: a bot gets the success
  // shape and nothing else. No `view` is echoed because none has been loaded
  // yet, and no attempt is charged because there is no record to charge it to —
  // and a real client never lands here, which is the whole reason the field is
  // called `bt_ref` and not `website`.
  if (str(body[HONEYPOT_FIELD])) {
    console.warn("booking submit: honeypot tripped, dropping request");
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const { token } = await ctx.params;

  try {
    const access = await verifyBookingAccess(token);
    if (!access.ok) return refuse(access.reason);
    const record = access.record;

    // Green is locked to the client: once the receipt is on file the details
    // are evidence, and changing them is Bocha's job in the admin sheet. Above
    // the ceiling and uncounted on purpose — the booking is finished, so this
    // refusal can never be the prelude to a write worth rationing.
    if (deriveStatus(record) === "confirmed") {
      return fail("booking-locked", 409);
    }
    // verifyBookingAccess already refuses a cancelled booking; repeated here so
    // the guarantee holds in this file even if that ordering ever changes.
    if (record.cancelledAt) return fail("invalid-link", 404);

    // The durable ceiling, the one that survives a cold start. It now sits in
    // FRONT of the validation rungs rather than behind them, because each of
    // them charges an attempt and this check is what bounds the total.
    if (record.counters.submitAttempts >= MAX_SUBMIT_ATTEMPTS) {
      return fail("too-many-attempts", 429);
    }

    if (body.acceptTerms !== true) {
      await countAttempt(record.id);
      return fail("terms-required", 409);
    }
    // Not "at least" — equality. A client who loaded the page before a legal
    // edit is accepting text that is no longer the agreement, and the honest
    // answer is to make them reload and read the current one.
    if (str(body.termsVersion) !== TERMS_VERSION) {
      await countAttempt(record.id);
      return fail("conflict", 409);
    }

    const name = str(body.name);
    const email = normalizeEmail(str(body.email));
    const instagram = normalizeInstagram(str(body.instagram));
    const phone = str(body.phone);
    const note = str(body.note);

    // A refusal from here down is a request that reached a real booking and
    // asked it to change; charging it is what the durable counter is for.
    const reject = async (code: string, status: number): Promise<NextResponse> => {
      await countAttempt(record.id);
      return fail(code, status);
    };

    // THE HANDLE IS OPTIONAL — a deliberate relaxation of the original spec,
    // which required it whenever the studio had seeded only an email. That rule
    // hard-blocked a real client with no Instagram account: the page offers no
    // way past the field, so their booking simply could not be completed. The
    // email is already mandatory and is where every mail in this feature goes,
    // so a second channel is not worth losing bookings over. Still validated
    // below when present, and still never written over the seed — the seed is
    // not rewritable from here, so re-typing a handle the studio already has
    // would be busywork either way. To revert, add back:
    //   || (!record.seed.instagram?.trim() && !instagram)
    if (!name || !email) return reject("missing-contact", 400);

    if (name.length > NAME_MAX || note.length > NOTE_MAX) {
      return reject("invalid-body", 400);
    }
    if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
      return reject("invalid-email", 400);
    }
    if (instagram && !IG_RE.test(instagram)) {
      return reject("invalid-instagram", 400);
    }
    if (phone && !PHONE_RE.test(phone)) return reject("invalid-phone", 400);

    const locale = typeof body.locale === "string" && isLocale(body.locale)
      ? body.locale
      : null;
    if (!locale) return reject("invalid-body", 400);

    const nowIso = new Date().toISOString();
    let sawPriorAcceptance = false;

    const updated = await mutateBooking(record.id, (current) => {
      // Assigned inside the mutator and read only after the CAS commits, so it
      // reflects the record the WINNING attempt actually saw — that is what
      // makes the emails fire exactly once when two taps race. The mutator's
      // RETURN VALUE still depends only on its argument, which is the property
      // mutateBooking's retry loop requires.
      sawPriorAcceptance = Boolean(current.client.termsAcceptedAt);
      return {
        ...current,
        client: {
          ...current.client,
          name,
          instagram: instagram || undefined,
          email,
          phone: phone || undefined,
          note: note || undefined,
          locale,
          // Stamped once, together, because they describe one event. A repeat
          // submit edits the fields above and leaves these three alone.
          submittedAt: current.client.submittedAt ?? nowIso,
          termsAcceptedAt: current.client.termsAcceptedAt ?? nowIso,
          termsVersion: current.client.termsVersion ?? TERMS_VERSION,
        },
        counters: {
          ...current.counters,
          submitAttempts: current.counters.submitAttempts + 1,
        },
      };
    });

    // A cancel that landed between verifyBookingAccess and the CAS above: the
    // guard near the top read a snapshot, the mutator copied `cancelledAt`
    // forward, and what committed is a cancelled booking carrying the consent
    // the client just gave. That write is the right one to keep — it is the one
    // field the CAS exists to protect — but the confirmation pair must not go
    // out for a session that no longer exists, and toPublicView refuses a
    // cancelled record, which would turn a committed submit into a bare 500
    // with both mails already sent. Collapse to the same invalid-link the
    // client would get by reloading the page.
    if (updated.cancelledAt) return fail("invalid-link", 404);

    if (!sawPriorAcceptance) {
      // The CLIENT is told we have their details and what is still owed; the
      // STUDIO is not mailed here. A booking at this point is half-finished —
      // the deposit has not landed — and a mail per half-finished booking is
      // noise that trains its own reader to ignore the one that matters. The
      // calendar already shows the amber state the moment this commits, and
      // `ownerSubmitted` stays buildable so the sheet's Resend can still send
      // it deliberately. The studio's automatic mail is the confirmation only.
      await logEmails(updated, ["clientSubmitted"]);
    }

    // The CAS has committed and both mails have gone. This load cannot be
    // allowed to throw past here or a submit that fully succeeded would answer
    // 500 and invite the client to send it again — which is exactly why the
    // helper falls back instead of throwing.
    const settings = await loadBookingPageSettings();
    return NextResponse.json(
      { ok: true, view: toPublicView(updated, settings.payment, settings.studio) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      console.error("booking submit: bookings are not configured", err);
      return fail("bookings-not-configured", 503);
    }
    if (err instanceof BookingConflictError) {
      // Four refused CAS attempts in a row: someone else is writing this record
      // right now. Retrying is the client's call, not ours.
      console.error("booking submit: record contention", err);
      return fail("conflict", 409);
    }
    console.error("booking submit: failed to save details", err);
    return fail("store-failed", 500);
  }
}
