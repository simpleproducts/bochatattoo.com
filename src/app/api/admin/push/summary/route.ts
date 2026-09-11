/**
 * GET /api/admin/push/summary — the only thing the service worker is told.
 *
 * A push arrives with an EMPTY body (see src/lib/push.ts). The worker wakes,
 * fetches this with the admin's own cookie, and builds a notification from what
 * is true right now. That is the whole reason a contentless message is enough,
 * and it is why this route exists rather than the push carrying a payload.
 *
 * FOUR CONSTRAINTS, ALL OF THEM BECAUSE OF WHO THE CALLER IS:
 *
 *   - IT IS TINY, AND STAYS TINY. Everything in the body IS rendered on a
 *     phone's lock screen. So: a title, one line, and a fixed path. No email
 *     address, no phone number, no deposit amount, no booking id. The tap target
 *     is the calendar rather than a deep link for exactly that reason.
 *
 *   - IT RENDERS THE TEXT ITSELF, rather than shipping `{ awaiting, latest }`
 *     for the worker to write a sentence from. A service worker has no bundle,
 *     so it cannot import src/i18n/admin.ts, and it cannot read the
 *     `ba_admin_locale` cookie that chooses between the two dictionaries — it
 *     would be stuck with the PHONE's language. This request arrives with the
 *     admin's own cookie, so this is the only side that knows the real answer.
 *
 *   - IT IS `no-store`. It is admin state behind a CDN, and a notification
 *     built from a cached copy is a notification that lies.
 *
 *   - IT IS BOUNDED. The worker gets a few seconds from iOS before the wake-up
 *     is over, so this reads a THREE-MONTH window — the current UTC month and
 *     the next two — and not the whole bucket. listMonths() rebuilds a missing
 *     month index by scanning every record, which self-heals on the first read
 *     but is not something to invite four times over.
 *
 *   - IT NEVER HAS TO SUCCEED. The worker shows a notification either way; a
 *     failure here just means it shows the generic one. That is stated here
 *     because it is what licenses the narrow window above: a booking outside it
 *     does not lose its push, it loses only the specific wording.
 *
 * WHAT "UPCOMING" MEANS, ONCE, FOR BOTH FIELDS: not cancelled, inside the
 * window, and not finished — `endsAt` still in the future. `awaiting` counts the
 * ones that are not green yet; `latest` is the most recently CHANGED of them.
 * On the wake-up a push causes, `latest` is the booking that just turned green,
 * because the push is sent immediately after that record commits.
 *
 * There is no POST here and no state: this route reads and renders, and the
 * worker does nothing but display what comes back — which is what keeps its own
 * hardcoded copy down to the two strings it shows when this fetch fails.
 */
import { NextResponse } from "next/server";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { readAdminLocale } from "@/lib/admin-locale";
import { assertAdminApi } from "@/lib/admin-auth";
import { deriveStatus } from "@/lib/booking-status";
import {
  formatDayLong,
  formatTimeRange,
  monthKeyOf,
  recordTimeZone,
  shiftMonth,
} from "@/lib/booking-time";
import { listMonths } from "@/lib/bookings-store";
import { bookingLabel, type BookingRecord } from "@/lib/bookings-types";
import type { PushSummary } from "@/lib/push-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";

/** The current UTC month plus this many more. See the header for why it is small. */
const MONTHS_AHEAD = 2;

const NO_STORE = { "cache-control": "no-store" };

/**
 * Where a tap lands. A fixed path, never a deep link: an id in this body would
 * be a booking id on a lock screen, and the calendar is one tap from the record
 * anyway. public/admin-push-sw.js uses the same value as its own fallback.
 */
const TAP_TARGET = "/admin/calendar";

function fail(error: string, status: number): Response {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/**
 * Most recently changed first, `id` breaking the tie so two records written in
 * the same millisecond cannot order differently between two reads — a
 * notification that names a different booking on a retry is worse than one that
 * names none.
 */
function changedLast(a: BookingRecord, b: BookingRecord): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * "Juan · Viernes, 14 de marzo de 2026 · 14:00" — the one line the banner shows.
 *
 * The zone is the PLACE the session happens, via recordTimeZone(), never the
 * reader's: `timeZone` is optional on records written before the field existed
 * and that helper is the one fallback every surface in this codebase shares. A
 * notification about a guest spot in Madrid must say the Madrid hour, because
 * that is the hour Bocha has to be there.
 *
 * `bookingLabel` yields a first name, an @handle or an email — one of the three,
 * never all — and is the only client-identifying string that reaches a device.
 * Nothing else from the record does: no phone, no amount, no id.
 */
function describeBooking(record: BookingRecord, locale: "es" | "en"): string {
  const tz = recordTimeZone(record);
  // formatTimeRange always builds "HH:MM–HH:MM"; with one instant we want the
  // left half, the same trim LocalTime does rather than re-deriving the clock.
  const clock = formatTimeRange(record.startsAt, record.startsAt, tz, locale)
    .split("–")[0];
  return `${bookingLabel(record)} · ${formatDayLong(record.startsAt, tz, locale)} · ${clock}`;
}

/**
 * The whole notification, in the admin's chosen language.
 *
 * The title names the transition when it can. `latest` is the most recently
 * CHANGED upcoming booking, and on the wake-up a push causes that is the booking
 * that just turned green — so "Reserva confirmada" is the true headline almost
 * every time, and `movement` covers the times it is not (a push racing an edit,
 * or a fetch that lands after the admin already opened the calendar).
 *
 * The count rides along as a trailing clause and only when it is non-zero: "0
 * sin confirmar" is a sentence that costs a line of lock screen to say nothing.
 */
function render(
  latest: BookingRecord | undefined,
  awaiting: number,
  dict: AdminDictionary,
  locale: "es" | "en",
): PushSummary {
  const copy = dict.push.notification;
  const tail = awaiting > 0 ? ` · ${awaiting} ${copy.awaiting}` : "";

  if (!latest) {
    // Nothing upcoming to name. Still a complete notification, because the
    // worker must show one no matter what — see its header.
    return {
      title: copy.movement,
      body: awaiting > 0 ? `${awaiting} ${copy.awaiting}` : copy.nothing,
      url: TAP_TARGET,
    };
  }

  return {
    title: deriveStatus(latest) === "confirmed" ? copy.confirmed : copy.movement,
    body: `${describeBooking(latest, locale)}${tail}`,
    url: TAP_TARGET,
  };
}

export async function GET(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  // Read before the bucket, so the failure path below could still answer in the
  // right language if it ever needed to. Never throws — see readAdminLocale().
  const locale = await readAdminLocale();
  const dict = getAdminDictionary(locale);

  const nowIso = new Date().toISOString();
  const thisMonth = monthKeyOf(nowIso, "UTC");
  const months = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) =>
    shiftMonth(thisMonth, i),
  );

  try {
    const byMonth = await listMonths(months);

    // One filter for both fields, so the count and the headline can never
    // describe different sets of bookings.
    const upcoming = Object.values(byMonth)
      .flat()
      .filter((r) => !r.cancelledAt && r.endsAt > nowIso);

    const awaiting = upcoming.filter((r) => {
      const status = deriveStatus(r);
      return status === "pending" || status === "awaiting_receipt";
    }).length;

    const latest = [...upcoming].sort(changedLast)[0];

    const summary = render(latest, awaiting, dict, locale);
    return NextResponse.json({ ok: true, ...summary }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof BookingsNotConfiguredError) {
      return fail("bookings-not-configured", 503);
    }
    // No message in the body, unlike the other admin routes: the reader is a
    // service worker that can do nothing with it, and it goes to the log where
    // the studio can actually see it.
    console.error("push summary: failed to read bookings", err);
    return fail("store-failed", 500);
  }
}
