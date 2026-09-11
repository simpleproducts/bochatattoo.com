/**
 * POST /api/booking/<token>/receipt — the client's bank transfer receipt.
 *
 * The one endpoint on this site where a stranger's bytes get written to
 * storage, so the ladder below runs in a fixed order and four of its rungs are
 * load-bearing:
 *
 *   - SIZE IS CHECKED TWICE, and only the second check is trusted. The
 *     `content-length` header is refused before the body is read at all, so a
 *     50 MB POST costs us nothing; then `bytes.byteLength` is re-checked after
 *     the read. The header and `File.size` are assertions made by the sender —
 *     the length of the buffer we actually hold is the only number that is a
 *     fact.
 *
 *   - THE CONTENT TYPE COMES FROM THE BYTES. `file.type` and the multipart part
 *     header are never consulted, anywhere in this file. `sniffReceipt` reads
 *     the magic bytes, and its answer is what gets stored and later echoed back
 *     as the `Content-Type` of the admin receipt route — so a .pdf named file
 *     full of HTML is refused here rather than being served back as text/html
 *     to Bocha's browser. A HEIC brand sniffs to `null` and gets 415: no
 *     browser renders it and transcoding would mean decoding untrusted bytes.
 *     Nothing on this path touches sharp; there is no server-side image decode
 *     in the booking feature at all.
 *
 *   - THE KEY IS CONTENT-ADDRESSED: bookings/receipts/<id>/<sha16>.<ext>. A
 *     double tap therefore rewrites the same object instead of orphaning a blob
 *     nothing points at, and an identical re-upload short-circuits before the
 *     PUT entirely. That short-circuit is the reason `prepareUpload` runs in
 *     front of the record-state rungs: the key IS the hash, so whether this
 *     request would change anything is not knowable until the bytes have been
 *     read and digested — and a phone that dropped its connection after the
 *     server committed must not be answered "already confirmed" for re-sending
 *     the file that is already on the record. A genuine replacement writes a
 *     new key and deletes the old one AFTER the record commits, so a failure
 *     there leaves a stale blob (a cleanup problem) rather than a record
 *     pointing at nothing (a data loss).
 *
 *   - A REFUSED UPLOAD COSTS AN ATTEMPT. `counters.uploadAttempts` is the only
 *     ceiling that survives a cold start — the IP limiter lives in one lambda's
 *     memory — so every rung BELOW the ceiling check bumps it through
 *     `countAttempt`, otherwise the cheap refusals (wrong type, too large,
 *     terms not accepted) repeat for free and the durable ceiling exists only
 *     on the one path that was never the problem. The two rungs ABOVE it never
 *     count and must stay above it: a byte-identical re-upload writes nothing
 *     and a green booking is finished, so neither is an attempt at anything,
 *     and neither may be made to burn a record write.
 *
 * See ../route.ts for the four rules every public booking route obeys.
 */
import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { sha256Hex } from "@/lib/booking-crypto";
import { sendBookingEmails } from "@/lib/booking-emails";
import { deriveStatus } from "@/lib/booking-status";
import {
  BookingConflictError,
  mutateBooking,
  receiptKey,
  toPublicView,
  verifyBookingAccess,
} from "@/lib/bookings-store";
import {
  HONEYPOT_FIELD,
  MAX_UPLOAD_ATTEMPTS,
  RECEIPT_MAX_BYTES,
  sanitizeFilename,
  type BookingAccessReason,
  type BookingEmailKind,
  type BookingId,
  type BookingRecord,
  type PublicBookingView,
} from "@/lib/bookings-types";
import { notifyAdminDevices } from "@/lib/push";
import { deletePrivate, putPrivateBytes, BookingsNotConfiguredError } from "@/lib/r2-private";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { sniffReceipt, type SniffedReceipt } from "@/lib/receipt-validate";
import { loadBookingPageSettings } from "@/lib/settings-store";

export const runtime = "nodejs";
/** A 4 MB upload plus a bucket write plus two Brevo calls, behind one tap. */
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

/**
 * One settings read, one view. Three of the answers below carry a
 * PublicBookingView and each is reached on its own, so the read stays with the
 * answer rather than being hoisted to the top — the paths that refuse WITHOUT a
 * view (the durable upload ceiling, a rejected file) still cost zero settings
 * GETs, which is what keeps a valid link that is being hammered cheap.
 *
 * Both settings blocks go into toPublicView untouched. The studio address is
 * gated in there, once, and this route makes no judgement of its own about it.
 */
async function viewOf(record: BookingRecord): Promise<PublicBookingView> {
  const settings = await loadBookingPageSettings();
  return toPublicView(record, settings.payment, settings.studio);
}

/** Persist first, send second, log third — never fail a committed upload. */
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
    console.error(`booking receipt: email step failed for ${record.id}`, err);
  }
}

/**
 * Charge a REFUSED upload to the durable ceiling. Best effort on purpose: the
 * caller is already returning a 4xx, and turning a failed counter write into a
 * 500 on top of it would replace a precise refusal with a vague one.
 *
 * Only ever called below the `MAX_UPLOAD_ATTEMPTS` check, which is what bounds
 * the number of record writes one link can be made to absorb.
 */
async function countAttempt(id: BookingId): Promise<void> {
  try {
    await mutateBooking(id, (current) => ({
      ...current,
      counters: {
        ...current.counters,
        uploadAttempts: current.counters.uploadAttempts + 1,
      },
    }));
  } catch (err) {
    console.error(`booking receipt: attempt not counted for ${id}`, err);
  }
}

type PreparedUpload =
  | {
      ok: true;
      file: File;
      bytes: Uint8Array;
      sniffed: SniffedReceipt;
      sha256: string;
      key: string;
    }
  | { ok: false; code: string; status: number };

/**
 * Everything decidable from the bytes alone, in one step, so the caller can run
 * it BEFORE the record-state rungs and still answer them in the right order.
 * The refusal is returned rather than sent, because whether it is even reached
 * depends on state this function deliberately knows nothing about.
 */
async function prepareUpload(
  id: BookingId,
  form: FormData,
): Promise<PreparedUpload> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, code: "invalid-body", status: 400 };
  if (file.size > RECEIPT_MAX_BYTES) return { ok: false, code: "too-large", status: 413 };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The only size number that is a fact rather than a claim.
  if (bytes.byteLength > RECEIPT_MAX_BYTES) {
    return { ok: false, code: "too-large", status: 413 };
  }

  const sniffed = sniffReceipt(bytes);
  if (!sniffed) return { ok: false, code: "unsupported-type", status: 415 };

  const sha256 = await sha256Hex(bytes);
  return {
    ok: true,
    file,
    bytes,
    sniffed,
    sha256,
    key: receiptKey(id, sha256.slice(0, 16), sniffed.ext),
  };
}

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const limited = rateLimit("book-receipt", ipFromHeaders(req.headers), {
    limit: 6,
    windowMs: 600_000,
  });
  if (!limited.ok) {
    return fail("rate-limited", 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  // Before req.formData(), which would buffer the whole thing. The multipart
  // envelope makes this marginally stricter than the byte check further down —
  // the safe direction, and the client downscales to well under the ceiling.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > RECEIPT_MAX_BYTES) {
    return fail("too-large", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid-body", 400);
  }

  // Same drop as the submit route: no record has been read yet, so there is no
  // view to echo — and nothing to charge an attempt against, which is the other
  // reason this rung stays first. A bot gets the success shape and nothing else.
  const honeypot = form.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim()) {
    console.warn("booking receipt: honeypot tripped, dropping request");
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const { token } = await ctx.params;

  try {
    const access = await verifyBookingAccess(token);
    if (!access.ok) return refuse(access.reason);
    const record = access.record;

    // verifyBookingAccess already refuses a cancelled booking; repeated here so
    // the guarantee holds in this file even if that ordering ever changes — and
    // it has to lead, because both rungs under it answer with a view and
    // toPublicView refuses a cancelled record.
    if (record.cancelledAt) return fail("invalid-link", 404);

    const prepared = await prepareUpload(record.id, form);

    // Byte-identical re-upload: same content, same key, nothing to write. The
    // double-tap path, and the reason a retry after a flaky connection is free
    // — it is FIRST so that a client whose success response was lost gets the
    // view they never received rather than the green lock's refusal, which they
    // could not act on and which no reload of the page would have produced.
    if (prepared.ok && record.receipt?.key === prepared.key) {
      return NextResponse.json(
        { ok: true, view: await viewOf(record) },
        { headers: NO_STORE },
      );
    }

    // Replacement is allowed only while yellow. Once the booking is green the
    // receipt is evidence, and swapping it is the admin's DELETE, not a POST
    // from whoever still has the link. The current view rides along in the
    // error body: whoever sent this holds the link, so they may see their own
    // finished booking, and the refusal is the one piece of bad news that is
    // really good news — the client can be shown the done state instead of an
    // upload error under a "receipt missing" rail.
    if (deriveStatus(record) === "confirmed") {
      return NextResponse.json(
        {
          error: "booking-locked",
          view: await viewOf(record),
        },
        { status: 409, headers: NO_STORE },
      );
    }

    // The durable ceiling, the one that survives a cold start, and the gate in
    // front of every countAttempt() below: refusing HERE without counting is
    // what keeps the counter (and the writes it costs) bounded.
    if (record.counters.uploadAttempts >= MAX_UPLOAD_ATTEMPTS) {
      return fail("too-many-attempts", 429);
    }

    // Money before consent is backwards: the terms are what the deposit is
    // paid under, so a receipt cannot be first through the door.
    if (!record.client.termsAcceptedAt) {
      await countAttempt(record.id);
      return fail("terms-required", 409);
    }

    // A file this route will not store is still an upload attempt: the same
    // rejected bytes re-sent in a loop is exactly the abuse the ceiling exists
    // for, and it never reaches the mutator that would otherwise count it.
    if (!prepared.ok) {
      await countAttempt(record.id);
      return fail(prepared.code, prepared.status);
    }

    const { bytes, file, key, sha256, sniffed } = prepared;

    await putPrivateBytes(key, bytes, sniffed.contentType);

    const rawLocale = form.get("locale");
    // The client may have switched language between submitting and paying; the
    // confirmation mail should follow the page they are actually looking at.
    const locale =
      typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : null;

    const nowIso = new Date().toISOString();
    let sawPriorReceipt = false;
    let replacedKey: string | undefined;

    const updated = await mutateBooking(record.id, (current) => {
      // Both assigned inside the mutator and read only after the CAS commits,
      // so they describe the record the WINNING attempt saw: that is what makes
      // the confirmation pair fire exactly once, and what stops a lost race
      // from deleting the blob the winner just attached. The mutator's RETURN
      // VALUE still depends only on its argument.
      sawPriorReceipt = Boolean(current.receipt);
      replacedKey =
        current.receipt && current.receipt.key !== key
          ? current.receipt.key
          : undefined;
      return {
        ...current,
        client: { ...current.client, locale: locale ?? current.client.locale },
        receipt: {
          key,
          filename: sanitizeFilename(file.name),
          contentType: sniffed.contentType,
          ext: sniffed.ext,
          bytes: bytes.byteLength,
          sha256,
          uploadedAt: nowIso,
        },
        counters: {
          ...current.counters,
          uploadAttempts: current.counters.uploadAttempts + 1,
        },
      };
    });

    // After the record commits, so a failure here is a stale blob nobody
    // references rather than a reference to a blob that is gone.
    if (replacedKey) {
      try {
        await deletePrivate(replacedKey);
      } catch (err) {
        console.error(`booking receipt: stale blob left at ${replacedKey}`, err);
      }
    }

    // A cancel that landed between verifyBookingAccess and the CAS above: the
    // guard at the top of the try read a snapshot, the mutator copied
    // `cancelledAt` forward, and what committed is a cancelled booking with a
    // receipt attached. The blob stays (deleteBooking removes it by the key on
    // the record, which is now this one) and the record is correct; what must
    // not happen is the confirmation pair going out for a session that no
    // longer exists, or toPublicView throwing on a cancelled record and turning
    // a committed upload into a bare 500. Collapse to the same invalid-link the
    // client would get by reloading the page.
    if (updated.cancelledAt) return fail("invalid-link", 404);

    // The first transition to green, and the only one that tells anybody. The
    // push goes out on exactly the same condition as the mails and from exactly
    // the same place, because a second definition of "confirmed" is how the two
    // eventually disagree.
    //
    // Run together rather than in sequence: both are best-effort, both are past
    // the commit, and NEITHER CAN REJECT — sendBookingEmails and
    // notifyAdminDevices each return their failures instead of throwing, which
    // is what makes this Promise.all safe. The client is holding a spinner, so
    // they cost max(push, mail) rather than the sum; the mail half does a second
    // record write against Brevo and is the slow one.
    if (!sawPriorReceipt && deriveStatus(updated) === "confirmed") {
      await Promise.all([
        notifyAdminDevices(`booking ${updated.id} confirmed by receipt`),
        logEmails(updated, ["ownerConfirmed", "clientConfirmed"]),
      ]);
    }

    // Past the commit and past the mails, so this must not throw: see the
    // helper. A 500 here would tell a client their comprobante failed to
    // upload when the booking is already holding it.
    return NextResponse.json(
      { ok: true, view: await viewOf(updated) },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      console.error("booking receipt: bookings are not configured", err);
      return fail("bookings-not-configured", 503);
    }
    if (err instanceof BookingConflictError) {
      console.error("booking receipt: record contention", err);
      return fail("conflict", 409);
    }
    console.error("booking receipt: failed to store receipt", err);
    return fail("store-failed", 500);
  }
}
