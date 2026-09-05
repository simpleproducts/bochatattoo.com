/**
 * The one composite renderer of a booking's status.
 *
 * It never decides anything: every pixel and every word comes out of
 * STATUS_META, which is the single mapping in the codebase. Four redundant
 * channels always ship together — hue, glyph, border stroke and a real text
 * label — so the status survives a colour-blind reader, a greyscale print and
 * a screen reader alike. Removing any one of them from this markup silently
 * removes it from every admin surface at once, which is the point.
 *
 * Admin copy is English: this component is only ever mounted inside the
 * lang="en" admin layout.
 */
import { STATUS_META } from "@/lib/booking-status";
import type { StatusBadgeProps } from "./contract";

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  // `border` already carries the left rule, so the padding has to clear it.
  const scale = size === "md" ? "text-xs py-1 gap-2 pl-2" : "text-[10px] gap-1.5 pl-1.5";
  return (
    <span
      aria-label={meta.adminLabel}
      className={`inline-flex items-center font-mono uppercase tracking-[0.2em] transition-colors duration-300 ${meta.border} ${meta.text} ${scale} ${className ?? ""}`}
    >
      <span aria-hidden>{meta.glyph}</span>
      <span>{meta.adminLabel}</span>
    </span>
  );
}
