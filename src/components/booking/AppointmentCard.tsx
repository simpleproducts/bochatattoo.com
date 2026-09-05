"use client";
/**
 * The appointment itself, and the page's only <h1>.
 *
 * The date and the clock both belong to the reader's own zone, so both go
 * through the gate `LocalTime` documents: studio zone on the server and on the
 * first client render, the viewer's zone once mounted. Calling `Intl` straight
 * from render instead would hand React two different trees to reconcile.
 *
 * When it is shown, the studio-time line is permanent — never a tooltip, never
 * behind a hover. Someone reading this from another country needs both
 * readings visible at the same time, without interacting, or a timezone
 * becomes a missed appointment. `LocalTime` with an explicit `timeZone` is
 * pinned and never swaps.
 */
import { useSyncExternalStore } from "react";
import { LocalTime } from "@/components/LocalTime";
import {
  dayKeyOf,
  formatDayLong,
  formatTimeRange,
  resolveTimeZone,
  zoneAbbrev,
} from "@/lib/booking-time";
import type { AppointmentCardProps } from "./contract";

/**
 * "Has this component hydrated yet" is a fact about the runtime, not state.
 * `useSyncExternalStore` reads it without a setState-in-effect: the server
 * snapshot is false, so SSR and the first client render agree, and React then
 * re-renders once with true. The store never actually changes, hence the
 * no-op subscribe.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * "30.000" in Spanish, "30,000" in English. The currency code is printed
 * beside the number rather than through `style: "currency"`, which would
 * render ARS as a bare "$" — the one symbol that is ambiguous here.
 */
function formatAmount(amount: number, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Everything the reader would actually SEE for this appointment in `tz`,
 * collapsed to one string. The studio line is worth printing only when this
 * differs between the viewer's zone and the studio's.
 *
 * Comparing the IANA identifiers instead is what this replaces: Córdoba,
 * Mendoza, Salta, Ushuaia, Montevideo and São Paulo all read exactly like
 * Buenos Aires, so every one of those readers got a byte-identical second
 * line — and so did a client physically in Buenos Aires, because V8 resolves
 * the system zone to the legacy "America/Buenos_Aires" while the env ships the
 * canonical "America/Argentina/Buenos_Aires".
 *
 * All three parts matter. `LocalTime` appends the abbreviation, so two zones
 * that share a clock but not a label (ART vs GMT-3, whenever `zoneAbbrev`'s
 * shortOffset → short ladder falls through) really do render differently. The
 * day key catches a reader far enough east or west that the same instant falls
 * on another date. Note the consequence: the line's presence now depends on
 * the instant, so a Santiago reader sees it in April and not in September.
 */
function renderedKey(
  view: AppointmentCardProps["view"],
  locale: "es" | "en",
  tz: string,
): string {
  return [
    formatTimeRange(view.startsAt, view.endsAt, tz, locale),
    zoneAbbrev(view.startsAt, tz, locale),
    dayKeyOf(view.startsAt, tz),
  ].join("|");
}

export function AppointmentCard({ view, locale, dict }: AppointmentCardProps) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  const tz = resolveTimeZone(mounted);
  // Still gated on `mounted` and not on the comparison alone: before mount
  // `tz` IS the studio zone, and the gate — not the equality of the two keys —
  // is what guarantees SSR and the hydrating render emit the same tree.
  const showStudioTime =
    mounted &&
    renderedKey(view, locale, tz) !==
      renderedKey(view, locale, view.studioTimeZone);
  const card = dict.booking.card;

  return (
    <section className="border border-line p-5 flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {card.eyebrow}
      </p>
      {/* ICU data can differ between the Node build and the browser even for
          the same zone, which is a formatting difference and not a bug. */}
      <h1 className="font-serif italic text-3xl" suppressHydrationWarning>
        {formatDayLong(view.startsAt, tz, locale)}
      </h1>
      <LocalTime
        start={view.startsAt}
        end={view.endsAt}
        locale={locale}
        showZone
        className="font-mono text-sm"
      />
      {showStudioTime ? (
        <p className="font-mono text-xs text-muted">
          {card.studioTime}{" "}
          <LocalTime
            start={view.startsAt}
            end={view.endsAt}
            timeZone={view.studioTimeZone}
            locale={locale}
            showZone
          />
        </p>
      ) : null}
      {view.deposit ? (
        <p className="font-mono text-sm">
          <span className="text-muted">{card.deposit}</span>{" "}
          {view.deposit.currency} {formatAmount(view.deposit.amount, locale)}
        </p>
      ) : null}
    </section>
  );
}
