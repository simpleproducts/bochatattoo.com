/**
 * /admin/calendar — the server half of the booking calendar.
 *
 * It reads three months (previous, current, next) and hands them down as
 * `initialMonths`. That is the house data flow: server fetch -> prop ->
 * `router.refresh()` after a mutation, exactly like /admin does with the image
 * manifest. Keeping the neighbours warm is what lets the client group by the
 * VIEWER's timezone without a fetch — a booking stored in one UTC month can be
 * drawn in the one beside it.
 *
 * Already covered by middleware's "/admin/:path*" matcher entry; `requireAdmin()`
 * is the second, defence-in-depth check the other admin pages also make.
 *
 * Trips ride along on the same load, in parallel: neither read derives from the
 * other, so the pair costs what the slower of the two costs.
 *
 * Neither failure mode below throws, and each read owns its own catch. A
 * missing env var and a sulking R2 are both things Bocha can only act on if the
 * page renders and says so — a 500 here is an unexplained blank screen at the
 * moment he needs the schedule, and a trips document that will not load is no
 * reason to take the calendar with it.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { readAdminLocale } from "@/lib/admin-locale";
import { monthKeyOf, monthsAround, STUDIO_TIME_ZONE } from "@/lib/booking-time";
import { listMonths, toAdminAppointment } from "@/lib/bookings-store";
import type { AdminAppointment } from "@/lib/bookings-types";
import { listTrips } from "@/lib/trips-store";
import type { Trip } from "@/lib/trips-types";
import { bookingsConfigured } from "@/lib/r2-private";
import { getAdminDictionary } from "@/i18n/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminCalendar } from "@/components/admin/calendar/AdminCalendar";

export const dynamic = "force-dynamic";

/** `?b=<id>` is the deep link in Bocha's own notification email. */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * The three months, already widened to `AdminAppointment`.
 *
 * Ships an empty window rather than a 500: the client then treats every month
 * as unloaded and fetches them itself, which surfaces the real message in the
 * calendar's error strip behind a Retry button.
 */
async function loadMonths(
  months: string[],
): Promise<Record<string, AdminAppointment[]>> {
  try {
    const byMonth = await listMonths(months);
    const loaded: Record<string, AdminAppointment[]> = {};
    for (const [month, records] of Object.entries(byMonth)) {
      loaded[month] = await Promise.all(records.map((r) => toAdminAppointment(r)));
    }
    return loaded;
  } catch (err) {
    console.error("admin/calendar: initial listMonths failed", err);
    return {};
  }
}

/**
 * Every trip, or none.
 *
 * Its own catch, deliberately: a trip only ever PROPOSES a zone to a new
 * booking and QUESTIONS one that disagrees, so a list that fails to load costs
 * a default and a warning. Letting that take the schedule down with it would
 * trade the whole screen for the smaller half of it.
 */
async function loadTrips(): Promise<Trip[]> {
  try {
    return await listTrips();
  } catch (err) {
    console.error("admin/calendar: initial listTrips failed", err);
    return [];
  }
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  // The admin's language is a cookie, not a URL segment (src/lib/admin-locale.ts
  // says why), so the server reads it here and hands the whole screen its words
  // as props — the same way the booking pages hand `dict` to BookingFlow. It is
  // also what every date below is formatted in: the calendar has more dates than
  // sentences, which is why `locale` travels alongside `dict`.
  const locale = await readAdminLocale();
  const dict = getAdminDictionary(locale);

  const params = await searchParams;
  const selectedId = firstParam(params.b);
  const configured = bookingsConfigured();

  let initialMonths: Record<string, AdminAppointment[]> = {};
  let initialTrips: Trip[] = [];
  if (configured) {
    const months = monthsAround(monthKeyOf(new Date().toISOString(), STUDIO_TIME_ZONE));
    // Independent reads, so they overlap instead of queueing: no trip is
    // derived from a booking and no booking from a trip. Each helper swallows
    // its own failure, which is what keeps `Promise.all` from turning one
    // rejection into both empty.
    const [loadedMonths, loadedTrips] = await Promise.all([
      loadMonths(months),
      loadTrips(),
    ]);
    initialMonths = loadedMonths;
    initialTrips = loadedTrips;
  }

  return (
    // The nav lives INSIDE <main>, exactly as it does on the gallery page, so
    // the tab bar picks up the same px-4/md:px-8 inset as everything under it.
    // Outside, it ran flush to the viewport edge while the calendar below it
    // was padded.
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <AdminNav active="calendar" dict={dict} />
      <AdminCalendar
        initialMonths={initialMonths}
        initialTrips={initialTrips}
        studioTimeZone={STUDIO_TIME_ZONE}
        initialSelectedId={selectedId}
        configured={configured}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
