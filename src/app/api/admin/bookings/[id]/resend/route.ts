/**
 * Send one booking email again.
 *
 * This project has no scheduler (`vercel.json` is empty), so a failed send is
 * never retried by machinery — it lands in `emails.lastError`, shows up in the
 * sheet, and Bocha presses a button. This is that button.
 *
 * sendBookingEmails() never throws, so a dead mailer does not become a 500 on
 * the one control whose entire purpose is recovering from a dead mailer. The
 * outcome rides back on the appointment instead: a fresh timestamp under the
 * kind that went out, or a `lastError` the sheet renders next to it. Persist
 * after the send, exactly as every other email path in this feature does.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { sendBookingEmails } from "@/lib/booking-emails";
import {
  BookingConflictError,
  getBooking,
  mutateBooking,
  toAdminAppointment,
} from "@/lib/bookings-store";
import { BOOKING_ID_RE, type BookingEmailKind } from "@/lib/bookings-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** The four kinds, spelled out so an unknown one is a 400 rather than a no-op. */
const EMAIL_KINDS: BookingEmailKind[] = [
  "clientSubmitted",
  "ownerSubmitted",
  "ownerConfirmed",
  "clientConfirmed",
];

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

  const raw: unknown = await req.json().catch(() => null);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("invalid-body", 400, "Request body must be a JSON object.");
  }
  const declared = (raw as Record<string, unknown>).kind;
  if (typeof declared !== "string") {
    return fail("invalid-body", 400, "`kind` must be a string.");
  }
  const kind = EMAIL_KINDS.find((k) => k === declared);
  if (!kind) {
    return fail("invalid-body", 400, `kind must be one of ${EMAIL_KINDS.join(", ")}.`);
  }

  try {
    const record = await getBooking(id);
    if (!record) return fail("not-found", 404, "No booking with that id.");

    const patch = await sendBookingEmails(record, [kind]);
    // Pure: `patch` is captured, so a CAS retry merges the same log entries
    // rather than sending the email a second time.
    const updated = await mutateBooking(id, (current) => ({
      ...current,
      emails: { ...current.emails, ...patch },
    }));
    return ok({ ok: true, appointment: await toAdminAppointment(updated) });
  } catch (err) {
    return storeFailure(err, `POST /api/admin/bookings/${id}/resend`);
  }
}
