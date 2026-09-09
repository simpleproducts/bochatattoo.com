"use client";
/**
 * The end of the flow: the appointment is green and there is nothing left to
 * do but put it in a calendar.
 *
 * Deliberately actionless beyond that. The record is locked server-side once
 * it is confirmed, so offering an edit or a re-upload here would be a button
 * that can only fail; the two contact routes on the invalid panel are the
 * escape hatch when something really did change.
 *
 * TWO ROADS INTO GREEN, one panel. A receipt and an approved MercadoPago
 * payment are equally confirmed — deriveStatus says so — so the eyebrow, the
 * title, the time and the .ics are identical either way. Only two lines differ,
 * and they differ because one of them would otherwise be a lie: a client who
 * paid through MercadoPago has no comprobante to be told we received.
 *
 * The time repeated here is the appointment's own, same as on the card above:
 * this panel is the last thing a client reads before closing the tab, and it
 * would be a poor place to switch clocks on them. The .ics needs no such
 * decision — `buildIcs` stamps DTSTART/DTEND as UTC instants, which every
 * calendar app then draws on whatever clock its owner keeps.
 */
import { LocalTime } from "@/components/LocalTime";
import { INSTAGRAM_DM_URL, STUDIO_MAPS_URL } from "@/lib/site";
import { downloadIcs } from "./use-ics";
import type { ConfirmedPanelProps } from "./contract";

const LINK = "underline underline-offset-2 hover:text-fg transition-colors";

/**
 * Renders `done.body` with its two {placeholder} tokens replaced by real
 * anchors. Splitting the sentence at render — rather than storing three
 * fragments per language — is what lets Spanish and English each keep their
 * own word order around the links.
 */
function bodyWithLinks(
  template: string,
  labels: { studio: string; contact: string },
) {
  return template.split(/(\{studio\}|\{contact\})/).map((part, i) => {
    if (part === "{studio}") {
      return (
        <a
          key={i}
          href={STUDIO_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {labels.studio}
        </a>
      );
    }
    if (part === "{contact}") {
      return (
        <a
          key={i}
          href={INSTAGRAM_DM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {labels.contact}
        </a>
      );
    }
    return part;
  });
}

export function ConfirmedPanel({ view, locale, dict }: ConfirmedPanelProps) {
  const d = dict.booking.done;
  const email = view.client.email || view.seed.email;
  /**
   * An approved payment takes precedence over a receipt, in the rare case a
   * booking carries both — a client who transferred AND paid, or a studio that
   * attached a comprobante to a booking MercadoPago had already settled. The
   * payment is the stronger fact and the one the client acted on last, and the
   * paid copy is true either way: there is nothing left to send.
   */
  const paid = view.paid;

  return (
    <section className="border border-status-done p-6 flex flex-col gap-4">
      <div className="text-3xl leading-none text-status-done" aria-hidden>
        ✓
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {d.eyebrow}
        </p>
        <h2 className="font-serif italic text-2xl">{d.title}</h2>
        <LocalTime
          start={view.startsAt}
          end={view.endsAt}
          timeZone={view.timeZone}
          locale={locale}
          showDate
          showZone
          className="font-mono text-sm"
        />
      </div>

      <p className="text-sm leading-relaxed text-fg/80">
        {bodyWithLinks(paid ? d.paid.body : d.body, {
          studio: d.studioLink,
          contact: d.contactLink,
        })}
      </p>

      {/* The studio is private: the pin in the line above is the Subte stop,
          and the door itself arrives by message. Saying so stops a client
          hunting for an address on a page that deliberately does not carry
          one. */}
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {d.addressNote}
      </p>

      {email ? (
        <p className="font-mono text-xs text-muted break-all">
          {d.sentTo} {email}
        </p>
      ) : null}

      {paid ? (
        /* No comprobante line, because there is no comprobante and there never
           will be one — the payment itself is the proof, and asking a client
           who already paid to look for a receipt is the confusion this whole
           variant exists to avoid.

           No timestamp either, unlike the receipt line below. PublicBookingView
           carries `paid` as a bare boolean and nothing more: the page has no
           use for a provider payment id, and the moment the webhook committed
           is the studio's fact, not the client's. */
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {d.paid.received}
        </p>
      ) : view.receipt ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {dict.booking.receipt.uploaded}
          {" · "}
          {/* Left on the reader's clock on purpose. This is not the session,
              it is a thing they did — "you sent this at 14:22" is only useful
              in the zone they were standing in when they sent it. */}
          <LocalTime
            start={view.receipt.uploadedAt}
            locale={locale}
            showDate
          />
        </p>
      ) : null}

      <button
        type="button"
        onClick={() =>
          downloadIcs({
            id: view.id,
            startsAt: view.startsAt,
            endsAt: view.endsAt,
            title: d.calendarTitle,
          })
        }
        className="w-full min-h-[44px] border border-fg px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer"
      >
        {d.addToCalendar}
      </button>
    </section>
  );
}
