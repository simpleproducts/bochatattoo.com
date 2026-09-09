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
 *
 * THE ADDRESS. This panel is the ONLY page in the site that ever renders the
 * studio's street address, and it renders it without deciding anything: the
 * decision was made server-side in toPublicView(), which puts `studioAddress`
 * on the wire for a confirmed booking and `null` for every other state. There
 * is deliberately no status check here — a second gate in a client component
 * would be a copy of the rule that can drift from the real one, and it would
 * be guarding data the browser already has.
 *
 * With no address on the view (the studio has not typed one into the settings
 * tab yet) the panel falls back to `addressNote`, which promises the door by
 * message — still true, because that is exactly what happens when there is
 * nothing to publish here.
 */
import { useEffect, useRef, useState } from "react";
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

/**
 * Clipboard API first; the textarea dance covers iOS in a non-secure context.
 *
 * A verbatim twin of the helper inside PaymentDetails, and duplicated on
 * purpose: that one is private to that file, and lifting it into a shared
 * module would mean editing a component this change has no other business in.
 * Two copies of twenty lines is the cheaper of the two mistakes here.
 */
async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Falls through to the legacy path below.
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // Nothing left to try; the value is on screen and selectable by hand.
  }
  ta.remove();
}

export function ConfirmedPanel({ view, locale, dict }: ConfirmedPanelProps) {
  const d = dict.booking.done;
  const email = view.client.email || view.seed.email;
  /**
   * Present only on a confirmed booking with an address configured — see the
   * header. Read into a local so the JSX below narrows it once instead of
   * repeating the null check on every line that touches it.
   */
  const studio = view.studioAddress;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same shape as PaymentDetails': a bare cleanup, so the "copied ✓" timeout
  // cannot fire into an unmounted panel. No setState in the effect body.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copyAddress(address: string) {
    await copyText(address);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

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

      {studio ? (
        /* Read standing on a street, one-handed, probably in sunlight — so the
           address is the largest text in the panel and sits in its own framed
           block rather than in the run of muted mono lines below. The pin in
           the paragraph above stays: it still points at the Subte stop, which
           is how someone gets to the neighbourhood in the first place. */
        <div className="border border-line p-4 flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {d.addressTitle}
          </p>

          <div className="flex items-start justify-between gap-2">
            <p className="text-lg leading-snug break-words flex-1">
              {studio.address}
            </p>
            {/* The CBU idiom from PaymentDetails, for the same reason: the next
                thing this value does is get pasted into a maps app on the same
                phone. */}
            <button
              type="button"
              onClick={() => void copyAddress(studio.address)}
              aria-label={`${dict.booking.payment.copy} ${d.addressTitle}`}
              className="shrink-0 min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
            >
              <span aria-live="polite">
                {copied ? dict.booking.payment.copied : dict.booking.payment.copy}
              </span>
            </button>
          </div>

          {/* Optional even on a confirmed booking: the gate only requires an
              address, and a studio with nothing to say about the door leaves
              this empty rather than being made to invent a line. */}
          {studio.arrivalNote ? (
            <div className="flex flex-col gap-1 border-t border-line pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {d.arrivalLabel}
              </p>
              {/* The studio's own line breaks are kept: "3º B / timbre dos
                  veces" is two instructions, and reflowing them into one
                  sentence is how a client ends up at the wrong door. */}
              <p className="text-sm leading-relaxed text-fg/80 whitespace-pre-line break-words">
                {studio.arrivalNote}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        /* No address configured yet. The pin in the line above is the Subte
           stop, and the door itself arrives by message. Saying so stops a
           client hunting for an address the page does not carry. */
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {d.addressNote}
        </p>
      )}

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
