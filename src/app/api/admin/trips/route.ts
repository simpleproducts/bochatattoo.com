/**
 * The trips collection: read them all, add one.
 *
 * A trip is a named date range that says "between these dates I am in Berlin".
 * It PROPOSES a zone to a new appointment on one of those days and QUESTIONS
 * one that disagrees; it never writes a zone onto a booking. Nothing in these
 * handlers touches a booking, and nothing ever should — see the note on PATCH
 * in ./[id]/route.ts.
 *
 * Two things a reader should not have to reverse-engineer:
 *
 *   - everything is validated BEFORE the store is called, exactly as in
 *     ../bookings/route.ts, and for a sharper reason here: src/lib/trips-store.ts
 *     deliberately validates nothing editorial, so a bad label or an unknown
 *     zone that gets past this file is written to the document and stays there.
 *     An invalid IANA zone in particular is silent — it only throws later, when
 *     the calendar formats the day it governs.
 *   - the two dates are plain "YYYY-MM-DD" calendar dates, inclusive at both
 *     ends, and are checked for shape, for existing at all, and for order. A
 *     reversed range covers no day (tripCoversDate() compares both ends), so it
 *     would sit in the panel looking correct while proposing nothing, forever.
 *
 * The validators below are duplicated in ./[id]/route.ts rather than shared. A
 * Next route module may only export HTTP handlers, so there is nowhere both
 * files can import them from without adding a library file outside this change
 * — the same trade the bookings routes already make.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { isValidTimeZone } from "@/lib/bookings-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import { createTrip, listTrips, TripConflictError } from "@/lib/trips-store";
import { DATE_RE, TRIP_LABEL_MAX } from "@/lib/trips-types";

export const runtime = "nodejs";

/** Token-scoped admin data behind a CDN — never cached, on any response. */
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

/**
 * One catch for both handlers, mapping the same three failures the bookings
 * routes do: missing env is a 503 the calendar renders as a config panel, a
 * lost compare-and-swap race is a 409 the panel can simply retry, and anything
 * else is R2 misbehaving. The message rides along, which is safe here in a way
 * it would not be on a public route — this handler is behind assertAdminApi().
 */
function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof TripConflictError) return fail("conflict", 409, err.message);
  console.error(`trips: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/* ────────────────────────── body validation ────────────────────────── */

type LabelResult = { ok: true; label: string } | { ok: false; response: Response };

/** Stored trimmed: the label is drawn as a band on the calendar, not parsed. */
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
 * Unlike a booking's zone, this one may not be blank. A booking with no zone
 * reads back as the studio's, which is a sensible "nobody picked one"; a trip
 * exists ONLY to name the zone it proposes, so one without a zone would be a
 * band on the calendar that does nothing at all.
 *
 * The rejected value is not echoed back — it is an arbitrary-length string from
 * the wire, and the panel already knows which field it sent.
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

/**
 * DATE_RE is shape only — by design, says trips-types.ts, which hands the rest
 * to us. So this also asks whether the date EXISTS: "2026-02-31" is the right
 * shape, sorts and compares like any other date, and matches no day key any
 * calendar can produce, which would make a trip that silently covers a day
 * fewer than it reads as. Round-tripping through Date is the cheapest check
 * that knows about February and about leap years.
 */
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

/** Both ends are inclusive, so equal dates are a legitimate one-day trip. */
function rejectReversedRange(startDate: string, endDate: string): Response | null {
  return endDate < startDate
    ? fail("bad-range", 400, "A trip cannot end before it starts.")
    : null;
}

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/* ────────────────────────── handlers ────────────────────────── */

export async function GET(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  try {
    // Already sorted by startDate ascending, and an absent document is an empty
    // list rather than a 404: no trip yet is a normal state, not a failure.
    return ok({ ok: true, trips: await listTrips() });
  } catch (err) {
    return storeFailure(err, "GET /api/admin/trips");
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  // All four fields are required on create — a trip is the whole tuple or it
  // proposes nothing. PATCH is what allows a partial.
  const label = readLabel(body.label);
  if (!label.ok) return label.response;

  const timeZone = readTimeZone(body.timeZone);
  if (!timeZone.ok) return timeZone.response;

  const startDate = readDate(body.startDate, "startDate");
  if (!startDate.ok) return startDate.response;

  const endDate = readDate(body.endDate, "endDate");
  if (!endDate.ok) return endDate.response;

  const reversed = rejectReversedRange(startDate.date, endDate.date);
  if (reversed) return reversed;

  try {
    const trip = await createTrip({
      label: label.label,
      timeZone: timeZone.timeZone,
      startDate: startDate.date,
      endDate: endDate.date,
    });
    return ok({ ok: true, trip }, 201);
  } catch (err) {
    return storeFailure(err, "POST /api/admin/trips");
  }
}
