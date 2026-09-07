/**
 * The desktop month view: 42 cells, Monday first (Argentina).
 *
 * Two structural decisions worth knowing about:
 *
 * 1. The cell is a <div role="gridcell"> holding an absolutely-positioned
 *    <button> that fills it, not a <button> wrapping its contents. The chips
 *    are buttons too, and a button inside a button is invalid HTML that
 *    browsers silently un-nest. The background button is what "clicking empty
 *    cell space opens the composer" actually means, and it still carries the
 *    descriptive aria-label for the whole day.
 * 2. The week wrappers are `display: contents` so the ARIA row structure is
 *    real while the 7-column CSS grid still lays the cells out itself.
 * 3. A cell draws at most three chips, and "+N" EXPANDS that cell rather than
 *    opening the composer. A busy day is exactly the day whose fourth booking
 *    has to be readable, and the composer is already one click away on every
 *    square of empty cell space.
 *
 * `byDay` is keyed by the day each appointment falls on IN ITS OWN ZONE, so a
 * booking whose UTC month differs from its displayed month lands in the right
 * cell without any special case — and a 23:00 Berlin session lands on the
 * Berlin square, which is the one the artist standing in Berlin will look at.
 * `tz` is the reader's frame and is used for two things only: which square is
 * today, and whether a chip's own zone is worth marking.
 *
 * Monday-first is NOT a translation concern: it is the week the studio works,
 * and it stays Monday-first in English too. The dictionary's `grid.weekdays` is
 * a seven-tuple in that order for exactly that reason.
 */
import { useState } from "react";
import { monthGridDayKeys } from "@/lib/booking-time";
import type { AdminAppointment } from "@/lib/bookings-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import { AppointmentChip } from "./AppointmentChip";
import type { MonthGridProps } from "./contract";

/**
 * Declared here rather than in `contract.ts`: the contract file describes the
 * calendar's data, and `loading` is one optional rendering hint — the grid
 * cannot know whether an empty month is empty or still in flight, and "no
 * appointments" is a lie in the second case. `locale` and `dict` sit here for
 * the same reason: which language the grid is read in is not calendar data.
 */
type GridProps = MonthGridProps & {
  locale: Locale;
  dict: AdminDictionary;
  loading?: boolean;
};

const MAX_CHIPS = 3;

/**
 * The same mapping booking-time.ts fixes for every other date in the product —
 * es → es-AR, en → en-GB. Restated rather than imported because that module
 * keeps it private.
 */
const INTL_LOCALE: Record<Locale, string> = { es: "es-AR", en: "en-GB" };

/** Memoised by locale, the way booking-time.ts caches its own formatters. */
const dayMonthFormatters = new Map<Locale, Intl.DateTimeFormat>();

/** Day keys are calendar labels, not instants — noon UTC keeps them stable. */
function dayMonthLabel(dayKey: string, locale: Locale): string {
  let fmt = dayMonthFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
    });
    dayMonthFormatters.set(locale, fmt);
  }
  return fmt.format(new Date(`${dayKey}T12:00:00Z`));
}

function countPending(appts: AdminAppointment[]): number {
  return appts.filter((a) => a.status === "pending").length;
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

function cellLabel(
  dayKey: string,
  appts: AdminAppointment[],
  locale: Locale,
  dict: AdminDictionary,
): string {
  const grid = dict.calendar.grid;
  const date = dayMonthLabel(dayKey, locale);
  if (appts.length === 0) return grid.cellEmpty.replace("{date}", date);
  const total = appointmentCount(appts.length, dict);
  const pending = countPending(appts);
  // The pending phrasing is the grid's own, not the status table's: it reads as
  // a clause inside a sentence, where "AWAITING CLIENT" is a chip.
  return pending > 0
    ? grid.cellPending
        .replace("{date}", date)
        .replace("{count}", total)
        .replace("{pending}", String(pending))
    : grid.cell.replace("{date}", date).replace("{count}", total);
}

export function MonthGrid({
  monthKey,
  byDay,
  tz,
  todayKey,
  locale,
  dict,
  onOpenAppt,
  onCreate,
  loading,
}: GridProps) {
  /**
   * Which day, if any, is showing all of its appointments. One at a time: each
   * expanded cell stretches its whole week row, and comparing two crowded days
   * side by side is not a case worth pushing the rest of the month off-screen.
   */
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const dayKeys = monthGridDayKeys(monthKey);
  const weeks: string[][] = [];
  for (let i = 0; i < dayKeys.length; i += 7) weeks.push(dayKeys.slice(i, i + 7));

  const monthAppointments = dayKeys
    .filter((k) => k.startsWith(monthKey))
    .flatMap((k) => byDay[k] ?? []);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-7" aria-hidden>
        {dict.calendar.grid.weekdays.map((d, i) => (
          // Keyed by position, not by the word: the tuple is fixed at seven and
          // in a fixed order, and two languages need not have seven distinct
          // abbreviations ("Mar"/"Mié" nearly collide already).
          <div
            key={i}
            className="px-1.5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={dict.calendar.grid.label}
        className="grid grid-cols-7 border-t border-l border-line"
      >
        {weeks.map((week) => (
          <div role="row" className="contents" key={week[0]}>
            {week.map((dayKey) => {
              const appts = byDay[dayKey] ?? [];
              const inMonth = dayKey.startsWith(monthKey);
              const isToday = dayKey === todayKey;
              const expanded = expandedDay === dayKey;
              const overflow = appts.length - MAX_CHIPS;
              const shown = expanded ? appts : appts.slice(0, MAX_CHIPS);
              return (
                <div
                  role="gridcell"
                  key={dayKey}
                  className="border-r border-b border-line min-h-[120px] p-1.5 relative group flex flex-col gap-1"
                >
                  <button
                    type="button"
                    aria-label={cellLabel(dayKey, appts, locale, dict)}
                    onClick={() => onCreate(dayKey)}
                    className="absolute inset-0 text-left cursor-pointer hover:bg-fg/5 transition-colors"
                  />
                  <div className="relative pointer-events-none">
                    <span
                      className={`font-mono text-xs ${
                        isToday
                          ? "bg-fg text-bg px-1.5 py-0.5"
                          : inMonth
                            ? ""
                            : "text-muted/70"
                      }`}
                    >
                      {dayKey.slice(8)}
                    </span>
                  </div>
                  <div className="relative flex flex-col gap-0.5">
                    {shown.map((appt) => (
                      <AppointmentChip
                        key={appt.id}
                        appt={appt}
                        tz={tz}
                        locale={locale}
                        dict={dict}
                        onOpen={onOpenAppt}
                      />
                    ))}
                    {overflow > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? dict.calendar.grid.showFewer.replace(
                                "{date}",
                                dayMonthLabel(dayKey, locale),
                              )
                            : dict.calendar.grid.showAll
                                .replace("{count}", String(appts.length))
                                .replace("{date}", dayMonthLabel(dayKey, locale))
                        }
                        onClick={() => setExpandedDay(expanded ? null : dayKey)}
                        className="self-start font-mono text-[10px] text-muted hover:text-fg pl-1.5 py-0.5 text-left cursor-pointer"
                      >
                        {expanded ? dict.calendar.grid.less : `+${overflow}`}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {monthAppointments.length === 0 && loading ? (
        <p className="text-muted text-sm">{dict.calendar.grid.loading}</p>
      ) : monthAppointments.length === 0 ? (
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-muted text-sm">{dict.calendar.grid.empty}</p>
          <button
            type="button"
            onClick={() =>
              onCreate(todayKey.startsWith(monthKey) ? todayKey : `${monthKey}-01`)
            }
            className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
          >
            {dict.calendar.grid.createOne}
          </button>
        </div>
      ) : null}
    </section>
  );
}
