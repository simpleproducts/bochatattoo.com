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
 * `byDay` is keyed in the viewer's zone, so a booking whose UTC month differs
 * from its displayed month lands in the right cell without any special case.
 */
import { useState } from "react";
import { monthGridDayKeys } from "@/lib/booking-time";
import type { AdminAppointment } from "@/lib/bookings-types";
import { AppointmentChip } from "./AppointmentChip";
import type { MonthGridProps } from "./contract";

/**
 * Declared here rather than in `contract.ts`: the contract file describes the
 * calendar's data, and this is one optional rendering hint. The grid cannot
 * know whether an empty month is empty or still in flight, and "no
 * appointments" is a lie in the second case.
 */
type GridProps = MonthGridProps & { loading?: boolean };

/** Admin copy is English; Monday first because the studio is in Argentina. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MAX_CHIPS = 3;

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

/** Day keys are calendar labels, not instants — noon UTC keeps them stable. */
function dayMonthLabel(dayKey: string): string {
  return dayMonthFormatter.format(new Date(`${dayKey}T12:00:00Z`));
}

function countPending(appts: AdminAppointment[]): number {
  return appts.filter((a) => a.status === "pending").length;
}

function cellLabel(dayKey: string, appts: AdminAppointment[]): string {
  const date = dayMonthLabel(dayKey);
  if (appts.length === 0) return `${date} — no appointments`;
  const total = `${appts.length} ${appts.length === 1 ? "appointment" : "appointments"}`;
  const pending = countPending(appts);
  // "awaiting client" is the pending label, read from the one status table.
  return pending > 0
    ? `${date} — ${total}, ${pending} awaiting client`
    : `${date} — ${total}`;
}

export function MonthGrid({
  monthKey,
  byDay,
  tz,
  todayKey,
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
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-1.5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label="Appointments by day"
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
                    aria-label={cellLabel(dayKey, appts)}
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
                        onOpen={onOpenAppt}
                      />
                    ))}
                    {overflow > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? `Show fewer appointments on ${dayMonthLabel(dayKey)}`
                            : `Show all ${appts.length} appointments on ${dayMonthLabel(dayKey)}`
                        }
                        onClick={() => setExpandedDay(expanded ? null : dayKey)}
                        className="self-start font-mono text-[10px] text-muted hover:text-fg pl-1.5 py-0.5 text-left cursor-pointer"
                      >
                        {expanded ? "Less" : `+${overflow}`}
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
        <p className="text-muted text-sm">Loading appointments…</p>
      ) : monthAppointments.length === 0 ? (
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-muted text-sm">No appointments this month.</p>
          <button
            type="button"
            onClick={() =>
              onCreate(todayKey.startsWith(monthKey) ? todayKey : `${monthKey}-01`)
            }
            className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
          >
            Create one
          </button>
        </div>
      ) : null}
    </section>
  );
}
