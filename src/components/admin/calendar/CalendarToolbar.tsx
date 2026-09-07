/**
 * Period label, month stepper, view tabs, the timezone line, the legend and
 * the create button — every calendar-level control in one row.
 *
 * The toolbar is stateless: it renders `monthKey` and `view` and calls back.
 * The period label is formatted from the month key at noon UTC, never from a
 * local Date, so "September 2026" cannot become August for a reader west of
 * Greenwich.
 *
 * The legend is a <details> on mobile and a plain list from md up: it is
 * reference material, and on a phone it would otherwise cost a third of the
 * first screen before a single appointment is visible.
 *
 * It also carries the month-index repair, deliberately as the quietest control
 * on the page: it is a maintenance action nobody should reach for on a normal
 * day, and the warning strip above the toolbar is what points at it when they
 * should.
 */
import { useMemo, useSyncExternalStore } from "react";
import { STATUS_META } from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/bookings-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import { timeZoneOptions, type TimeZoneOption } from "@/lib/timezone-options";
import { TZ_AUTO } from "./contract";
import type { CalendarToolbarProps, CalendarView } from "./contract";

/**
 * The repair trio is declared here rather than in `contract.ts`: the contract
 * file describes the calendar's data, and these three describe one optional
 * affordance of one component. Optional so a toolbar rendered without a repair
 * path simply does not draw the control.
 *
 * `locale` and `dict` join them for the same reason — the language the toolbar
 * is read in is not part of the calendar's data either. Both are required:
 * every word below comes out of `dict`, and the month heading is formatted.
 */
type ToolbarProps = CalendarToolbarProps & {
  locale: Locale;
  dict: AdminDictionary;
  /**
   * Deliberately NOT rendered here any more. Rebuilding the month index is a
   * repair for a failure the admin is told about when it happens — the warning
   * strip in AdminCalendar carries its own button — so a permanent control in
   * the toolbar was a button whose meaning nobody could work out and whose
   * correct use was "never". Kept in the props so the strip and the toolbar
   * still share one handler if it is ever wanted back.
   */
  onReindex?: () => void;
  reindexBusy?: boolean;
  /** The rebuild's own report — `{months, records}`, or why it failed. */
  reindexNote?: string | null;
};

/**
 * The month steppers. Sized to a real 40px touch target rather than the 10px
 * chip they were: these are the controls the calendar is driven with, and on a
 * phone they were the smallest tappable things on the screen.
 */
const STEP_BUTTON =
  "border border-fg min-h-[40px] min-w-[40px] px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono leading-none flex items-center justify-center hover:bg-fg hover:text-bg transition-colors cursor-pointer";

const VIEWS: CalendarView[] = ["month", "agenda"];

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The zones worth offering, grouped so no two tell the same time.
 *
 * Gated on hydration rather than filled in by an effect: Node and the browser
 * can ship different ICU data, and a <select> whose options differ between the
 * server render and the first client render is a hydration mismatch.
 */
function useZoneOptions(extra: (string | undefined)[]): TimeZoneOption[] {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const key = extra.filter(Boolean).join("|");
  return useMemo(() => {
    if (!mounted) return [];
    return timeZoneOptions(new Date().getUTCFullYear(), key ? key.split("|") : []);
  }, [mounted, key]);
}

/** Legend order is the lifecycle order, not the object key order. */
const LEGEND: BookingStatus[] = ["pending", "awaiting_receipt", "confirmed", "cancelled"];

/**
 * The same mapping booking-time.ts fixes for every other date in the product —
 * es → es-AR, en → en-GB. Restated rather than imported because that module
 * keeps it private, and a month heading that disagreed with the clock beside it
 * would be worse than the one duplicated line.
 */
const INTL_LOCALE: Record<Locale, string> = { es: "es-AR", en: "en-GB" };

/**
 * Memoised by locale rather than built per render, the way booking-time.ts
 * caches its own formatters: constructing an `Intl.DateTimeFormat` is the
 * expensive half, and the admin changes language about once.
 */
const periodFormatters = new Map<Locale, Intl.DateTimeFormat>();

function periodLabel(monthKey: string, locale: Locale): string {
  let fmt = periodFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
    periodFormatters.set(locale, fmt);
  }
  return fmt.format(new Date(`${monthKey}-01T12:00:00Z`));
}

function Legend({ dict }: { dict: AdminDictionary }) {
  return (
    <ul className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
      {LEGEND.map((status) => {
        const meta = STATUS_META[status];
        return (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={meta.text}>
              {meta.glyph}
            </span>
            <span>{dict.calendar.status[meta.dictKey]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CalendarToolbar({
  monthKey,
  view,
  tz,
  tzAbbrev,
  viewerTz,
  studioTz,
  tzAuto,
  onTimeZone,
  locale,
  dict,
  onView,
  onPrev,
  onNext,
  onToday,
  onCreate,
}: ToolbarProps) {
  const zoneOptions = useZoneOptions([tz, viewerTz, studioTz]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {/*
            Reserved width, not shrink-to-fit. "mayo 2026" and "septiembre 2026"
            differ by about six characters, and without a floor under the label
            the ‹ › buttons slid left and right every time the month changed —
            the one control you press repeatedly was never in the same place
            twice. 8.5em is measured against the longest label in both
            languages ("septiembre 2026" / "September 2026") and scales with the
            heading's own font-size across the md breakpoint.
          */}
          <h2 className="font-serif italic text-2xl md:text-3xl min-w-[8.5em] whitespace-nowrap">
            {periodLabel(monthKey, locale)}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={dict.calendar.toolbar.prevMonth}
              onClick={onPrev}
              className={STEP_BUTTON}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={dict.calendar.toolbar.nextMonth}
              onClick={onNext}
              className={STEP_BUTTON}
            >
              ›
            </button>
            <button type="button" onClick={onToday} className={STEP_BUTTON}>
              {dict.calendar.toolbar.today}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <nav
            className="flex items-center gap-2 border-b border-line"
            aria-label={dict.calendar.toolbar.viewLabel}
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                aria-current={view === v ? "true" : undefined}
                className={`px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors cursor-pointer ${
                  view === v
                    ? "border-fg text-fg"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {dict.calendar.toolbar.views[v]}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={onCreate}
            className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer"
          >
            {dict.calendar.toolbar.new}
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/*
            The zone is a CHOICE, not a readout. It used to just state the
            browser's zone, which is the right default but the wrong answer
            during a guest spot: an admin in Berlin booking studio hours needs
            to think in Buenos Aires time, and reading "GMT+2" told them the
            problem existed without offering a way out.

            The list is curated and de-duplicated by timezone-options.ts: the
            Americas and Europe only, with zones that keep the same time folded
            into one entry. Ten European capitals on one clock are one choice,
            not ten ways to answer the same question.
          */}
          <label className="flex items-center gap-2 font-mono text-[10px] text-muted">
            <span className="uppercase tracking-[0.2em]">
              {dict.calendar.toolbar.timezoneLabel}
            </span>
            <select
              value={tzAuto ? TZ_AUTO : tz}
              onChange={(e) =>
                onTimeZone(e.target.value === TZ_AUTO ? null : e.target.value)
              }
              aria-label={dict.calendar.toolbar.timezoneLabel}
              className="bg-transparent border border-line px-2 py-1 font-mono text-[10px] text-fg max-w-[16rem] cursor-pointer focus:outline-none focus:border-fg"
            >
              <option value={TZ_AUTO}>
                {dict.calendar.toolbar.timezoneAuto.replace("{tz}", viewerTz)}
              </option>
              <option value={studioTz}>
                {dict.calendar.toolbar.timezoneStudio.replace("{tz}", studioTz)}
              </option>
              {(["americas", "europe"] as const).map((region) => {
                const inRegion = zoneOptions.filter((z) => z.region === region);
                if (inRegion.length === 0) return null;
                return (
                  <optgroup
                    key={region}
                    label={
                      region === "americas"
                        ? dict.calendar.toolbar.timezoneAmericas
                        : dict.calendar.toolbar.timezoneEurope
                    }
                  >
                    {inRegion.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {tzAbbrev ? <span>({tzAbbrev})</span> : null}
          </label>
        </div>
        <details className="md:hidden">
          <summary className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted cursor-pointer">
            {dict.calendar.toolbar.legend}
          </summary>
          <div className="pt-2">
            <Legend dict={dict} />
          </div>
        </details>
        <div className="hidden md:block">
          <Legend dict={dict} />
        </div>
      </div>
    </div>
  );
}
