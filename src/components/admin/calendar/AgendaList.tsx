/**
 * The mobile-default view: a sticky week strip over a grouped day list.
 *
 * The strip is the only place in the calendar that moves by week rather than
 * by month, so it does its own day-key arithmetic. Day keys are calendar
 * labels, not instants — walked at noon UTC, where a day is always exactly
 * 24 h and no zone is involved. The month cursor stays with the parent: the
 * strip only reports which day was picked.
 *
 * The swipe threshold is Lightbox's, verbatim (`|dx| > 50 && |dx| > |dy|`), so
 * a horizontal flick changes the week and a vertical one still scrolls.
 *
 * The create bar is a fixed bottom strip, not a floating action button: this
 * design language has no circles outside the Lightbox arrows.
 *
 * The strip's height is MEASURED rather than written down: the day cells are
 * `aspect-square` in a 7-column grid, so the strip is as tall as a seventh of
 * whatever width it is given. That measurement is what the sticky day headings
 * offset themselves by, and what `scrollIntoView` scrolls clear of — with a
 * hard-coded `top-0` both of them slide under the strip and the first row of
 * the day is unreadable.
 */
import { useEffect, useRef, useState } from "react";
import { STATUS_META } from "@/lib/booking-status";
import { formatDayLong, formatTimeRange } from "@/lib/booking-time";
import { bookingLabel } from "@/lib/bookings-types";
import type { AdminAppointment, BookingId } from "@/lib/bookings-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import type { AgendaListProps } from "./contract";

/**
 * Declared here rather than in `contract.ts`: the contract file describes the
 * calendar's data, and `loading` is one optional rendering hint — the list
 * cannot know whether an empty month is empty or still in flight, and "Nothing
 * scheduled." is a lie in the second case. `locale` and `dict` sit here for the
 * same reason: which language the list is read in is not calendar data.
 */
type ListProps = AgendaListProps & {
  locale: Locale;
  dict: AdminDictionary;
  loading?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PIPS = 3;
const SWIPE_PX = 50;

/**
 * The same mapping booking-time.ts fixes for every other date in the product —
 * es → es-AR, en → en-GB. Restated rather than imported because that module
 * keeps it private.
 */
const INTL_LOCALE: Record<Locale, string> = { es: "es-AR", en: "en-GB" };

/**
 * Memoised by locale, the way booking-time.ts caches its own formatters. The
 * strip wants the NARROW weekday ("M", "L") rather than the dictionary's
 * three-letter `grid.weekdays`: these cells are a seventh of a phone wide.
 */
const weekdayFormatters = new Map<Locale, Intl.DateTimeFormat>();

function weekdayNarrow(ms: number, locale: Locale): string {
  let fmt = weekdayFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: "UTC",
      weekday: "narrow",
    });
    weekdayFormatters.set(locale, fmt);
  }
  return fmt.format(new Date(ms));
}

/**
 * "3 appointments" / "1 appointment". There is no plural engine here and there
 * does not need to be: one is the only irregular count either language has.
 */
function appointmentCount(n: number, dict: AdminDictionary): string {
  const template =
    n === 1 ? dict.calendar.appointmentsOne : dict.calendar.appointments;
  return template.replace("{count}", String(n));
}

function dayKeyMs(dayKey: string): number {
  return Date.parse(`${dayKey}T12:00:00Z`);
}

function shiftDayKey(dayKey: string, days: number): string {
  return new Date(dayKeyMs(dayKey) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week containing `dayKey`. Sunday (0) folds to the end. */
function weekStart(dayKey: string): string {
  const offset = (new Date(dayKeyMs(dayKey)).getUTCDay() + 6) % 7;
  return shiftDayKey(dayKey, -offset);
}

function AgendaRow({
  appt,
  tz,
  locale,
  dict,
  onOpen,
}: {
  appt: AdminAppointment;
  tz: string;
  locale: Locale;
  dict: AdminDictionary;
  onOpen: (id: BookingId) => void;
}) {
  const meta = STATUS_META[appt.status];
  const label = dict.calendar.status[meta.dictKey];
  return (
    <button
      type="button"
      onClick={() => onOpen(appt.id)}
      className={`w-full min-h-[56px] flex items-start gap-3 py-3 pl-3 pr-1 text-left hover:bg-fg/5 transition-colors cursor-pointer ${meta.border}`}
    >
      <span aria-hidden className={`${meta.text} shrink-0`}>
        {meta.glyph}
      </span>
      <span className="font-mono text-xs text-fg/80 shrink-0">
        {formatTimeRange(appt.startsAt, appt.endsAt, tz, locale)}
      </span>
      <span className="text-sm truncate flex-1">{bookingLabel(appt)}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted shrink-0 hidden sm:inline">
        {label}
      </span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

export function AgendaList({
  monthKey,
  byDay,
  tz,
  todayKey,
  selectedDayKey,
  locale,
  dict,
  onSelectDay,
  onOpenAppt,
  onCreate,
  loading,
}: ListProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const lastSelected = useRef<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  /** 0 until measured, which is exactly the pre-fix layout — never worse. */
  const [stripHeight, setStripHeight] = useState(0);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setStripHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The strip is width-driven, so a rotation or a resize changes its height
    // without changing anything React would re-render on.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const week = Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart(selectedDayKey), i));
  const days = Object.keys(byDay)
    .filter((k) => k.startsWith(monthKey) && (byDay[k]?.length ?? 0) > 0)
    .sort();

  // Picking a day in the strip should bring its group into view; the first
  // render is not a pick, so it must not hijack the page's scroll position.
  useEffect(() => {
    if (lastSelected.current === null || lastSelected.current === selectedDayKey) {
      lastSelected.current = selectedDayKey;
      return;
    }
    lastSelected.current = selectedDayKey;
    const el = groupRefs.current.get(selectedDayKey);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [selectedDayKey]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      onSelectDay(shiftDayKey(selectedDayKey, dx < 0 ? 7 : -7));
    }
  };

  return (
    <section className="flex flex-col gap-4 pb-24">
      <div
        ref={stripRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-line py-2"
      >
        <div className="grid grid-cols-7 gap-1">
          {week.map((dayKey) => {
            const appts = byDay[dayKey] ?? [];
            const selected = dayKey === selectedDayKey;
            const isToday = dayKey === todayKey;
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => onSelectDay(dayKey)}
                aria-pressed={selected}
                aria-label={dict.calendar.agenda.dayLabel
                  .replace(
                    "{day}",
                    formatDayLong(`${dayKey}T12:00:00Z`, "UTC", locale),
                  )
                  .replace("{count}", appointmentCount(appts.length, dict))}
                className={`aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  selected ? "border border-fg" : "border border-transparent"
                } ${isToday ? "text-fg" : "text-muted"}`}
              >
                <span aria-hidden className="font-mono text-[10px] uppercase tracking-[0.2em]">
                  {weekdayNarrow(dayKeyMs(dayKey), locale)}
                </span>
                <span
                  aria-hidden
                  className={`font-mono text-xs ${isToday ? "bg-fg text-bg px-1.5 py-0.5" : ""}`}
                >
                  {dayKey.slice(8)}
                </span>
                <span aria-hidden className="flex gap-0.5 justify-center h-1">
                  {appts.slice(0, MAX_PIPS).map((appt) => (
                    <span
                      key={appt.id}
                      className={`w-1 h-1 rounded-full ${STATUS_META[appt.status].dot}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {days.length === 0 && loading ? (
        <p className="font-serif italic text-2xl text-muted">{dict.common.loading}</p>
      ) : days.length === 0 ? (
        <p className="font-serif italic text-2xl text-muted">
          {dict.calendar.agenda.empty}
        </p>
      ) : (
        <div className="divide-y divide-line border-y border-line">
          {days.map((dayKey) => (
            <div
              key={dayKey}
              style={{ scrollMarginTop: stripHeight }}
              ref={(el) => {
                if (el) groupRefs.current.set(dayKey, el);
                else groupRefs.current.delete(dayKey);
              }}
            >
              <h3
                style={{ top: stripHeight }}
                className={`sticky z-20 bg-bg/90 backdrop-blur-md py-2 font-mono text-xs uppercase tracking-[0.2em] ${
                  dayKey === selectedDayKey ? "text-fg" : "text-muted"
                }`}
              >
                {formatDayLong(`${dayKey}T12:00:00Z`, "UTC", locale)}
              </h3>
              <div className="flex flex-col">
                {(byDay[dayKey] ?? []).map((appt) => (
                  <AgendaRow
                    key={appt.id}
                    appt={appt}
                    tz={tz}
                    locale={locale}
                    dict={dict}
                    onOpen={onOpenAppt}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 border-t border-line bg-bg/90 backdrop-blur-xl px-4 py-3 z-40">
        <button
          type="button"
          onClick={() => onCreate(selectedDayKey)}
          className="w-full min-h-[44px] border border-fg px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer"
        >
          {dict.calendar.agenda.new}
        </button>
      </div>
    </section>
  );
}
