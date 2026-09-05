/**
 * Where the reader is, in three words.
 *
 * `role="status" aria-live="polite"` is the point of the component, not
 * decoration: when the details form collapses and the receipt block scrolls
 * itself into view, focus deliberately does not move, so without a live region
 * a screen-reader user would be told nothing at all happened.
 *
 * The rail is also the colour-independent mirror of the calendar's red /
 * yellow / green. State is carried by a ✓, an underline and a text colour that
 * differs in luminance, never by hue alone.
 */
import type { ProgressRailProps } from "./contract";

/** Flow order. `done` sits past the end, which is what marks every item complete. */
const ORDER = ["details", "terms", "receipt"] as const;

export function ProgressRail({ step, dict }: ProgressRailProps) {
  const index = step === "done" ? ORDER.length : ORDER.indexOf(step);

  return (
    <ol
      role="status"
      aria-live="polite"
      className="flex gap-6 font-mono text-[10px] uppercase tracking-[0.3em]"
    >
      {ORDER.map((key, i) => {
        const complete = i < index;
        const current = i === index;
        return (
          <li
            key={key}
            aria-current={current ? "step" : undefined}
            className={
              complete
                ? "text-fg"
                : current
                  ? "text-fg border-b border-fg pb-1"
                  : "text-muted"
            }
          >
            {complete ? <span aria-hidden>✓ </span> : null}
            {dict.booking.rail[key]}
          </li>
        );
      })}
    </ol>
  );
}
