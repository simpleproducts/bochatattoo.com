/**
 * One trip: edit it, delete it.
 *
 * What PATCH does NOT do is the whole point of the feature. Moving a trip's
 * dates, renaming it or changing its zone touches no booking, ever: the zone on
 * an appointment is the source of truth and a trip only ever PROPOSED it, so a
 * range corrected in March cannot silently re-time a session booked in
 * February. The only visible effect on an existing booking is that the form may
 * start (or stop) asking whether its zone is right — a question, never a
 * rewrite.
 *
 * Three constraints worth stating outright:
 *
 *   - the id is matched against TRIP_ID_RE before it reaches the store, the way
 *     ../../bookings/[id]/route.ts checks BOOKING_ID_RE. It does not name an R2
 *     key here — trips share one document — but it is still a caller-chosen
 *     string used to select a record, and a shape check costs nothing.
 *   - every field is validated out here, before mutateTrips() is entered. Its
 *     mutator is re-run from scratch on each compare-and-swap retry and must
 *     stay PURE, so it may only assign values this pass already checked.
 *   - the range is checked MERGED with the stored trip, not as it arrived.
 *     Patching endDate alone is the easiest way to reverse a range by accident,
 *     and the store's own guard for that throws a plain Error — a 500 for what
 *     is an admin's typo, and a 400 with a message the panel can print instead.
 *
 * The validators below are duplicated from ../route.ts rather than shared, for
 * the reason its header gives: a Next route module may only export HTTP
 * handlers.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { isValidTimeZone } from "@/lib/bookings-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import {
  deleteTrip,
  listTrips,
  TripConflictError,
  updateTrip,
  type CreateTripInput,
} from "@/lib/trips-store";
import { DATE_RE, TRIP_ID_RE, TRIP_LABEL_MAX } from "@/lib/trips-types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE = { "cache-control": "no-store" };

function ok(body: Record<string, unknown>, status = 200): Response {
  return NextResponse.json(body, { status, headers: NO_STORE });
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
  if (err instanceof TripConflictError) return fail("conflict", 409, err.message);
  console.error(`trips: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/** Checked before the store is asked anything — see the header block. */
function rejectBadId(id: string): Response | null {
  return TRIP_ID_RE.test(id) ? null : fail("bad-id", 400, "That is not a trip id.");
}

const NOT_FOUND = "No trip with that id.";

/* ────────────────────────── body validation ────────────────────────── */

type LabelResult = { ok: true; label: string } | { ok: false; response: Response };

function readLabel(raw: unknown): LabelResult {
  if (typeof raw !== "string") {
    return { ok: false, response: fail("bad-label", 400, "`label` must be a string.") };
  }
  const label = raw.trim();
  if (!label) {
    return { ok: false, response: fail("bad-label", 400, "A trip needs a name.") };
  }
  if (label.length > TRIP_LABEL_MAX) {
    return {
      ok: false,
      response: fail(
        "bad-label",
        400,
        `A trip name is longer than ${TRIP_LABEL_MAX} characters.`,
      ),
    };
  }
  return { ok: true, label };
}

type TimeZoneResult = { ok: true; timeZone: string } | { ok: false; response: Response };

/**
 * Blank is refused rather than collapsed to the studio zone: a trip whose zone
 * is empty proposes nothing, so clearing the field is not an erase — it is a
 * delete, which DELETE below already does.
 */
function readTimeZone(raw: unknown): TimeZoneResult {
  if (typeof raw !== "string") {
    return {
      ok: false,
      response: fail("bad-timezone", 400, "`timeZone` must be an IANA zone name."),
    };
  }
  const timeZone = raw.trim();
  if (!timeZone || !isValidTimeZone(timeZone)) {
    return {
      ok: false,
      response: fail("bad-timezone", 400, "That is not a time zone Intl knows."),
    };
  }
  return { ok: true, timeZone };
}

type DateResult = { ok: true; date: string } | { ok: false; response: Response };

/** Shape, then existence: "2026-02-31" passes DATE_RE and is not a day. */
function readDate(raw: unknown, field: "startDate" | "endDate"): DateResult {
  const date = typeof raw === "string" ? raw.trim() : "";
  if (!DATE_RE.test(date) || !isRealDate(date)) {
    return {
      ok: false,
      response: fail("bad-range", 400, `\`${field}\` must be a real YYYY-MM-DD date.`),
    };
  }
  return { ok: true, date };
}

function isRealDate(date: string): boolean {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  // A date that rolled over — 02-31 becoming 03-03 — comes back different.
  return new Date(ms).toISOString().slice(0, 10) === date;
}

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/* ────────────────────────── handlers ────────────────────────── */

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  // A key that is absent means "leave it", and none of the four may be null:
  // there is no field here an admin can empty, only ones they can change.
  const patch: Partial<CreateTripInput> = {};

  if (Object.hasOwn(body, "label")) {
    const read = readLabel(body.label);
    if (!read.ok) return read.response;
    patch.label = read.label;
  }

  if (Object.hasOwn(body, "timeZone")) {
    const read = readTimeZone(body.timeZone);
    if (!read.ok) return read.response;
    patch.timeZone = read.timeZone;
  }

  if (Object.hasOwn(body, "startDate")) {
    const read = readDate(body.startDate, "startDate");
    if (!read.ok) return read.response;
    patch.startDate = read.date;
  }

  if (Object.hasOwn(body, "endDate")) {
    const read = readDate(body.endDate, "endDate");
    if (!read.ok) return read.response;
    patch.endDate = read.date;
  }

  try {
    // Read first, for two answers at once: a missing trip is a 404 rather than
    // the plain Error updateTrip() throws, and the stored range is what a
    // one-ended patch has to be checked against. The store re-reads inside its
    // CAS loop and re-applies the patch there, so this copy is only ever used
    // to decide whether the request is allowed — never to build what is stored.
    const before = (await listTrips()).find((trip) => trip.id === id);
    if (!before) return fail("not-found", 404, NOT_FOUND);

    const startDate = patch.startDate ?? before.startDate;
    const endDate = patch.endDate ?? before.endDate;
    if (endDate < startDate) {
      return fail("bad-range", 400, "A trip cannot end before it starts.");
    }

    return ok({ ok: true, trip: await updateTrip(id, patch) });
  } catch (err) {
    return storeFailure(err, `PATCH /api/admin/trips/${id}`);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  try {
    // Idempotent, unlike the bookings route's DELETE, which 404s on a record
    // that is already gone. There the id names data that may still exist to be
    // recovered; here the admin's intent — "this trip should not be in the
    // list" — is equally satisfied either way, and two open panels deleting the
    // same trip should not leave one of them looking at an error. deleteTrip()
    // no-ops on an unknown id without writing, so this costs one read.
    await deleteTrip(id);
    return ok({ ok: true });
  } catch (err) {
    return storeFailure(err, `DELETE /api/admin/trips/${id}`);
  }
}
