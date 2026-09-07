/**
 * Trip domain types + the two pure lookups that make a trip mean anything.
 *
 * No `server-only` import, exactly like bookings-types.ts: the month grid, the
 * agenda and the booking form all resolve a day to its trip while rendering, so
 * this file must stay free of the S3 SDK and of every Node built-in.
 *
 * Dates here are plain "YYYY-MM-DD" calendar dates, INCLUSIVE at both ends, and
 * that is a decision rather than a shortcut. "I am in Berlin from the 10th to
 * the 20th" is a statement about days, not about instants: storing it as a pair
 * of timestamps would force a zone onto it — the studio's? Berlin's? the
 * viewer's? — and buy an off-by-one at whichever boundary the three disagree.
 * As zero-padded strings they sort and compare chronologically on their own, so
 * matching a trip against a booking's typed date is two `<=` with no timezone
 * maths anywhere and both endpoints unambiguously in.
 *
 * Nothing here decides anything for a booking. A trip PROPOSES a zone to a new
 * appointment and QUESTIONS one that disagrees; the zone on the record stays
 * the source of truth, which is why moving a trip's dates can never rewrite an
 * appointment already made.
 */

export type Trip = {
  /** "tr_" + 22 base64url chars from 16 CSPRNG bytes. An identifier, not a credential. */
  id: string;
  /** What the band on the calendar reads — "Berlín". Trimmed, <= TRIP_LABEL_MAX. */
  label: string;
  /** IANA zone. Proposed to new bookings inside the range; never written onto one. */
  timeZone: string;
  /** "YYYY-MM-DD", inclusive. */
  startDate: string;
  /** "YYYY-MM-DD", inclusive. Never before `startDate` — trips-store.ts refuses that. */
  endDate: string;
  createdAt: string; // UTC ISO, immutable
  updatedAt: string; // UTC ISO
};

/** Every trip in one object. See trips-store.ts for why one and not many. */
export type TripsDoc = { version: 1; trips: Trip[]; updatedAt: string };

export const TRIP_ID_RE = /^tr_[A-Za-z0-9_-]{22}$/;

/**
 * Shape only. "2026-02-31" passes this and is the routes' problem: a regex that
 * knew about February would still not know about leap years, and every consumer
 * of a date in here treats it as an opaque sortable string.
 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TRIP_LABEL_MAX = 40;

/** Inclusive both ends, plain string compare. */
export function tripCoversDate(trip: Trip, dayKey: string): boolean {
  return trip.startDate <= dayKey && dayKey <= trip.endDate;
}

/**
 * The trip governing a date: latest startDate wins when several overlap.
 *
 * Total by design — `null` for the empty list and for the many days that are
 * not a trip at all, because every caller renders something for those and none
 * of them should have to guard a throw first.
 *
 * Overlaps are deliberately allowed (plans change, and a half-corrected range
 * is the normal shape of that), so a day covered twice needs a rule: the trip
 * that STARTS LATEST wins, being the more recently-decided plan.
 */
export function tripForDate(trips: Trip[], dayKey: string): Trip | null {
  let best: Trip | null = null;
  for (const trip of trips) {
    if (!tripCoversDate(trip, dayKey)) continue;
    if (!best || decidedAfter(trip, best)) best = trip;
  }
  return best;
}

/**
 * A total order, so the answer never depends on the order the array happened to
 * arrive in — two admins would otherwise see different defaults for the same
 * day. `startDate` is the rule that matters; `createdAt` then `id` only exist
 * to make the remaining ties deterministic.
 */
function decidedAfter(candidate: Trip, best: Trip): boolean {
  if (candidate.startDate !== best.startDate) return candidate.startDate > best.startDate;
  if (candidate.createdAt !== best.createdAt) return candidate.createdAt > best.createdAt;
  return candidate.id > best.id;
}
