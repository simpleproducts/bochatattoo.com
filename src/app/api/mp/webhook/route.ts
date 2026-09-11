/**
 * POST /api/mp/webhook — MercadoPago's payment notification, and THE ONLY
 * thing in this codebase that may mark a booking paid.
 *
 * The browser coming back from Checkout Pro never does it. That return is a URL
 * the client controls: anyone who has seen it once can type it again with
 * `status=approved` on the end, and a booking confirmed that way is a free
 * session. So the redirect only changes what the page SAYS, and the money is a
 * fact only when MercadoPago tells the server about it — here.
 *
 * Being unauthenticated by nature, this endpoint stands on three things:
 *
 *   1. THE SIGNATURE, when MP_WEBHOOK_SECRET is set. `x-signature` carries a
 *      timestamp and an HMAC-SHA256 over `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
 *      compared byte-wise with a timing-safe equality. The id in that manifest
 *      is the same id this handler then acts on — verifying one value and using
 *      another would authenticate nothing. With the secret UNSET the handler
 *      still runs, because MercadoPago's dashboard treats the secret as
 *      optional and a studio mid-setup should not silently stop being told
 *      about payments; it says so in the log, loudly, on every single delivery.
 *
 *   2. THE BODY'S STATUS IS NEVER READ. Not once, anywhere in this file. The
 *      notification is treated as a bare pointer — a payment id — and the truth
 *      about that payment is fetched from MercadoPago's own API. That is what
 *      makes rule 1 a defence in depth rather than the only wall: forging a
 *      confirmation without the secret still requires a real, approved
 *      MercadoPago payment whose `external_reference` is a real booking id.
 *
 *   3. IDEMPOTENCE. MercadoPago retries, and sends `payment.created` and
 *      `payment.updated` for the same payment. A delivery for a booking that
 *      already carries a payment returns the record unchanged — same object
 *      reference, so mutateBooking writes nothing — and sends no mail. The
 *      confirmation pair fires on the FIRST transition to confirmed and never
 *      again.
 *
 * ALMOST EVERYTHING ANSWERS 200. MercadoPago retries every non-2xx, and
 * retrying a payment for a booking that was deleted, or a notification about a
 * topic this route does not handle, is a loop with no end and no fix at the far
 * side of it. "Handled" and "deliberately ignored" are both 200. The two
 * exceptions are a bad signature (401 — that delivery did not come from
 * MercadoPago, or the secret is wrong, and both want to be visible) and a
 * server that cannot reach its own storage (503 — a retry in ten minutes is
 * exactly what should happen).
 *
 * There is deliberately no rate limit. The only expensive step below is gated
 * behind a payment id MercadoPago must actually recognise, and dropping a
 * genuine notification costs a client their confirmed booking — a far worse
 * outcome than absorbing a burst of forged ones that resolve to nothing.
 *
 * Email ordering is the receipt route's, unchanged: persist, then send, then
 * write the log back in a SECOND mutation.
 */
import { NextResponse } from "next/server";
import {
  fromBase64Url,
  hmacBase64Url,
  timingSafeEqual,
} from "@/lib/booking-crypto";
import { sendBookingEmails } from "@/lib/booking-emails";
import { deriveStatus } from "@/lib/booking-status";
import { getBooking, mutateBooking } from "@/lib/bookings-store";
import {
  BOOKING_ID_RE,
  type BookingEmailKind,
  type BookingRecord,
} from "@/lib/bookings-types";
import { getPayment, MercadoPagoError } from "@/lib/mercadopago";
import { notifyAdminDevices } from "@/lib/push";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";
/** MercadoPago's API, two R2 round trips and two Brevo calls, in one delivery. */
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * What MercadoPago is allowed to hand us as a payment id. Numeric in practice,
 * but the shape gate is URL-safety rather than a format claim: this value is
 * pasted into an API path, so it is checked before it is used and left generous
 * enough to survive MercadoPago changing its id format.
 */
const PAYMENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The whole vocabulary of this endpoint's answers. A body with anything in it
 * would be an oracle: with no secret configured, "no such booking" and "already
 * paid" would be readable by anyone who can reach the URL. The reason always
 * goes to the log instead, where the studio can actually see it.
 */
function ack(): NextResponse {
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

/** Persist first, send second, log third — never fail a committed payment. */
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
    console.error(`mp webhook: email step failed for ${record.id}`, err);
  }
}

/** MercadoPago sends ids as strings in some payloads and as numbers in others. */
function readId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return "";
}

/** Lowercase hex to bytes, or null for anything that is not lowercase hex. */
function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** `ts=1700000000,v1=abc…` — comma-separated, `key=value`, order not promised. */
function parseSignatureHeader(header: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const chunk of header.split(",")) {
    const eq = chunk.indexOf("=");
    if (eq <= 0) continue;
    parts[chunk.slice(0, eq).trim()] = chunk.slice(eq + 1).trim();
  }
  return parts;
}

type Verdict = "verified" | "unverified" | "invalid";

/**
 * Check MercadoPago's signature over the id this handler is about to act on.
 *
 * There is no freshness window on `ts`, on purpose. A replayed notification is
 * harmless here — the handler re-reads the payment from MercadoPago and is
 * idempotent — so a clock-skew rule would only buy a way to reject genuine
 * deliveries on a server whose clock drifted.
 */
async function verifySignature(
  headers: Headers,
  dataId: string,
): Promise<Verdict> {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return "unverified";

  const header = headers.get("x-signature");
  if (!header) return "invalid";

  const parts = parseSignatureHeader(header);
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return "invalid";

  const requestId = headers.get("x-request-id");
  // MercadoPago's manifest omits the request-id segment entirely when it did
  // not send that header, so this reproduces the absence rather than filling it
  // with an empty string that would hash to something else.
  const manifest =
    `id:${dataId.toLowerCase()};` +
    (requestId ? `request-id:${requestId};` : "") +
    `ts:${ts};`;

  const received = fromHex(v1.toLowerCase());
  if (!received) return "invalid";

  // Compared as decoded bytes, never with ===: a string compare returns at the
  // first differing character and turns the tag into a byte-at-a-time oracle.
  const expected = fromBase64Url(await hmacBase64Url(manifest, secret));
  return timingSafeEqual(received, expected) ? "verified" : "invalid";
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  // The body is read for exactly two fields — a topic and an id — and neither
  // is trusted for anything but routing. Anything unparseable leaves an empty
  // object behind and falls through to the query parameters.
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON. MercadoPago also notifies with an empty body and query
    // parameters only, which is a shape this handler serves just as well.
  }

  const action = typeof body.action === "string" ? body.action : "";
  const topic =
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    (typeof body.type === "string" ? body.type : "") ||
    // "payment.created" / "payment.updated" — the newer notification shape.
    action.split(".")[0];

  // Ahead of the signature check, and it has to be: merchant_order and
  // subscription notifications are signed over a manifest this route has no
  // business reconstructing, and 401-ing them would put MercadoPago into a
  // retry loop over deliveries we were always going to throw away.
  if (topic !== "payment") {
    console.info(`mp webhook: ignoring "${topic || "unknown"}" notification`);
    return ack();
  }

  const data = body.data;
  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    (data && typeof data === "object"
      ? readId((data as { id?: unknown }).id)
      : "");

  const verdict = await verifySignature(req.headers, dataId);
  if (verdict === "invalid") {
    // The one refusal in this file. A retry from MercadoPago is welcome: if the
    // secret is simply wrong, the studio fixing it makes the retries land.
    console.error("mp webhook: signature check failed, refusing notification");
    return NextResponse.json(
      { error: "bad-signature" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (verdict === "unverified") {
    console.warn(
      "mp webhook: MP_WEBHOOK_SECRET is not set — this notification was " +
        "ACCEPTED UNVERIFIED. Set the secret from the MercadoPago dashboard.",
    );
  }

  if (!PAYMENT_ID_RE.test(dataId)) {
    console.warn("mp webhook: payment notification carried no usable id");
    return ack();
  }

  try {
    // The only account of this payment anyone here believes. See rule 2.
    const payment = await getPayment(dataId);
    if (!payment) {
      console.warn(`mp webhook: MercadoPago has no payment ${dataId}`);
      return ack();
    }

    // "approved" and nothing else. A pending or in_process payment is money
    // that has not arrived, and rejected/cancelled/refunded are not states this
    // record has a shape for — see BookingPayment. Each of them simply leaves
    // the booking exactly as it was.
    if (payment.status !== "approved") {
      console.info(`mp webhook: payment ${dataId} is ${payment.status}, nothing to do`);
      return ack();
    }

    const bookingId = payment.externalReference ?? "";
    // Validated BEFORE it is used to build a storage key. `external_reference`
    // is a free-text field on MercadoPago's side, and the one thing that must
    // never happen is a string from an upstream API becoming an object key.
    if (!BOOKING_ID_RE.test(bookingId)) {
      console.error(
        `mp webhook: payment ${dataId} has no valid external_reference — ` +
          "the deposit cannot be matched to a booking",
      );
      return ack();
    }

    const record = await getBooking(bookingId);
    if (!record) {
      // Money for a booking that no longer exists. Nothing to write and nothing
      // a retry could fix, so it is acknowledged and left in the log for the
      // studio to reconcile in their MercadoPago account.
      console.error(
        `mp webhook: payment ${dataId} references missing booking ${bookingId}`,
      );
      return ack();
    }

    // The cheap half of rule 3, before any write is attempted. The mutator
    // below is the half that survives two deliveries racing each other.
    if (record.payment) return ack();

    // Stamped out here so a retried CAS attempt cannot re-stamp it: the mutator
    // must be a pure function of the record it is handed.
    const paidAt = new Date().toISOString();
    let sawPriorPayment = false;
    let wasConfirmed = false;

    const updated = await mutateBooking(bookingId, (current) => {
      // Both are assigned inside the mutator and read only after the CAS
      // commits, so they describe the record the WINNING attempt saw — that is
      // what makes the confirmation pair fire exactly once. The mutator's
      // RETURN VALUE still depends only on its argument.
      sawPriorPayment = Boolean(current.payment);
      wasConfirmed = deriveStatus(current) === "confirmed";
      // Same object reference: mutateBooking reads that as "no change" and
      // skips the write entirely. A second delivery costs one read.
      if (current.payment) return current;
      return {
        ...current,
        payment: {
          method: "mercadopago",
          provider: "mercadopago",
          providerPaymentId: dataId,
          // Omitted rather than defaulted when MercadoPago did not report them:
          // `amount: 0` on a record would read as a payment of nothing.
          ...(payment.amount !== undefined ? { amount: payment.amount } : {}),
          ...(payment.currency !== undefined ? { currency: payment.currency } : {}),
          paidAt,
        },
      };
    });

    if (sawPriorPayment) return ack();

    if (updated.cancelledAt) {
      // A real deposit landed on a cancelled session — either a race with the
      // admin's cancel, or a client who paid from a link they had already been
      // told was dead. The payment is written down anyway, because the money is
      // real and the studio has to see it somewhere other than MercadoPago; the
      // confirmation pair is not sent, because there is nothing to confirm.
      console.error(
        `mp webhook: payment ${dataId} landed on cancelled booking ${bookingId}`,
      );
      return ack();
    }

    // The first transition to green, and the only one that mails anybody. A
    // booking still missing its details stays "pending" on the payment alone
    // and correctly sends nothing; one already confirmed by a receipt has
    // already had its pair.
    if (!wasConfirmed && deriveStatus(updated) === "confirmed") {
      // The push rides the same condition as the mails, from the same place, so
      // the two can never drift apart on what "confirmed" means. Both are
      // best-effort and neither can reject — each returns its failures instead
      // of throwing — so Promise.all here cannot turn a recorded payment into a
      // 500 that puts MercadoPago into a retry loop over a delivery that
      // already did its job.
      await Promise.all([
        notifyAdminDevices(`booking ${bookingId} confirmed by payment`),
        logEmails(updated, ["ownerConfirmed", "clientConfirmed"]),
      ]);
    }

    return ack();
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      // The one failure worth a retry: the deploy is missing its bucket
      // configuration, and the notification is still valid when that is fixed.
      console.error("mp webhook: bookings are not configured", err);
      return NextResponse.json(
        { error: "bookings-not-configured" },
        { status: 503, headers: NO_STORE },
      );
    }
    if (err instanceof MercadoPagoError) {
      console.error(`mp webhook: ${err.code} reading payment ${dataId}`, err);
      // A timeout or a 5xx deserves MercadoPago's retry; a 4xx means this
      // deploy's token cannot read that payment, and retrying will not change
      // that, so it is acknowledged and left in the log.
      const retryable = err.code !== "rejected";
      return retryable
        ? NextResponse.json(
            { error: "upstream-unavailable" },
            { status: 503, headers: NO_STORE },
          )
        : ack();
    }
    // A storage failure. Retrying is the right answer, and the booking is
    // unchanged until one of them succeeds.
    console.error(`mp webhook: failed to record payment ${dataId}`, err);
    return NextResponse.json(
      { error: "store-failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
