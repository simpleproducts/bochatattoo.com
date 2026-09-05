/**
 * One appointment inside a month-grid cell.
 *
 * Deliberately not a <StatusBadge>: the chip interleaves the status glyph with
 * the clock and the client's name on one 10px line, and hangs the status rule
 * off the button itself. It still reads every visual from STATUS_META, so the
 * chip and the badge can never disagree about what yellow means.
 *
 * The visible text is the clock and the label; the status word is `sr-only`,
 * because in a grid of forty-two cells the colour + glyph carry it for sighted
 * readers and repeating "awaiting receipt" eight times would not.
 *
 * The clock follows the admin's language for the same reason the words do:
 * `locale` is what `formatTimeRange` maps to es-AR / en-GB.
 */
import { STATUS_META } from "@/lib/booking-status";
import { formatTimeRange } from "@/lib/booking-time";
import { bookingLabel } from "@/lib/bookings-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import type { AppointmentChipProps } from "./contract";

/**
 * Declared here rather than in `contract.ts`, alongside the other local
 * extensions in this folder: the contract file describes the calendar's data,
 * and these two describe which language it is being read in.
 */
type ChipProps = AppointmentChipProps & { locale: Locale; dict: AdminDictionary };

export function AppointmentChip({ appt, tz, locale, dict, onOpen }: ChipProps) {
  const meta = STATUS_META[appt.status];
  // formatTimeRange is the only clock formatter; the left half is the start.
  const clock = formatTimeRange(appt.startsAt, appt.startsAt, tz, locale).split("–")[0];
  return (
    <button
      type="button"
      onClick={() => onOpen(appt.id)}
      title={`${clock} · ${bookingLabel(appt)}`}
      className={`flex items-center gap-1.5 w-full text-left pl-1.5 py-0.5 truncate font-mono text-[10px] hover:bg-fg/10 transition-colors cursor-pointer ${meta.border} ${meta.text}`}
    >
      <span aria-hidden>{meta.glyph}</span>
      <span className="text-fg/80 shrink-0">{clock}</span>
      <span className="truncate text-fg/70">{bookingLabel(appt)}</span>
      <span className="sr-only">{dict.calendar.status[meta.dictKey]}</span>
    </button>
  );
}
