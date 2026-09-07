/**
 * The receipt proxy: the only way bank-transfer bytes ever reach a browser.
 *
 * GET streams the private object through this handler. No presigned GET is
 * minted and no public URL exists for the bucket, so the bytes are readable
 * exactly as long as the admin session is valid and not one second longer —
 * a presigned URL, by contrast, would keep working after logout, in a browser
 * history, and in anything the admin pasted it into.
 *
 * Three response headers are load-bearing, not decoration:
 *   - `Content-Type` comes from the STORED enum, which receipt-validate.ts
 *     sniffed from the file's magic bytes at upload time. The type the
 *     uploading browser declared is never consulted, here or there.
 *   - `X-Content-Type-Options: nosniff` stops the browser from second-guessing
 *     that enum and rendering a mislabelled file as something executable.
 *   - `Content-Security-Policy: default-src 'none'; sandbox` is per-response
 *     and applies to the receipt document itself: a PDF that turns out to hold
 *     script can load nothing, reach nothing and run nothing.
 *
 * POST attaches a receipt the STUDIO holds. Clients send proof by WhatsApp at
 * least as often as they upload it, and a comprobante sitting in a chat is one
 * the booking does not have. Every check the client's own upload route makes on
 * the bytes is made here too — and for the same reasons, so read that file's
 * header for them: the content-length pre-check, the real byte length re-checked
 * after the read, the content type decided by `sniffReceipt` from the magic
 * bytes with the declared type consulted nowhere, the content-addressed key, and
 * the same `putPrivateBytes`. An admin cookie says who is uploading, never what
 * is in the file.
 *
 * Three things the client route does that this one deliberately does not:
 *
 *   - NO RATE LIMIT AND NO HONEYPOT. Those exist because a booking link is held
 *     by a stranger; this handler is behind `assertAdminApi`, and a limiter on
 *     it would only ever fire on the studio.
 *   - NO STATE LOCK. The client may not replace a receipt on a green booking,
 *     because for them a receipt is evidence they already paid. The admin may:
 *     they are fixing their own mistake — the wrong screenshot, the wrong
 *     booking — not paying anything, and refusing them would leave the wrong
 *     file on the record with delete-then-reupload as the only way out.
 *   - NO EMAIL. The confirmation pair fires when a CLIENT's upload turns a
 *     booking green, because they just did something and deserve an answer. Here
 *     the studio is the one uploading, so the owner mail would tell them what
 *     they just did, and the client mail would confirm an action they did not
 *     take — for a transfer they made days ago, in an inbox where it reads as a
 *     duplicate. The studio tells them in the same WhatsApp chat the proof
 *     arrived in.
 *
 * DELETE reopens a confirmed booking. Blob first, reference second — the same
 * order deleteBooking() uses, and for the same reason: a failure between the
 * two leaves a record pointing at an object that is gone (a 404 in the preview,
 * fixed by deleting again), while the other order leaves bank data in the
 * bucket that nothing points at and nobody will ever come back for.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { sha256Hex } from "@/lib/booking-crypto";
import {
  BookingConflictError,
  getBooking,
  mutateBooking,
  receiptKey,
  toAdminAppointment,
} from "@/lib/bookings-store";
import {
  BOOKING_ID_RE,
  RECEIPT_MAX_BYTES,
  sanitizeFilename,
} from "@/lib/bookings-types";
import {
  BookingsNotConfiguredError,
  deletePrivate,
  getPrivateStream,
  putPrivateBytes,
} from "@/lib/r2-private";
import { sniffReceipt, type SniffedReceipt } from "@/lib/receipt-validate";

export const runtime = "nodejs";
/**
 * For POST: a 4 MB upload plus a blob write plus the record's compare-and-swap,
 * behind one tap on a studio phone. GET and DELETE never come near this ceiling
 * — it is a route-level setting and they share it harmlessly.
 */
export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE = { "cache-control": "no-store" };

function ok(body: Record<string, unknown>): Response {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

function fail(error: string, status: number, message?: string): Response {
  return NextResponse.json(
    message ? { error, message } : { error },
    { status, headers: NO_STORE },
  );
}

function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof BookingConflictError) return fail("conflict", 409, err.message);
  console.error(`bookings: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/** Checked before any key is built — the id is interpolated into an R2 path. */
function rejectBadId(id: string): Response | null {
  return BOOKING_ID_RE.test(id)
    ? null
    : fail("bad-id", 400, "That is not a booking id.");
}

export async function GET(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  try {
    const record = await getBooking(id);
    if (!record) return fail("not-found", 404, "No booking with that id.");
    if (!record.receipt) {
      return fail("not-found", 404, "This booking has no receipt on file.");
    }

    const object = await getPrivateStream(record.receipt.key);
    if (!object) {
      return fail("not-found", 404, "The receipt file is missing from storage.");
    }

    // The id already matched BOOKING_ID_RE and the extension comes from a
    // four-value enum, so the filename needs no quoting beyond this.
    const filename = `receipt-${id}.${record.receipt.ext}`;
    return new Response(object.body, {
      status: 200,
      headers: {
        "content-type": record.receipt.contentType,
        ...(object.contentLength > 0
          ? { "content-length": String(object.contentLength) }
          : {}),
        "content-disposition": `inline; filename="${filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    return storeFailure(err, `GET /api/admin/bookings/${id}/receipt`);
  }
}

/**
 * Everything decidable from the bytes alone, lifted rung for rung from the
 * client route so the two paths cannot drift apart. Returned rather than sent,
 * because the caller owns this file's error shape.
 */
type PreparedUpload =
  | {
      ok: true;
      filename: string;
      bytes: Uint8Array;
      sniffed: SniffedReceipt;
      sha256: string;
    }
  | { ok: false; res: Response };

async function prepareUpload(form: FormData): Promise<PreparedUpload> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, res: fail("invalid-body", 400, "No file was sent.") };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, res: fail("too-large", 413, "That file is too big.") };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The only size number that is a fact rather than a claim: `content-length`
  // and `File.size` are both assertions made by the sender.
  if (bytes.byteLength > RECEIPT_MAX_BYTES) {
    return { ok: false, res: fail("too-large", 413, "That file is too big.") };
  }

  // The bytes decide, never `file.type`. Whatever comes back here is what gets
  // stored AND what GET above echoes as the Content-Type, so a .pdf full of
  // HTML is refused now rather than served back as text/html to Bocha.
  const sniffed = sniffReceipt(bytes);
  if (!sniffed) {
    return {
      ok: false,
      res: fail("unsupported-type", 415, "Send a PDF, JPG, PNG or WebP."),
    };
  }

  return {
    ok: true,
    filename: sanitizeFilename(file.name),
    bytes,
    sniffed,
    sha256: await sha256Hex(bytes),
  };
}

export async function POST(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  // Before req.formData(), which would buffer the whole body: a 50 MB POST is
  // refused for the price of one header read.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > RECEIPT_MAX_BYTES) {
    return fail("too-large", 413, "That file is too big.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid-body", 400, "That was not a file upload.");
  }

  const prepared = await prepareUpload(form);
  if (!prepared.ok) return prepared.res;

  try {
    const record = await getBooking(id);
    if (!record) return fail("not-found", 404, "No booking with that id.");

    // Content-addressed, exactly as the client path builds it: a second tap
    // rewrites the same object instead of orphaning a blob nothing points at,
    // and re-attaching the identical file leaves `replacedKey` unset so nothing
    // is deleted underneath it.
    const key = receiptKey(
      record.id,
      prepared.sha256.slice(0, 16),
      prepared.sniffed.ext,
    );
    await putPrivateBytes(key, prepared.bytes, prepared.sniffed.contentType);

    const nowIso = new Date().toISOString();
    let replacedKey: string | undefined;

    const updated = await mutateBooking(record.id, (current) => {
      // Assigned inside the mutator and read only after the CAS commits, so it
      // describes the record the WINNING attempt saw — a lost race must not
      // delete the blob the winner just attached. The return value below still
      // depends only on the argument.
      replacedKey =
        current.receipt && current.receipt.key !== key ? current.receipt.key : undefined;
      return {
        ...current,
        receipt: {
          key,
          filename: prepared.filename,
          contentType: prepared.sniffed.contentType,
          ext: prepared.sniffed.ext,
          bytes: prepared.bytes.byteLength,
          sha256: prepared.sha256,
          uploadedAt: nowIso,
        },
      };
    });

    // After the record commits, like the client route: a failure here is a
    // stale blob nobody references rather than a reference to a blob that is
    // gone. Best effort for the same reason every other blob delete here is.
    if (replacedKey) {
      try {
        await deletePrivate(replacedKey);
      } catch (err) {
        console.error(`bookings: stale receipt blob left at ${replacedKey}`, err);
      }
    }

    return ok({ ok: true, appointment: await toAdminAppointment(updated) });
  } catch (err) {
    return storeFailure(err, `POST /api/admin/bookings/${id}/receipt`);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  try {
    const record = await getBooking(id);
    if (!record) return fail("not-found", 404, "No booking with that id.");

    if (record.receipt) {
      // Best-effort, like every other blob delete in this feature: R2 may
      // already have lost it, and that must not stop the reference from being
      // cleared and the booking from reopening.
      try {
        await deletePrivate(record.receipt.key);
      } catch (err) {
        console.error(`bookings: failed to delete receipt blob for ${id}`, err);
      }
    }

    // Pure, and a no-op when there is nothing to clear: returning the same
    // reference tells mutateBooking() to skip the write entirely.
    const updated = await mutateBooking(id, (current) =>
      current.receipt ? { ...current, receipt: undefined } : current,
    );
    return ok({ ok: true, appointment: await toAdminAppointment(updated) });
  } catch (err) {
    return storeFailure(err, `DELETE /api/admin/bookings/${id}/receipt`);
  }
}
