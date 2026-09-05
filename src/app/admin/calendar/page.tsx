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
 * Neither failure mode below throws. A missing env var and a sulking R2 are
 * both things Bocha can only act on if the page renders and says so — a 500
 * here is an unexplained blank screen at the moment he needs the schedule.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { readAdminLocale } from "@/lib/admin-locale";
import { monthKeyOf, monthsAround, STUDIO_TIME_ZONE } from "@/lib/booking-time";
import { listMonths, toAdminAppointment } from "@/lib/bookings-store";
import type { AdminAppointment } from "@/lib/bookings-types";
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
  if (configured) {
    const months = monthsAround(monthKeyOf(new Date().toISOString(), STUDIO_TIME_ZONE));
    try {
      const byMonth = await listMonths(months);
      const loaded: Record<string, AdminAppointment[]> = {};
      for (const [month, records] of Object.entries(byMonth)) {
        loaded[month] = await Promise.all(records.map((r) => toAdminAppointment(r)));
      }
      initialMonths = loaded;
    } catch (err) {
      // Ship an empty window rather than a 500: the client then treats every
      // month as unloaded and fetches them itself, which surfaces the real
      // message in the calendar's error strip behind a Retry button.
      console.error("admin/calendar: initial listMonths failed", err);
    }
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
        studioTimeZone={STUDIO_TIME_ZONE}
        initialSelectedId={selectedId}
        configured={configured}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
