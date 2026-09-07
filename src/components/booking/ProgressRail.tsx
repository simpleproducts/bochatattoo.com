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
 *
 * Each step is numbered. Three bare words read as labels for whatever is on
 * screen; "1 2 3" is what says there are exactly three of these and which one
 * is being asked for — the difference between a heading and a progress bar for
 * someone doing this once, on a phone, having never seen the page before. The
 * number is swapped for the ✓ once a step is done rather than shown beside it,
 * so the row never carries two marks per item.
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
            {/*
              aria-hidden on the marker: the count is visual shorthand, while
              `aria-current="step"` and the ✓ already tell a screen reader
              exactly the same thing in its own idiom.
            */}
            <span aria-hidden>{complete ? "✓" : i + 1} </span>
            {dict.booking.rail[key]}
          </li>
        );
      })}
    </ol>
  );
}
