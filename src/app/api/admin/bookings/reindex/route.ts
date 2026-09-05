/**
 * Rebuild the month indexes from the records themselves.
 *
 * The index is derived data and every write to it elsewhere is best-effort, so
 * this route is the repair path that makes that safe: whatever a failed index
 * write dropped, a rebuild puts back. It is also the only place in the feature
 * where an index failure is reported rather than logged and swallowed — an
 * explicit repair that answers `ok` while having written nothing is worse than
 * an error.
 *
 * With no `months` it rebuilds every month that has a booking. With an explicit
 * list it rebuilds exactly those, which is the only way to empty the index of a
 * month whose bookings all moved away — a full rebuild never visits a month
 * that no record points at any more.
 *
 * `maxDuration` is raised because the no-argument path lists the whole records
 * prefix and GETs every object under it.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { BookingConflictError, rebuildMonthIndexes } from "@/lib/bookings-store";
import { MONTH_RE } from "@/lib/bookings-types";
import { BookingsNotConfiguredError, PreconditionFailed } from "@/lib/r2-private";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  // Unlike a record mutation, an index write that keeps losing its conditional
  // race surfaces as the raw PreconditionFailed — two admins pressed Reindex at
  // the same time, and either one of them may simply press it again.
  if (err instanceof BookingConflictError || err instanceof PreconditionFailed) {
    return fail("conflict", 409, err.message);
  }
  console.error(`bookings: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  // "Rebuild everything" is the common call and sends no body at all, so an
  // unparseable one is treated as an empty request rather than as an error.
  const raw: unknown = await req.json().catch(() => null);
  const body =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  let months: string[] | undefined;
  const declared: unknown = body.months;
  if (declared !== undefined && declared !== null) {
    if (!Array.isArray(declared)) {
      return fail("bad-month", 400, "`months` must be an array of YYYY-MM strings.");
    }
    const entries: unknown[] = declared;
    const list: string[] = [];
    for (const entry of entries) {
      // Matched before monthKey() interpolates it into an R2 object key.
      if (typeof entry !== "string" || !MONTH_RE.test(entry)) {
        return fail("bad-month", 400, "Every entry in `months` must be a YYYY-MM string.");
      }
      if (!list.includes(entry)) list.push(entry);
    }
    months = list;
  }

  try {
    const result = await rebuildMonthIndexes(months);
    return ok({ ok: true, months: result.months, records: result.records });
  } catch (err) {
    return storeFailure(err, "POST /api/admin/bookings/reindex");
  }
}
