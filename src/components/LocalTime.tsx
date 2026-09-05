"use client";
/**
 * A stored UTC instant, rendered on the reader's own clock.
 *
 * The server cannot know the viewer's zone, so SSR and the FIRST client render
 * both use STUDIO_TIME_ZONE and the render right after hydration swaps in the
 * viewer's zone (`resolveTimeZone`). The pre-mount value is deliberately studio time and
 * never UTC: someone who briefly reads 21:00 for an 18:00 appointment has been
 * told the wrong time, whereas a flash of studio time is the right time in a
 * zone we then correct. `suppressHydrationWarning` is scoped to this one
 * element because ICU data can differ between the Node build and the browser
 * even when both are formatting the same zone.
 *
 * Passing `timeZone` pins the output and disables the swap — that is how the
 * permanent "studio time" second line stays studio time on every screen.
 */
import { useSyncExternalStore } from "react";
import {
  formatDayLong,
  formatTimeRange,
  resolveTimeZone,
  zoneAbbrev,
} from "@/lib/booking-time";

/**
 * "Has this component hydrated yet" is a fact about the runtime, not state.
 * `useSyncExternalStore` reads it without a setState-in-effect: the server
 * snapshot is false, so SSR and the hydrating render agree, and React then
 * re-renders once with true. The store never changes, hence the no-op
 * subscribe.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

type Props = {
  /** UTC ISO. Also the machine-readable value of the <time> element. */
  start: string;
  /** UTC ISO. When present, a range is rendered instead of a single clock. */
  end?: string;
  /** Pin to this IANA zone instead of following the viewer. */
  timeZone?: string;
  locale: "es" | "en";
  /** Append the zone abbreviation — every reading here is zone-dependent. */
  showZone?: boolean;
  showDate?: boolean;
  className?: string;
};

export function LocalTime({
  start,
  end,
  timeZone,
  locale,
  showZone,
  showDate,
  className,
}: Props) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  const tz = timeZone ?? resolveTimeZone(mounted);
  // formatTimeRange always builds "HH:MM–HH:MM"; with no end we want the left
  // half, which is cheaper and safer than re-deriving the clock by hand here.
  const range = formatTimeRange(start, end ?? start, tz, locale);
  const clock = end ? range : range.split("–")[0];
  const abbrev = showZone ? zoneAbbrev(start, tz, locale) : "";

  return (
    <time dateTime={start} className={className} suppressHydrationWarning>
      {showDate ? `${formatDayLong(start, tz, locale)} · ` : ""}
      {clock}
      {abbrev ? ` ${abbrev}` : ""}
    </time>
  );
}
