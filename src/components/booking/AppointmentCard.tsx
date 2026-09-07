"use client";
/**
 * The appointment itself, and the page's only <h1>.
 *
 * The clock on this card belongs to the APPOINTMENT, not to whoever opened the
 * link. The client has to physically be at the session, so a guest spot in
 * Berlin is 14:00 Berlin whether it is read from Almagro, from Madrid or from
 * a plane — rendering it on the reader's own clock would be answering a
 * question nobody asked, and it is how someone books a flight for the wrong
 * afternoon. Date and time are therefore both pinned to `view.timeZone`, which
 * the store resolved on read, so this component never sees an absent zone and
 * never needs the hydration swap `LocalTime` performs when it is left to
 * follow the viewer.
 *
 * The reader's own clock survives as a SECOND line, and only when it actually
 * reads differently — see `renderedKey`. When it is shown it is permanent:
 * never a tooltip, never behind a hover. Someone converting a time in their
 * head needs both readings visible at once, without interacting, or a timezone
 * becomes a missed appointment.
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
 * collapsed to one string. Their own local line is worth printing only when
 * this differs between their zone and the appointment's.
 *
 * Comparing the IANA identifiers instead is what this replaces: Córdoba,
 * Mendoza, Salta, Ushuaia, Montevideo and São Paulo all read exactly like
 * Buenos Aires, so every one of those readers got a byte-identical second
 * line — and so did a client physically in Buenos Aires, because V8 resolves
 * the system zone to the legacy "America/Buenos_Aires" while the env ships the
 * canonical "America/Argentina/Buenos_Aires". Now that the appointment carries
 * a zone of its own the trap only widens: an admin who types "Europe/Oslo" for
 * a session a Stockholm client reads about is the same identical-clock case,
 * one identifier apart.
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
  const card = dict.booking.card;

  const readerTz = resolveTimeZone(mounted);
  /**
   * The `mounted` gate is load-bearing here, not a precaution. Before mount
   * `resolveTimeZone` answers STUDIO_TIME_ZONE, which for a Berlin session is
   * neither the appointment's zone nor the reader's — so comparing without it
   * would render, server-side, a line labelled "your local time" that states
   * the studio's clock, and then contradict itself on hydration. Only the
   * browser knows where the reader is, so the line waits for the browser.
   */
  const showReaderTime =
    mounted &&
    renderedKey(view, locale, readerTz) !==
      renderedKey(view, locale, view.timeZone);

  /**
   * A late session in Europe is already the next morning in Asia. When the two
   * readings land on different dates a bare clock is a wrong answer, so that
   * one case — and only that one — makes the secondary line repeat the day.
   */
  const readerOnAnotherDay =
    showReaderTime &&
    dayKeyOf(view.startsAt, readerTz) !== dayKeyOf(view.startsAt, view.timeZone);

  return (
    <section className="border border-line p-5 flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {card.eyebrow}
      </p>
      {/* ICU data can differ between the Node build and the browser even for
          the same zone, which is a formatting difference and not a bug. */}
      <h1 className="font-serif italic text-3xl" suppressHydrationWarning>
        {formatDayLong(view.startsAt, view.timeZone, locale)}
      </h1>
      <p className="font-mono text-sm">
        {/* The caption earns its place only against a second line. With one
            clock on the card the zone abbreviation already says which clock it
            is, and captioning it would be lecturing a client in Buenos Aires
            about a timezone problem they do not have. */}
        {showReaderTime ? (
          <span className="text-muted">
            {card.appointmentTime}
            {" "}
          </span>
        ) : null}
        <LocalTime
          start={view.startsAt}
          end={view.endsAt}
          timeZone={view.timeZone}
          locale={locale}
          showZone
        />
      </p>
      {showReaderTime ? (
        <p className="font-mono text-xs text-muted">
          {card.yourTime}{" "}
          <LocalTime
            start={view.startsAt}
            end={view.endsAt}
            locale={locale}
            showZone
            showDate={readerOnAnotherDay}
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
