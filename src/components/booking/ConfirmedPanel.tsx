"use client";
/**
 * The end of the flow: the appointment is green and there is nothing left to
 * do but put it in a calendar.
 *
 * Deliberately actionless beyond that. The record is locked server-side once
 * it is confirmed, so offering an edit or a re-upload here would be a button
 * that can only fail; the two contact routes on the invalid panel are the
 * escape hatch when something really did change.
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
          locale={locale}
          showDate
          showZone
          className="font-mono text-sm"
        />
      </div>

      <p className="text-sm leading-relaxed text-fg/80">
        {bodyWithLinks(d.body, { studio: d.studioLink, contact: d.contactLink })}
      </p>

      {email ? (
        <p className="font-mono text-xs text-muted break-all">
          {d.sentTo} {email}
        </p>
      ) : null}

      {view.receipt ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {dict.booking.receipt.uploaded}
          {" · "}
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
