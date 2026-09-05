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
import { STATUS_META } from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/bookings-types";
import type { CalendarToolbarProps, CalendarView } from "./contract";

/**
 * The repair trio is declared here rather than in `contract.ts`: the contract
 * file describes the calendar's data, and these three describe one optional
 * affordance of one component. Optional so a toolbar rendered without a repair
 * path simply does not draw the control.
 */
type ToolbarProps = CalendarToolbarProps & {
  onReindex?: () => void;
  reindexBusy?: boolean;
  /** The rebuild's own report — `{months, records}`, or why it failed. */
  reindexNote?: string | null;
};

const STEP_BUTTON =
  "border border-fg px-2 py-1 text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer";

const VIEWS: CalendarView[] = ["month", "agenda"];

/** Legend order is the lifecycle order, not the object key order. */
const LEGEND: BookingStatus[] = ["pending", "awaiting_receipt", "confirmed", "cancelled"];

const periodFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function periodLabel(monthKey: string): string {
  return periodFormatter.format(new Date(`${monthKey}-01T12:00:00Z`));
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
      {LEGEND.map((status) => {
        const meta = STATUS_META[status];
        return (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={meta.text}>
              {meta.glyph}
            </span>
            <span>{meta.adminLabel}</span>
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
  onView,
  onPrev,
  onNext,
  onToday,
  onCreate,
  onReindex,
  reindexBusy,
  reindexNote,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="font-serif italic text-2xl md:text-3xl">
            {periodLabel(monthKey)}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={onPrev}
              className={STEP_BUTTON}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={onNext}
              className={STEP_BUTTON}
            >
              ›
            </button>
            <button type="button" onClick={onToday} className={STEP_BUTTON}>
              Today
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <nav className="flex items-center gap-2 border-b border-line" aria-label="Calendar view">
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
                {v}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={onCreate}
            className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer"
          >
            + New
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] text-muted">
            {/* zoneAbbrev degrades to "" rather than take the calendar down. */}
            Times shown in {tz}
            {tzAbbrev ? ` (${tzAbbrev})` : ""}
          </span>
          {onReindex ? (
            <>
              <button
                type="button"
                onClick={onReindex}
                disabled={reindexBusy}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
              >
                {reindexBusy ? "Repairing…" : "Repair index"}
              </button>
              <span
                aria-live="polite"
                className="font-mono text-[10px] text-muted"
              >
                {reindexNote}
              </span>
            </>
          ) : null}
        </div>
        <details className="md:hidden">
          <summary className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted cursor-pointer">
            Legend
          </summary>
          <div className="pt-2">
            <Legend />
          </div>
        </details>
        <div className="hidden md:block">
          <Legend />
        </div>
      </div>
    </div>
  );
}
