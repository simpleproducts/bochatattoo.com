/**
 * Revoke every link ever issued for one booking.
 *
 * One integer: `tokenEpoch + 1`. The token is an HMAC over [1, id, epoch], and
 * verifyBookingAccess() refuses any token whose epoch is behind the record's,
 * so bumping it kills every outstanding link at once with no pointer objects,
 * no sweep and nothing to garbage-collect.
 *
 * The response carries a full AdminAppointment because toAdminAppointment()
 * re-mints the token on every read: the sheet's link block is permanent, and
 * "show me that link again" costs one HMAC rather than a rotation. This route
 * is only for when Bocha sent the link to the wrong person.
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
import { BookingsNotConfiguredError } from "@/lib/r2-private";

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

export async function POST(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  // Checked before any key is built — the id is interpolated into an R2 path.
  if (!BOOKING_ID_RE.test(id)) {
    return fail("bad-id", 400, "That is not a booking id.");
  }

  try {
    // Read first so a missing booking is a 404 rather than the plain Error
    // mutateBooking throws when the record is not there.
    if (!(await getBooking(id))) {
      return fail("not-found", 404, "No booking with that id.");
    }
    // Pure: the increment reads the epoch off the record it was handed, so a
    // CAS retry bumps the fresh value once rather than replaying a stale one.
    const updated = await mutateBooking(id, (current) => ({
      ...current,
      tokenEpoch: current.tokenEpoch + 1,
    }));
    return ok({ ok: true, appointment: await toAdminAppointment(updated) });
  } catch (err) {
    return storeFailure(err, `POST /api/admin/bookings/${id}/link`);
  }
}
