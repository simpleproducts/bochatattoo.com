/**
 * The "add to calendar" download: one VEVENT, built and handed to the browser.
 *
 * Not a hook despite the filename the manifest chose — nothing here needs React
 * state, so it stays a plain module ConfirmedPanel can call from an onClick.
 *
 * No `server-only`: browser-only code. RFC 5545 is unforgiving about two things
 * calendar apps then silently reject over — CRLF line endings, and TEXT values
 * with `\`, `,`, `;` and newlines escaped — so both are handled here.
 */

/** The studio address is given privately; it never goes in a file a client can forward. */
const DEFAULT_LOCATION = "Almagro, Buenos Aires";

export type IcsEvent = {
  /** The BookingId. Becomes the UID, so a second download updates the same event. */
  id: string;
  startsAt: string; // UTC ISO
  endsAt: string;   // UTC ISO
  /** SUMMARY — dict.booking.done.calendarTitle. */
  title: string;
  location?: string;
  description?: string;
};

export function buildIcs(ev: IcsEvent): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//bochatattoo//booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@bochatattoo.com`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART:${utcStamp(ev.startsAt)}`,
    `DTEND:${utcStamp(ev.endsAt)}`,
    `SUMMARY:${escapeText(ev.title)}`,
    `LOCATION:${escapeText(ev.location ?? DEFAULT_LOCATION)}`,
    ...(ev.description ? [`DESCRIPTION:${escapeText(ev.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "", // trailing CRLF — some parsers drop an unterminated last line
  ].join("\r\n");
}

export function downloadIcs(ev: IcsEvent, filename = "bocha-tattoo.ics"): void {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari cancels the download if the object URL dies in the same task.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "2026-09-04T14:22:00.000Z" → "20260904T142200Z" (UTC basic format). */
function utcStamp(utcIso: string): string {
  return new Date(utcIso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\r?\n/g, "\\n");
}
