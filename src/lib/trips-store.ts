/**
 * The trips persistence layer — the sibling of src/lib/bookings-store.ts, and
 * the only module that knows where trips live.
 *
 * One object, in the PRIVATE bucket:
 *   bookings/trips.json       every trip, as a TripsDoc
 *
 * Four constraints a reader should not have to reverse-engineer:
 *
 * 1. ONE document, not one per trip. There are a handful of trips a year and
 *    every consumer wants all of them at once — the calendar resolves a default
 *    zone per day while rendering a month — so a per-trip key layout would buy
 *    a LIST plus N GETs on every page load to answer a question one small
 *    object already answers. The cost is that every write is a write of the
 *    whole list, which is exactly why (2) exists.
 *
 * 2. Every write is a compare-and-swap (`IfMatch` on the ETag read a moment
 *    earlier), never a plain read-modify-write, for the same reason
 *    mutateBooking() is: writers genuinely race. Here they are two admin tabs
 *    rather than an admin and a client, but the whole list is in the body, so a
 *    last-write-wins PUT would not lose a field — it would lose a whole trip.
 *    mutateTrips() re-reads and re-applies instead, which is why its mutator
 *    must be PURE.
 *
 * 3. `IfNoneMatch: "*"` when the document does not exist yet, so the very first
 *    trip cannot be created twice: two admins adding one at the same moment
 *    would otherwise both write a one-trip document and one of them would
 *    silently disappear. Unlike the month index in bookings-store.ts, an empty
 *    result is NOT written back — an absent document costs nothing to read and
 *    there is no scan to avoid.
 *
 * 4. Nothing is validated here. Labels, IANA zones and date shapes are the
 *    routes' job, exactly as they are for bookings. The one exception is
 *    structural rather than editorial and is enforced below: endDate is never
 *    before startDate.
 */
import "server-only";
import { randomBase64Url } from "./booking-crypto";
import type { Trip, TripsDoc } from "./trips-types";
import { getPrivateJson, putPrivateJson, PreconditionFailed } from "./r2-private";

/** The whole store. Under bookings/ because a trip only means anything to them. */
const TRIPS_KEY = "bookings/trips.json";

/** Retry delays for a refused conditional write, in ms. 4 attempts total. */
const RETRY_BACKOFF_MS = [50, 120, 300];

export class TripConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripConflictError";
  }
}

/** 16 CSPRNG bytes → 22 base64url chars, so the result matches TRIP_ID_RE. */
function newTripId(): string {
  return `tr_${randomBase64Url(16)}`;
}

/* ────────────────────────── reads ────────────────────────── */

/**
 * Every trip, sorted by startDate ascending. A 404 is an empty list and nothing
 * else — getPrivateJson() swallows only a genuine "never written" and rethrows
 * a credentials or connectivity failure, so "no trips yet" can never be the
 * story a broken bucket tells.
 */
export async function listTrips(): Promise<Trip[]> {
  const found = await getPrivateJson<TripsDoc>(TRIPS_KEY);
  return sortByStart(found?.data.trips ?? []);
}

/* ────────────────────────── writes ────────────────────────── */

/**
 * What a mutator hands back: the list to store, and the value the caller wanted
 * out of the operation. The document holds every trip but a mutation is always
 * about ONE, and the caller cannot compute it outside the loop — the merged
 * trip in updateTrip() depends on the version that was actually read.
 */
type Mutation<T> = { trips: Trip[]; result: T };

/**
 * Conditional read-modify-write of the whole document.
 *
 * `apply` MUST be a pure function of the list it is handed. It is re-run from
 * scratch on every retry against a freshly-read list, so it may not close over
 * a list read earlier, mutate its argument, or depend on how many times it has
 * run — which is why the callers below mint ids and timestamps ONCE, before the
 * loop, and let the mutator close over the constants. Returning the SAME ARRAY
 * REFERENCE means "no change" and skips the write entirely.
 *
 * The document's `updatedAt` is stamped here on every committed write so no
 * mutator can forget it. After 4 refused attempts this throws
 * TripConflictError; the routes turn that into a "someone else was editing"
 * answer rather than a 500.
 */
async function mutateTrips<T>(apply: (current: Trip[]) => Mutation<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const found = await getPrivateJson<TripsDoc>(TRIPS_KEY);
    const current = found?.data.trips ?? [];

    const { trips, result } = apply(current);
    if (trips === current) return result;

    const doc: TripsDoc = {
      version: 1,
      trips,
      updatedAt: new Date().toISOString(),
    };
    try {
      await putPrivateJson(
        TRIPS_KEY,
        doc,
        found ? { ifMatch: found.etag } : { ifNoneMatch: "*" },
      );
      return result;
    } catch (err) {
      // Only a refused precondition is retryable; anything else is R2 being
      // down or misconfigured and retrying it just delays the error.
      if (!(err instanceof PreconditionFailed)) throw err;
      if (attempt >= RETRY_BACKOFF_MS.length) {
        throw new TripConflictError(
          `Trips were modified by someone else ${attempt + 1} times in a row.`,
        );
      }
      await sleep(jittered(RETRY_BACKOFF_MS[attempt]));
    }
  }
}

export type CreateTripInput = {
  label: string;
  timeZone: string;
  startDate: string;
  endDate: string;
};

/**
 * Add a trip. The id and both timestamps are minted BEFORE the CAS loop, not
 * inside the mutator: a retry re-runs `apply`, and a mutator that called
 * randomBase64Url() would hand back a different trip each attempt.
 */
export async function createTrip(input: CreateTripInput): Promise<Trip> {
  assertOrderedRange(input.startDate, input.endDate);
  const now = new Date().toISOString();
  const trip: Trip = {
    id: newTripId(),
    label: input.label,
    timeZone: input.timeZone,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: now,
    updatedAt: now,
  };
  return mutateTrips((trips) => ({ trips: [...trips, trip], result: trip }));
}

/**
 * Patch one trip. Only the four editable fields; `id` and `createdAt` are
 * whatever the stored trip already said, so nothing a route passes can rewrite
 * them.
 *
 * A missing id throws — this must return a Trip and there is none, so callers
 * that owe a 404 read with listTrips() first. Note what does NOT happen here:
 * moving a trip's dates touches no booking. The zone on an appointment is the
 * source of truth and a trip only ever proposed it, so a range corrected in
 * March cannot silently re-time a session booked in February.
 */
export async function updateTrip(
  id: string,
  patch: Partial<CreateTripInput>,
): Promise<Trip> {
  const now = new Date().toISOString();
  return mutateTrips((trips) => {
    const at = trips.findIndex((t) => t.id === id);
    if (at < 0) throw new Error(`Trip ${id} does not exist.`);

    const merged: Trip = { ...trips[at], ...patch, updatedAt: now };
    // Checked on the MERGED range, not on the patch: moving only `endDate`
    // earlier is the easiest way to reverse a range by accident.
    assertOrderedRange(merged.startDate, merged.endDate);

    const next = [...trips];
    next[at] = merged;
    return { trips: next, result: merged };
  });
}

/**
 * Remove a trip. Idempotent, unlike updateTrip(): an id that is not there means
 * the trip is already gone, which is what the admin asked for, and returning
 * the same reference skips the write so two tabs deleting the same trip never
 * fight over the ETag.
 */
export async function deleteTrip(id: string): Promise<void> {
  await mutateTrips((trips) => {
    const next = trips.filter((t) => t.id !== id);
    return {
      trips: next.length === trips.length ? trips : next,
      result: undefined,
    };
  });
}

/* ────────────────────────── helpers ────────────────────────── */

/**
 * The one invariant a store can enforce without knowing what the routes count
 * as a valid date. A reversed range is not a harmless typo: tripCoversDate()
 * compares both ends, so `endDate < startDate` covers NO day at all — the trip
 * would sit on the calendar looking correct while the default zone it exists to
 * propose silently never appeared, with nothing anywhere saying why. Cheap to
 * refuse, invisible if it lands.
 *
 * A plain string compare, which is only meaningful for DATE_RE-shaped values;
 * the routes have already checked the shape by the time anything reaches here.
 */
function assertOrderedRange(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw new Error(
      `Trip range is reversed: endDate ${endDate} is before startDate ${startDate}.`,
    );
  }
}

/** Zero-padded ISO dates sort chronologically as plain strings; these all are. */
function sortByStart(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );
}

// sleep() and jittered() are four lines each and live privately in
// bookings-store.ts too. Copied rather than exported from there: importing them
// would make this module depend on the whole booking record layer to borrow a
// setTimeout, and neither copy has any reason to change.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jitter over [base/2, 1.5 x base) so two racing writers never retry in lockstep. */
function jittered(base: number): number {
  return Math.round(base * (0.5 + Math.random()));
}
