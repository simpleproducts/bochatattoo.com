/**
 * The one composite renderer of a booking's status.
 *
 * It never decides anything: every pixel comes out of STATUS_META, which is the
 * single mapping in the codebase, and the word comes out of the admin
 * dictionary under that same table's `dictKey`. Four redundant channels always
 * ship together — hue, glyph, border stroke and a real text label — so the
 * status survives a colour-blind reader, a greyscale print and a screen reader
 * alike. Removing any one of them from this markup silently removes it from
 * every admin surface at once, which is the point.
 *
 * The label is a prop rather than a lookup this component makes itself: the
 * admin's language is a cookie read on the server (src/lib/admin-locale.ts) and
 * handed down as `dict`, so no client component reads it.
 */
import { STATUS_META } from "@/lib/booking-status";
import type { AdminDictionary } from "@/i18n/admin";
import type { StatusBadgeProps } from "./contract";

export function StatusBadge({
  status,
  size = "sm",
  className,
  dict,
}: StatusBadgeProps & { dict: AdminDictionary }) {
  const meta = STATUS_META[status];
  const label = dict.calendar.status[meta.dictKey];
  // `border` already carries the left rule, so the padding has to clear it.
  const scale = size === "md" ? "text-xs py-1 gap-2 pl-2" : "text-[10px] gap-1.5 pl-1.5";
  return (
    <span
      aria-label={label}
      className={`inline-flex items-center font-mono uppercase tracking-[0.2em] transition-colors duration-300 ${meta.border} ${meta.text} ${scale} ${className ?? ""}`}
    >
      <span aria-hidden>{meta.glyph}</span>
      <span>{label}</span>
    </span>
  );
}
