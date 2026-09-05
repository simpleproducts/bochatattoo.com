/**
 * The four booking emails, and the one function that sends them.
 *
 * WHO READS WHAT. Owner mail is ALWAYS Spanish — there is exactly one reader
 * and he reads Spanish, so nothing on that half branches on a locale. Client
 * mail follows `client.locale`, the language of the page they actually used,
 * and falls back to "es" for a record that never got past the admin form.
 *
 * TIMES. Every time printed here is formatted with an explicit
 * `timeZone: STUDIO_TIME_ZONE` and ALWAYS carries the zone abbreviation. This
 * is the one surface where the product's viewer's-local-zone rule cannot hold:
 * email clients run no JavaScript, so there is no mount effect to swap in the
 * reader's own zone, and a bare "18:00" with no zone is exactly the ambiguity
 * that puts a client at the studio door an hour late. Do not "fix" this by
 * dropping the abbreviation, and never render UTC.
 *
 * ESCAPING. Names, notes, Instagram handles and receipt filenames all arrive
 * from a public link, so every value interpolated into the HTML twin goes
 * through `esc()`. That escaping lives inside the `html*` helpers below, which
 * are the only functions here that emit markup — a value therefore cannot
 * reach the HTML unescaped, and cannot be escaped twice either. The plain-text
 * twin and the subject line take the raw value on purpose: `&#39;` in a
 * subject line is a bug, not a defence. Subjects additionally collapse
 * whitespace so a pasted newline cannot smear the header.
 *
 * THE RECEIPT NEVER LEAVES THE PRIVATE BUCKET. Nothing here attaches it and no
 * email contains a URL that resolves to it. Owner mail carries the filename,
 * the size and the upload time plus a deep link into the admin calendar, which
 * sits behind the admin session — that is the only path to the bytes.
 *
 * COPY LIVES HERE, NOT IN THE DICTIONARY. `dict.booking` is typed for the
 * client page and every string in it is rendered by a React component; email
 * copy is a different medium (no JSX, a mandatory plain-text twin, an
 * owner-only Spanish half), and putting strings the site never renders into
 * the type that gates the whole build buys nothing.
 *
 * HTML CONSTRAINTS. Inline styles only — Gmail strips `<style>` blocks — light
 * background regardless of the site's dark palette, tables for layout, and no
 * external asset of any kind: a remote logo would leak an open-tracking signal
 * on a page about someone's bank transfer.
 *
 * Nothing in this file throws. `sendBookingEmails` runs only after the record
 * is already committed, so a mail failure must never turn a booking the client
 * completed into an error they see: failures come back as a log patch for the
 * caller to merge into `record.emails`, where the admin sheet shows them and
 * offers a Resend.
 */
import "server-only";
import { PAYMENT_DETAILS, PAYMENT_ENABLED } from "@/config/payment";
import type { Locale } from "@/i18n/config";
import { bookingLinks, mintBookingToken } from "./booking-token";
import {
  STUDIO_TIME_ZONE,
  durationLabel,
  formatDayLong,
  formatTimeRange,
  zoneAbbrev,
} from "./booking-time";
import {
  bookingLabel,
  type BookingEmailKind,
  type BookingEmailLog,
  type BookingRecord,
  type Currency,
} from "./bookings-types";
import {
  esc,
  sendTransactional,
  type Recipient,
  type TransactionalMessage,
} from "./email";
import {
  INSTAGRAM_DM_URL,
  SITE_EMAIL,
  SITE_URL,
  STUDIO_MAPS_URL,
} from "./site";

export type BuiltEmail = { subject: string; html: string; text: string };

/** See the header block: the owner half of this file never branches on locale. */
const OWNER_LOCALE: Locale = "es";

/* ────────────────────────── presentation constants ────────────────────────── */

// A light card, not the site's dark palette: a dark background survives no
// email client reliably, and half of them would render the text unreadable.
const PAGE = "#f5f3ef";
const CARD = "#ffffff";
const INK = "#141414";
const MUTED = "#6f6a63";
const LINE = "#e3ded4";

// Web fonts cannot be loaded (no external assets), so these are the closest
// stacks to the site's Instrument Serif / Geist Mono pairing that every client
// already has installed.
const FONT_BODY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_SERIF = "Georgia,'Times New Roman',serif";
const FONT_MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

const MONO_LABEL =
  `font-family:${FONT_MONO};font-size:11px;letter-spacing:0.12em;` +
  `text-transform:uppercase;color:${MUTED};`;

const FOOTER_ES = "bochatattoo.com · Correo automático";

/* ────────────────────────── small formatters ────────────────────────── */

type Row = { label: string; value: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A subject line is a single header field; a stray newline in a name is not. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** The house `{placeholder}` convention, same as footer.rights's `{year}`. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? vars[key] : whole,
  );
}

function pick(...values: (string | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

/**
 * booking-time exposes ranges, not single clocks. Formatting an instant against
 * itself yields "14:22–14:22", so this takes the half before the dash — cheaper
 * than a second `Intl` formatter here, and that module stays the only place in
 * the codebase that formats a time.
 */
function clockAt(utcIso: string, locale: Locale): string {
  const range = formatTimeRange(utcIso, utcIso, STUDIO_TIME_ZONE, locale);
  const [clock] = range.split("–");
  return clock || range;
}

/** "18:00–20:30 GMT-3". The abbreviation is never optional — see the header. */
function timeLine(b: BookingRecord, locale: Locale): string {
  return [
    formatTimeRange(b.startsAt, b.endsAt, STUDIO_TIME_ZONE, locale),
    zoneAbbrev(b.startsAt, STUDIO_TIME_ZONE, locale),
  ]
    .filter(Boolean)
    .join(" ");
}

/** "18:00 GMT-3" — a single clock still never travels without its zone. */
function clockLine(utcIso: string, locale: Locale): string {
  return [clockAt(utcIso, locale), zoneAbbrev(utcIso, STUDIO_TIME_ZONE, locale)]
    .filter(Boolean)
    .join(" ");
}

/** "12 de septiembre de 2026 · 14:22 GMT-3" — for a single stored instant. */
function stamp(utcIso: string, locale: Locale): string {
  return [
    formatDayLong(utcIso, STUDIO_TIME_ZONE, locale),
    `· ${clockAt(utcIso, locale)}`,
    zoneAbbrev(utcIso, STUDIO_TIME_ZONE, locale),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "30.000 ARS". Deliberately not `style: "currency"`: that renders ARS as a
 * bare "$", which is the one symbol an English-speaking client reads as USD.
 */
function money(amount: number, currency: Currency, locale: Locale): string {
  const digits = new Intl.NumberFormat(locale === "en" ? "en-GB" : "es-AR", {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${digits} ${currency}`;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Anything else — absent, or a locale added after this file — reads Spanish. */
function clientLocale(b: BookingRecord): Locale {
  return b.client.locale === "en" ? "en" : "es";
}

/* ────────────────────────── HTML blocks ────────────────────────── */
/* The ONLY markup emitters in this file, and therefore the only place esc()
   is applied. Every one of them takes raw text. */

function htmlEyebrow(text: string): string {
  return `<p style="margin:0 0 10px;${MONO_LABEL}">${esc(text)}</p>`;
}

function htmlTitle(text: string): string {
  return (
    `<h1 style="margin:0 0 20px;font-family:${FONT_SERIF};font-style:italic;` +
    `font-weight:400;font-size:28px;line-height:1.2;color:${INK};">${esc(text)}</h1>`
  );
}

function htmlPara(text: string): string {
  return (
    `<p style="margin:0 0 20px;font-family:${FONT_BODY};font-size:15px;` +
    `line-height:1.6;color:${INK};">${esc(text)}</p>`
  );
}

/**
 * Same paragraph, but the caller has already built the markup and escaped
 * every value inside it. The only caller is outroHtml, which needs anchors —
 * everything else must keep using htmlPara so escaping stays automatic.
 */
function htmlParaRaw(html: string): string {
  return (
    `<p style="margin:0 0 20px;font-family:${FONT_BODY};font-size:15px;` +
    `line-height:1.6;color:${INK};">${html}</p>`
  );
}

function htmlNote(text: string): string {
  return (
    `<p style="margin:0 0 20px;font-family:${FONT_BODY};font-size:13px;` +
    `line-height:1.6;color:${MUTED};">${esc(text)}</p>`
  );
}

function htmlRows(items: Row[]): string {
  if (!items.length) return "";
  const cells = items
    .map(
      (r) =>
        `<tr><td style="padding:9px 14px 9px 0;border-bottom:1px solid ${LINE};` +
        `${MONO_LABEL}white-space:nowrap;vertical-align:top;">${esc(r.label)}</td>` +
        `<td style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${FONT_BODY};` +
        `font-size:14px;line-height:1.5;color:${INK};vertical-align:top;">${esc(r.value)}</td></tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;margin:0 0 24px;">${cells}</table>`
  );
}

/** Free text the client typed. Newlines are theirs; keep them. */
function htmlQuote(label: string, body: string): string {
  const lines = esc(body).replace(/\r?\n/g, "<br />");
  return (
    `<p style="margin:0 0 8px;${MONO_LABEL}">${esc(label)}</p>` +
    `<div style="margin:0 0 24px;padding:2px 0 2px 14px;border-left:2px solid ${LINE};` +
    `font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${INK};">${lines}</div>`
  );
}

/**
 * The raw URL under the button is not redundant: a client that strips the
 * button's background colour leaves an invisible link, and a private booking
 * link nobody can copy is a dead end for someone already mid-flow.
 */
function htmlCta(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">` +
    `<tr><td style="background:${INK};"><a href="${esc(href)}" ` +
    `style="display:inline-block;padding:14px 24px;font-family:${FONT_MONO};font-size:11px;` +
    `letter-spacing:0.2em;text-transform:uppercase;color:#ffffff;text-decoration:none;">` +
    `${esc(label)}</a></td></tr></table>` +
    `<p style="margin:0 0 20px;font-family:${FONT_MONO};font-size:11px;line-height:1.5;` +
    `color:${MUTED};word-break:break-all;">${esc(href)}</p>`
  );
}

function shell(
  lang: Locale,
  preheader: string,
  content: string,
  footer: string,
): string {
  return (
    `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1" /></head>` +
    `<body style="margin:0;padding:0;background:${PAGE};">` +
    // Inbox preview line. Hidden in the body so it never renders twice.
    `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;` +
    `color:${PAGE};">${esc(preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background:${PAGE};"><tr><td align="center" style="padding:32px 16px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:560px;background:${CARD};border:1px solid ${LINE};">` +
    // 16px, not 36: every block above carries a 20px bottom margin, so the
    // optical padding under the last one matches the 36px over the first.
    `<tr><td style="padding:36px 32px 16px;">${content}</td></tr></table>` +
    `<p style="max-width:560px;margin:16px auto 0;font-family:${FONT_MONO};font-size:10px;` +
    `letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};text-align:center;">` +
    `${esc(footer)}</p></td></tr></table></body></html>`
  );
}

/* ────────────────────────── plain-text blocks ────────────────────────── */
/* A real twin, not a tag-stripped afterthought: some clients show it instead
   of the HTML, and every spam filter reads it. */

function textRows(items: Row[]): string {
  if (!items.length) return "";
  const width = Math.max(...items.map((r) => r.label.length)) + 2;
  return items.map((r) => `${`${r.label}:`.padEnd(width)}${r.value}`).join("\n");
}

/** Joins blocks, dropping the empty ones and any run of blank lines they left. */
function textDoc(blocks: string[]): string {
  return blocks
    .filter((b) => b !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ────────────────────────── client copy ────────────────────────── */

type ClientCopy = {
  subjectSubmitted: string;
  subjectConfirmed: string;
  greeting: string;
  eyebrowSubmitted: string;
  titleSubmitted: string;
  leadSubmitted: string;
  nextStep: string;
  payEyebrow: string;
  eyebrowConfirmed: string;
  titleConfirmed: string;
  leadConfirmed: string;
  /** Carries {studio} and {contact} placeholders — see outroHtml/outroText. */
  outroConfirmed: string;
  studioLink: string;
  contactLink: string;
  ctaOpen: string;
  ctaView: string;
  linkHint: string;
  reply: string;
  footer: string;
  labels: {
    date: string;
    time: string;
    duration: string;
    deposit: string;
    alias: string;
    cbu: string;
    holder: string;
    bank: string;
  };
};

const CLIENT_COPY: Record<Locale, ClientCopy> = {
  es: {
    subjectSubmitted: "Tu turno con Bocha · {date}",
    subjectConfirmed: "Turno confirmado · {date}",
    greeting: "Hola {name},",
    eyebrowSubmitted: "Tu turno",
    titleSubmitted: "Recibimos tus datos",
    leadSubmitted:
      "Guardamos tus datos y tu aceptación de los términos para el turno del {date}.",
    nextStep:
      "Falta un paso: transferí la seña y subí el comprobante desde tu link privado. " +
      "Cuando lo recibamos, el turno queda confirmado.",
    payEyebrow: "Datos para transferir",
    eyebrowConfirmed: "Turno confirmado",
    titleConfirmed: "Listo, tu turno está confirmado",
    leadConfirmed: "Recibimos tu comprobante. Nos vemos el {date} a las {time}.",
    outroConfirmed: "Nos vemos en {studio}. Cualquier cosa, {contact}.",
    studioLink: "el estudio",
    contactLink: "escribinos",
    ctaOpen: "Abrir mi turno",
    ctaView: "Ver mi turno",
    linkHint: "El link es personal: no lo compartas.",
    reply: "Si necesitás cambiar algo, respondé este correo.",
    footer: "bochatattoo.com · Correo automático",
    labels: {
      date: "Fecha",
      time: "Horario",
      duration: "Duración",
      deposit: "Seña",
      alias: "Alias",
      cbu: "CBU",
      holder: "Titular",
      bank: "Banco",
    },
  },
  en: {
    subjectSubmitted: "Your appointment with Bocha · {date}",
    subjectConfirmed: "Appointment confirmed · {date}",
    greeting: "Hi {name},",
    eyebrowSubmitted: "Your appointment",
    titleSubmitted: "We got your details",
    leadSubmitted:
      "Your details and your acceptance of the terms are saved for your session on {date}.",
    nextStep:
      "One step left: send the deposit and upload the receipt from your private link. " +
      "Once we have it, the appointment is confirmed.",
    payEyebrow: "Transfer details",
    eyebrowConfirmed: "Appointment confirmed",
    titleConfirmed: "You're all set",
    leadConfirmed: "We got your receipt. See you on {date} at {time}.",
    outroConfirmed: "See you at {studio}. Any questions, {contact}.",
    studioLink: "the studio",
    contactLink: "write to us",
    ctaOpen: "Open my appointment",
    ctaView: "View my appointment",
    linkHint: "This link is personal — please don't share it.",
    reply: "Need to change something? Just reply to this email.",
    footer: "bochatattoo.com · Automated message",
    labels: {
      date: "Date",
      time: "Time",
      duration: "Duration",
      deposit: "Deposit",
      alias: "Alias",
      cbu: "CBU",
      holder: "Account holder",
      bank: "Bank",
    },
  },
};

/** Date / time / duration / deposit — the block both client emails open with. */
function whenRows(b: BookingRecord, locale: Locale, c: ClientCopy): Row[] {
  const rows: Row[] = [
    { label: c.labels.date, value: formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale) },
    { label: c.labels.time, value: timeLine(b, locale) },
    { label: c.labels.duration, value: durationLabel(b.startsAt, b.endsAt) },
  ];
  if (b.deposit) {
    rows.push({
      label: c.labels.deposit,
      value: money(b.deposit.amount, b.deposit.currency, locale),
    });
  }
  return rows;
}

function paymentRows(c: ClientCopy): Row[] {
  if (!PAYMENT_ENABLED) return [];
  const rows: Row[] = [];
  if (PAYMENT_DETAILS.alias) rows.push({ label: c.labels.alias, value: PAYMENT_DETAILS.alias });
  if (PAYMENT_DETAILS.cbu) rows.push({ label: c.labels.cbu, value: PAYMENT_DETAILS.cbu });
  if (PAYMENT_DETAILS.holder) rows.push({ label: c.labels.holder, value: PAYMENT_DETAILS.holder });
  if (PAYMENT_DETAILS.bank) rows.push({ label: c.labels.bank, value: PAYMENT_DETAILS.bank });
  return rows;
}

/* ────────────────────────── owner blocks ────────────────────────── */

/**
 * The client's own value wins and the seed fills the gap. Storage keeps the two
 * apart forever (a client can never overwrite what Bocha typed), but for a
 * notification the freshest value is the useful one.
 */
function contactRows(b: BookingRecord): Row[] {
  const rows: Row[] = [];
  const name = pick(b.client.name, b.seed.name);
  const email = pick(b.client.email, b.seed.email);
  const instagram = pick(b.client.instagram, b.seed.instagram);
  const phone = pick(b.client.phone, b.seed.phone);
  if (name) rows.push({ label: "Nombre", value: name });
  if (email) rows.push({ label: "Email", value: email });
  if (instagram) rows.push({ label: "Instagram", value: `@${instagram}` });
  if (phone) rows.push({ label: "Teléfono", value: phone });
  return rows;
}

function ownerBaseRows(b: BookingRecord): Row[] {
  const locale = OWNER_LOCALE;
  const rows: Row[] = [
    { label: "Fecha", value: formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale) },
    { label: "Horario", value: timeLine(b, locale) },
    { label: "Duración", value: durationLabel(b.startsAt, b.endsAt) },
    ...contactRows(b),
  ];
  if (b.deposit) {
    rows.push({
      label: "Seña",
      value: money(b.deposit.amount, b.deposit.currency, locale),
    });
  }
  if (b.client.termsAcceptedAt) {
    rows.push({
      label: "Términos",
      value:
        `${stamp(b.client.termsAcceptedAt, locale)}` +
        (b.client.termsVersion ? ` · v${b.client.termsVersion}` : ""),
    });
  }
  rows.push({ label: "Referencia", value: b.id });
  return rows;
}

/** Deep link into the sheet for this booking. Behind the admin session. */
function adminUrl(b: BookingRecord): string {
  return `${SITE_URL}/admin/calendar?b=${b.id}`;
}

/* ────────────────────────── the four builders ────────────────────────── */

export function buildOwnerSubmitted(b: BookingRecord): BuiltEmail {
  const locale = OWNER_LOCALE;
  const label = bookingLabel(b);
  const date = formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale);
  const rows = ownerBaseRows(b);
  const note = b.client.note?.trim() ?? "";
  const lead =
    "Completó sus datos y aceptó los términos. Falta el comprobante de la seña.";
  const url = adminUrl(b);

  return {
    subject: oneLine(`Datos recibidos · ${label} · ${date}`),
    html: shell(
      locale,
      `${label} · ${date} · ${timeLine(b, locale)}`,
      [
        htmlEyebrow("Datos recibidos"),
        htmlTitle(label),
        htmlPara(lead),
        htmlRows(rows),
        note ? htmlQuote("Mensaje del cliente", note) : "",
        htmlCta(url, "Ver en el calendario"),
      ].join(""),
      FOOTER_ES,
    ),
    text: textDoc([
      "DATOS RECIBIDOS",
      label,
      lead,
      textRows(rows),
      note ? `Mensaje del cliente:\n${note}` : "",
      `Ver en el calendario:\n${url}`,
      `—\n${FOOTER_ES}`,
    ]),
  };
}

export function buildOwnerConfirmed(b: BookingRecord): BuiltEmail {
  const locale = OWNER_LOCALE;
  const label = bookingLabel(b);
  const date = formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale);
  const rows = ownerBaseRows(b);
  if (b.receipt) {
    rows.push(
      { label: "Archivo", value: b.receipt.filename },
      { label: "Tamaño", value: fileSize(b.receipt.bytes) },
      { label: "Subido", value: stamp(b.receipt.uploadedAt, locale) },
    );
  }
  const lead = "El cliente subió el comprobante. El turno queda confirmado.";
  // Says out loud what the header block enforces: bank data never travels by
  // mail, so "where is the file" has exactly one answer.
  const privacy =
    "El comprobante no viaja por correo: abrilo desde el calendario, con tu sesión de admin.";
  const url = adminUrl(b);

  return {
    subject: oneLine(`Comprobante recibido · ${label} · ${date}`),
    html: shell(
      locale,
      `${label} · ${date} · ${timeLine(b, locale)}`,
      [
        htmlEyebrow("Comprobante recibido"),
        htmlTitle(label),
        htmlPara(lead),
        htmlRows(rows),
        htmlNote(privacy),
        htmlCta(url, "Ver el comprobante"),
      ].join(""),
      FOOTER_ES,
    ),
    text: textDoc([
      "COMPROBANTE RECIBIDO",
      label,
      lead,
      textRows(rows),
      privacy,
      `Ver el comprobante:\n${url}`,
      `—\n${FOOTER_ES}`,
    ]),
  };
}

export function buildClientSubmitted(b: BookingRecord, token: string): BuiltEmail {
  const locale = clientLocale(b);
  const c = CLIENT_COPY[locale];
  const date = formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale);
  const name = pick(b.client.name, b.seed.name);
  const greeting = name ? fill(c.greeting, { name }) : "";
  const lead = fill(c.leadSubmitted, { date });
  const rows = whenRows(b, locale, c);
  const pay = paymentRows(c);
  const link = bookingLinks(token)[locale];

  return {
    subject: oneLine(fill(c.subjectSubmitted, { date })),
    html: shell(
      locale,
      `${date} · ${timeLine(b, locale)}`,
      [
        htmlEyebrow(c.eyebrowSubmitted),
        htmlTitle(c.titleSubmitted),
        greeting ? htmlPara(greeting) : "",
        htmlPara(lead),
        htmlRows(rows),
        htmlPara(c.nextStep),
        pay.length ? htmlEyebrow(c.payEyebrow) + htmlRows(pay) : "",
        htmlCta(link, c.ctaOpen),
        htmlNote(c.linkHint),
      ].join(""),
      c.footer,
    ),
    text: textDoc([
      c.eyebrowSubmitted.toUpperCase(),
      c.titleSubmitted,
      greeting,
      lead,
      textRows(rows),
      c.nextStep,
      pay.length ? `${c.payEyebrow}:\n${textRows(pay)}` : "",
      `${c.ctaOpen}:\n${link}`,
      c.linkHint,
      `—\n${c.footer}`,
    ]),
  };
}

/**
 * The closing line, with its two placeholders resolved.
 *
 * HTML gets real anchors; the plain-text twin gets the label followed by the
 * bare URL in parentheses, because a text-only client cannot click anything
 * and "escribinos" with no address is a dead end. `esc` is applied to the
 * labels for the same reason it is applied everywhere else in this file — the
 * URLs are our own constants, the labels come from the copy table.
 */
function outroHtml(c: ClientCopy): string {
  const filled = c.outroConfirmed
    .replace(
      "{studio}",
      `<a href="${STUDIO_MAPS_URL}" style="color:${INK};">${esc(c.studioLink)}</a>`,
    )
    .replace(
      "{contact}",
      `<a href="${INSTAGRAM_DM_URL}" style="color:${INK};">${esc(c.contactLink)}</a>`,
    );
  return htmlParaRaw(filled);
}

function outroText(c: ClientCopy): string {
  return c.outroConfirmed
    .replace("{studio}", `${c.studioLink} (${STUDIO_MAPS_URL})`)
    .replace("{contact}", `${c.contactLink} (${INSTAGRAM_DM_URL})`);
}

/**
 * `token` is optional only so a caller holding just a record can still build
 * this mail; `sendBookingEmails` always passes one, because a confirmation the
 * client cannot click back into is a worse confirmation.
 */
export function buildClientConfirmed(b: BookingRecord, token?: string): BuiltEmail {
  const locale = clientLocale(b);
  const c = CLIENT_COPY[locale];
  const date = formatDayLong(b.startsAt, STUDIO_TIME_ZONE, locale);
  const time = clockLine(b.startsAt, locale);
  const name = pick(b.client.name, b.seed.name);
  const greeting = name ? fill(c.greeting, { name }) : "";
  const lead = fill(c.leadConfirmed, { date, time });
  const rows = whenRows(b, locale, c);
  const link = token ? bookingLinks(token)[locale] : "";

  return {
    subject: oneLine(fill(c.subjectConfirmed, { date })),
    html: shell(
      locale,
      `${date} · ${timeLine(b, locale)}`,
      [
        htmlEyebrow(c.eyebrowConfirmed),
        htmlTitle(c.titleConfirmed),
        greeting ? htmlPara(greeting) : "",
        htmlPara(lead),
        htmlRows(rows),
        outroHtml(c),
        link ? htmlCta(link, c.ctaView) : "",
        htmlNote(c.reply),
      ].join(""),
      c.footer,
    ),
    text: textDoc([
      c.eyebrowConfirmed.toUpperCase(),
      c.titleConfirmed,
      greeting,
      lead,
      textRows(rows),
      outroText(c),
      link ? `${c.ctaView}:\n${link}` : "",
      c.reply,
      `—\n${c.footer}`,
    ]),
  };
}

/* ────────────────────────── sending ────────────────────────── */

function isClientKind(kind: BookingEmailKind): boolean {
  return kind === "clientSubmitted" || kind === "clientConfirmed";
}

/**
 * Where booking notifications land. Defaults to the studio's public address, so
 * the feature notifies correctly out of the box — BOOKING_NOTIFY_EMAIL only
 * exists to point them somewhere else.
 */
function ownerRecipient(): Recipient | null {
  const email = process.env.BOOKING_NOTIFY_EMAIL?.trim() || SITE_EMAIL;
  return email ? { email, name: "Bocha Tattoo" } : null;
}

/** The seed address is the fallback: a client who never typed one still gets mail. */
function clientRecipient(b: BookingRecord): Recipient | null {
  const email = pick(b.client.email, b.seed.email);
  if (!email) return null;
  const name = pick(b.client.name, b.seed.name);
  return name ? { email, name } : { email };
}

/**
 * Send the requested kinds and hand back the patch for `record.emails`.
 *
 * Ordering is the caller's job and is always the same: the record commits
 * first, then this runs, then the returned patch goes back in a second
 * `mutateBooking`. Nothing here throws — a kind with no recipient is skipped
 * silently and leaves no log entry, and every real failure comes back in
 * `lastError` for the sheet to show and the Resend button to retry.
 */
export async function sendBookingEmails(
  b: BookingRecord,
  kinds: BookingEmailKind[],
): Promise<Partial<BookingEmailLog>> {
  const patch: Partial<BookingEmailLog> = {};
  // A caller that names the same kind twice must not mail the client twice.
  const wanted = Array.from(new Set(kinds));
  if (!wanted.length) return patch;

  const owner = ownerRecipient();
  const client = clientRecipient(b);
  const failures: { kind: BookingEmailKind; message: string }[] = [];

  // One mint for both client mails: the token is a pure function of the record.
  let token = "";
  let tokenError = "";
  if (client && wanted.some(isClientKind)) {
    try {
      token = await mintBookingToken(b.id, b.tokenEpoch);
    } catch (err) {
      // Only reachable with BOOKING_TOKEN_SECRET unset — in which case the
      // record could never have been read in the first place.
      tokenError = messageOf(err);
    }
  }

  const jobs: { kind: BookingEmailKind; message: TransactionalMessage }[] = [];
  for (const kind of wanted) {
    const toOwner = kind === "ownerSubmitted" || kind === "ownerConfirmed";
    const to = toOwner ? owner : client;
    if (!to) continue; // No address configured / on file. Not a failure.
    if (!toOwner && !token) {
      failures.push({ kind, message: tokenError || "No booking token." });
      continue;
    }

    let built: BuiltEmail;
    try {
      built =
        kind === "ownerSubmitted"
          ? buildOwnerSubmitted(b)
          : kind === "ownerConfirmed"
            ? buildOwnerConfirmed(b)
            : kind === "clientSubmitted"
              ? buildClientSubmitted(b, token)
              : buildClientConfirmed(b, token);
    } catch (err) {
      // A stored value the formatters reject (an unparseable date) must not
      // take down a request whose write already committed.
      failures.push({ kind, message: messageOf(err) });
      continue;
    }

    jobs.push({
      kind,
      message: {
        to: [to],
        subject: built.subject,
        htmlContent: built.html,
        textContent: built.text,
        // Hitting reply on the notification reaches the client directly.
        ...(toOwner && client ? { replyTo: client } : {}),
        tags: ["booking", kind],
      },
    });
  }

  // allSettled, not all: one dead recipient must not cancel the other mail.
  const results = await Promise.allSettled(
    jobs.map((job) => sendTransactional(job.message)),
  );
  const at = new Date().toISOString();

  results.forEach((result, i) => {
    const { kind } = jobs[i];
    if (result.status === "rejected") {
      failures.push({ kind, message: messageOf(result.reason) });
      return;
    }
    const sent = result.value;
    if (sent.ok) {
      patch[kind] = at;
      return;
    }
    failures.push({ kind, message: `${sent.code}: ${sent.message}` });
  });

  for (const failure of failures) {
    console.error(`[booking-emails] ${b.id} ${failure.kind}: ${failure.message}`);
  }

  // `lastError` is one slot: the most recent failure is the one worth showing,
  // and the rest are in the logs. Truncated so a chatty upstream cannot bloat
  // the record on every retry.
  const last = failures[failures.length - 1];
  if (last) {
    patch.lastError = { at, kind: last.kind, message: last.message.slice(0, 300) };
  }
  return patch;
}
