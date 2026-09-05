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
 * DELETE reopens a confirmed booking. Blob first, reference second — the same
 * order deleteBooking() uses, and for the same reason: a failure between the
 * two leaves a record pointing at an object that is gone (a 404 in the preview,
 * fixed by deleting again), while the other order leaves bank data in the
 * bucket that nothing points at and nobody will ever come back for.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import {
  BookingConflictError,
  getBooking,
  mutateBooking,
  toAdminAppointment,
} from "@/lib/bookings-store";
import { BOOKING_ID_RE } from "@/lib/bookings-types";
import {
  BookingsNotConfiguredError,
  deletePrivate,
  getPrivateStream,
} from "@/lib/r2-private";

export const runtime = "nodejs";

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
