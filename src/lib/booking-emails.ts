/**
 * The four booking emails, and the one function that sends them.
 *
 * WHO READS WHAT. Owner mail is ALWAYS Spanish — there is exactly one reader
 * and he reads Spanish, so nothing on that half branches on a locale. Client
 * mail follows `client.locale`, the language of the page they actually used,
 * and falls back to "es" for a record that never got past the admin form.
 *
 * TIMES. Every time printed here is formatted in the APPOINTMENT'S OWN zone —
 * the zone of the place that session happens — and ALWAYS carries the zone
 * abbreviation. Email is the one surface where the reader's own zone cannot be
 * read at all: email clients run no JavaScript, so there is no mount effect to
 * swap anything in. That reasoning has not changed; what changed is WHICH zone,
 * because there is no longer a single studio clock — Bocha works in Buenos
 * Aires but also does guest spots in Europe and the USA, and a Berlin session
 * is 14:00 Berlin no matter where the mail is opened. The abbreviation matters
 * more for that, not less: it is the only thing that lets a client in Madrid
 * tell a Madrid appointment from a Buenos Aires one with nothing but this email
 * in front of them, and a bare "18:00" is the ambiguity that puts someone at
 * the door an hour late — or a flight away. Do not "fix" this by dropping the
 * abbreviation, and never render UTC.
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
 * TWO WAYS A DEPOSIT ARRIVES, AND THE MAIL SAYS WHICH. A transfer leaves a
 * receipt; a MercadoPago payment leaves `record.payment` and NO receipt at all,
 * because its webhook is what confirms it. So the confirmation mails do not
 * report "the receipt" — they report the deposit, from whichever of the two
 * facts the record actually holds, and a client who paid through MercadoPago is
 * never told they still owe a comprobante. The provider's payment id and the
 * amount it actually charged go to the OWNER only: they are what the studio
 * types into their MercadoPago account to find the payment, and the client
 * already has MercadoPago's own receipt for the same transaction.
 *
 * SETTINGS COME FROM THE SETTINGS DOCUMENT, resolved once per batch in
 * `sendBookingEmails` and handed down — sender to `sendTransactional`, transfer
 * details and the studio's street address to the builders that print them. The
 * builders stay pure functions of a record: they do no I/O, so any of them can
 * be rendered in a test or a preview without a bucket. An empty settings field
 * means "fall back" (to the env var, then to a constant) for the sender, and
 * simply "print nothing" for the blocks that are optional.
 *
 * THE STREET ADDRESS TRAVELS IN EXACTLY ONE OF THESE FOUR MAILS.
 * `buildClientConfirmed`, and nowhere else. Not `buildClientSubmitted`: that one
 * goes out while the booking is still amber, and the private link it carries is
 * forwarded and screenshotted long before anybody has paid. Not the owner mails
 * either — Bocha knows where his own studio is, so a copy there would be one
 * more inbox holding the address for no reader who needs it.
 *
 * AND THERE IS NO STATUS CHECK AROUND IT, on purpose. `clientConfirmed` is
 * queued on the TRANSITION into confirmed and by nothing else: the receipt route
 * and the MercadoPago webhook each queue it in the same breath as writing the
 * receipt or the approved payment that made the booking green. Restating
 * `deriveStatus(b) === "confirmed"` inside the builder would put the rule in a
 * second place, where it is free to drift from the real one in booking-status.ts
 * and where nothing would ever exercise it. The caller decides which mail to
 * send; this file prints the mail it was asked for.
 *
 * (The admin Resend button can re-issue any kind on any booking. That is a
 * deliberate act by the one person who owns the address, taken behind the admin
 * session — a different thing entirely from a forwarded link, and not what the
 * gate in toPublicView exists to stop.)
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
import type { Locale } from "@/i18n/config";
import { bookingLinks, mintBookingToken } from "./booking-token";
import {
  durationLabel,
  formatDayLong,
  formatTimeRange,
  recordTimeZone,
  zoneAbbrev,
} from "./booking-time";
import {
  bookingLabel,
  type BookingEmailKind,
  type BookingEmailLog,
  type BookingPayment,
  type BookingRecord,
} from "./bookings-types";
import {
  DEFAULT_SENDER_NAME,
  esc,
  sendTransactional,
  type Recipient,
  type Sender,
  type TransactionalMessage,
} from "./email";
import { loadSettings } from "./settings-store";
import {
  DEFAULT_SETTINGS,
  type EmailSettings,
  type PaymentMethod,
  type Settings,
  type StudioSettings,
  type TransferSettings,
} from "./settings-types";
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
function clockAt(utcIso: string, tz: string, locale: Locale): string {
  const range = formatTimeRange(utcIso, utcIso, tz, locale);
  const [clock] = range.split("–");
  return clock || range;
}

/** "18:00–20:30 GMT-3". The abbreviation is never optional — see the header. */
function timeLine(b: BookingRecord, locale: Locale): string {
  const tz = recordTimeZone(b);
  return [
    formatTimeRange(b.startsAt, b.endsAt, tz, locale),
    zoneAbbrev(b.startsAt, tz, locale),
  ]
    .filter(Boolean)
    .join(" ");
}

/** "18:00 GMT-3" — a single clock still never travels without its zone. */
function clockLine(utcIso: string, tz: string, locale: Locale): string {
  return [clockAt(utcIso, tz, locale), zoneAbbrev(utcIso, tz, locale)]
    .filter(Boolean)
    .join(" ");
}

/**
 * "12 de septiembre de 2026 · 14:22 GMT-3" — for a single stored instant. Takes
 * the appointment's zone like everything else: a mail that printed the session
 * on one clock and its receipt upload on another would read as two different
 * days for a guest spot far enough east.
 */
function stamp(utcIso: string, tz: string, locale: Locale): string {
  return [
    formatDayLong(utcIso, tz, locale),
    `· ${clockAt(utcIso, tz, locale)}`,
    zoneAbbrev(utcIso, tz, locale),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "30.000 ARS". Deliberately not `style: "currency"`: that renders ARS as a
 * bare "$", which is the one symbol an English-speaking client reads as USD.
 *
 * `currency` is a plain string rather than `Currency` because the second caller
 * is a payment, where the code is MercadoPago's report of what it charged and
 * not one of our three. Printing it verbatim is the point: an amount whose code
 * we did not recognise must still be shown exactly as the provider stated it.
 */
function money(amount: number, currency: string, locale: Locale): string {
  const digits = new Intl.NumberFormat(locale === "en" ? "en-GB" : "es-AR", {
    maximumFractionDigits: 2,
  }).format(amount);
  // A provider can report an amount without a code. "30.000" alone is still a
  // number the studio can match against their account; "30.000 undefined" is not.
  return currency ? `${digits} ${currency}` : digits;
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
  /** When the transfer block is printed below it: the deposit goes to an account. */
  nextStep: string;
  /** When it is not — MercadoPago only, or nothing configured. Names no method. */
  nextStepPay: string;
  /** Replaces both of the above once `record.payment` exists. Nothing is owed. */
  nextStepPaid: string;
  payEyebrow: string;
  eyebrowConfirmed: string;
  titleConfirmed: string;
  leadConfirmed: string;
  /** The same line for a booking confirmed by a payment, which has no receipt. */
  leadConfirmedPaid: string;
  /** Heads the address block. Printed only when there is an address to head. */
  addressEyebrow: string;
  /** Carries {studio} and {contact} placeholders — see outroHtml/outroText. */
  outroConfirmed: string;
  /**
   * The same closing line for a mail that just printed the address, with the
   * "I'll send it by message" promise taken out — it is the one sentence that
   * would be false three centimetres under the street the client is being sent
   * to. Same two placeholders, same renderer; the Medrano pin stays, because
   * getting to the neighbourhood is still the first half of the trip.
   */
  outroConfirmedAddress: string;
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
    /** How the deposit arrived. The row only exists once one of them has. */
    payment: string;
    /** The street itself. Confirmed client mail only — see the header. */
    address: string;
    /** Heads the door instructions: buzzer, floor, which bell to ring. */
    arrival: string;
    alias: string;
    cbu: string;
    holder: string;
    bank: string;
  };
  /** Keyed by BookingPayment["method"], so the union is what fills this in. */
  methods: Record<PaymentMethod, string>;
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
    nextStepPay:
      "Falta un paso: pagá la seña desde tu link privado. " +
      "Cuando la recibamos, el turno queda confirmado.",
    nextStepPaid: "Ya recibimos tu pago: no falta nada más.",
    payEyebrow: "Datos para transferir",
    eyebrowConfirmed: "Turno confirmado",
    titleConfirmed: "Listo, tu turno está confirmado",
    leadConfirmed: "Recibimos tu comprobante. Nos vemos el {date} a las {time}.",
    leadConfirmedPaid: "Recibimos tu pago. Nos vemos el {date} a las {time}.",
    addressEyebrow: "Dirección del estudio",
    outroConfirmed:
      "Nos vemos en Almagro, a pasos de {studio}. Te paso la dirección exacta por mensaje antes del turno. Cualquier cosa, {contact}.",
    outroConfirmedAddress:
      "Nos vemos en Almagro, a pasos de {studio}. Cualquier cosa, {contact}.",
    studioLink: "la estación Medrano",
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
      payment: "Pago",
      address: "Dirección",
      arrival: "Al llegar",
      alias: "Alias",
      cbu: "CBU",
      holder: "Titular",
      bank: "Banco",
    },
    // A brand name is a brand name in both languages; only the bank line moves.
    methods: { mercadopago: "MercadoPago", transfer: "Transferencia bancaria" },
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
    nextStepPay:
      "One step left: pay the deposit from your private link. " +
      "Once we have it, the appointment is confirmed.",
    nextStepPaid: "Your payment is in — there's nothing else to do.",
    payEyebrow: "Transfer details",
    eyebrowConfirmed: "Appointment confirmed",
    titleConfirmed: "You're all set",
    leadConfirmed: "We got your receipt. See you on {date} at {time}.",
    leadConfirmedPaid: "We got your payment. See you on {date} at {time}.",
    addressEyebrow: "Studio address",
    outroConfirmed:
      "See you in Almagro, a short walk from {studio}. I'll send you the exact address by message before your appointment. Any questions, {contact}.",
    outroConfirmedAddress:
      "See you in Almagro, a short walk from {studio}. Any questions, {contact}.",
    studioLink: "Medrano station",
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
      payment: "Payment",
      address: "Address",
      arrival: "When you arrive",
      alias: "Alias",
      cbu: "CBU",
      holder: "Account holder",
      bank: "Bank",
    },
    methods: { mercadopago: "MercadoPago", transfer: "Bank transfer" },
  },
};

/** Date / time / duration / deposit — the block both client emails open with. */
function whenRows(b: BookingRecord, locale: Locale, c: ClientCopy): Row[] {
  const rows: Row[] = [
    {
      label: c.labels.date,
      value: formatDayLong(b.startsAt, recordTimeZone(b), locale),
    },
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

/**
 * Where to transfer — read from the settings document the studio edits, not
 * from a deploy-time constant, so a changed account reaches the next mail
 * instead of the next deploy.
 *
 * `enabled` alone does not print the block: a titular and a bank are not
 * somewhere money can be sent, so with neither alias nor CBU there is no
 * destination and the rows would answer nothing. Callers read the emptiness of
 * what comes back as exactly that question — see buildClientSubmitted, which
 * switches to a copy line that names no method when there is nothing to print.
 */
function transferRows(c: ClientCopy, transfer: TransferSettings): Row[] {
  if (!transfer.enabled) return [];
  const alias = transfer.alias.trim();
  const cbu = transfer.cbu.trim();
  if (!alias && !cbu) return [];
  const holder = transfer.holder.trim();
  const bank = transfer.bank.trim();
  const rows: Row[] = [];
  if (alias) rows.push({ label: c.labels.alias, value: alias });
  if (cbu) rows.push({ label: c.labels.cbu, value: cbu });
  if (holder) rows.push({ label: c.labels.holder, value: holder });
  if (bank) rows.push({ label: c.labels.bank, value: bank });
  return rows;
}

/**
 * How the deposit arrived, for the CLIENT: the method and nothing else.
 *
 * No amount (the Seña row above already carries what was agreed) and no
 * provider payment id — the client holds MercadoPago's own receipt for this
 * transaction, and our internal reference for it is not theirs to reconcile.
 */
function clientPaymentRow(payment: BookingPayment, c: ClientCopy): Row {
  return { label: c.labels.payment, value: c.methods[payment.method] };
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
  const tz = recordTimeZone(b);
  const rows: Row[] = [
    { label: "Fecha", value: formatDayLong(b.startsAt, tz, locale) },
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
        `${stamp(b.client.termsAcceptedAt, tz, locale)}` +
        (b.client.termsVersion ? ` · v${b.client.termsVersion}` : ""),
    });
  }
  rows.push({ label: "Referencia", value: b.id });
  return rows;
}

/** Owner mail never branches on locale (see the header), so these are literals. */
const OWNER_METHOD: Record<PaymentMethod, string> = {
  mercadopago: "MercadoPago",
  transfer: "Transferencia bancaria",
};

/**
 * HOW THE DEPOSIT ARRIVED, for the owner: every fact the record actually holds.
 *
 * A MercadoPago booking has a payment and no receipt; a transfer has a receipt
 * and no payment; a client who paid online and then also sent a screenshot the
 * studio attached has both, so the two blocks are appended, never chosen
 * between. An empty result means neither is on file yet — a state the confirmed
 * mails are not sent in, but which a resend of an older booking can still reach.
 *
 * `providerPaymentId` is owner-only, and this is the only function that prints
 * it: it exists so the studio can find the payment inside their MercadoPago
 * account, which is not something a client is ever asked to do.
 */
function ownerDepositRows(b: BookingRecord, tz: string, locale: Locale): Row[] {
  const rows: Row[] = [];
  if (b.payment) {
    rows.push({ label: "Pago", value: OWNER_METHOD[b.payment.method] });
    if (b.payment.amount !== undefined) {
      // What the provider says it CHARGED, which is a different fact from the
      // "Seña" row above — that one is what was agreed when the booking was
      // created, and a mismatch between them is worth seeing side by side.
      rows.push({
        label: "Cobrado",
        value: money(b.payment.amount, b.payment.currency ?? "", locale),
      });
    }
    if (b.payment.providerPaymentId) {
      rows.push({ label: "ID de pago", value: b.payment.providerPaymentId });
    }
    rows.push({ label: "Pagado", value: stamp(b.payment.paidAt, tz, locale) });
  }
  if (b.receipt) {
    rows.push(
      { label: "Archivo", value: b.receipt.filename },
      { label: "Tamaño", value: fileSize(b.receipt.bytes) },
      { label: "Subido", value: stamp(b.receipt.uploadedAt, tz, locale) },
    );
  }
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
  const date = formatDayLong(b.startsAt, recordTimeZone(b), locale);
  const rows = ownerBaseRows(b);
  const note = b.client.note?.trim() ?? "";
  // A resend can reach a booking that has since been paid; "falta el
  // comprobante" would then be the one line in this mail that is false.
  const lead = b.payment
    ? "Completó sus datos y aceptó los términos. La seña ya está paga."
    : "Completó sus datos y aceptó los términos. Falta el comprobante de la seña.";
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
  const tz = recordTimeZone(b);
  const label = bookingLabel(b);
  const date = formatDayLong(b.startsAt, tz, locale);
  const rows = [...ownerBaseRows(b), ...ownerDepositRows(b, tz, locale)];

  // The headline names the fact that made this booking green, so the subject
  // line answers "what arrived" from the inbox list alone. Three cases, because
  // a payment and a comprobante are different things to go looking for.
  const eyebrow = b.payment
    ? b.receipt
      ? "Seña recibida"
      : "Pago recibido"
    : "Comprobante recibido";
  const lead = b.payment
    ? b.receipt
      ? "Hay un pago registrado y un comprobante en el turno. Queda confirmado."
      : `El cliente pagó la seña por ${OWNER_METHOD[b.payment.method]}. El turno queda confirmado.`
    : "Se subió el comprobante de la seña. El turno queda confirmado.";
  // Says out loud what the header block enforces: bank data never travels by
  // mail, so "where is the file" has exactly one answer. Only with a file:
  // a MercadoPago booking has nothing to open and nothing to reassure about.
  const privacy = b.receipt
    ? "El comprobante no viaja por correo: abrilo desde el calendario, con tu sesión de admin."
    : "";
  const cta = b.receipt ? "Ver el comprobante" : "Ver en el calendario";
  const url = adminUrl(b);

  return {
    subject: oneLine(`${eyebrow} · ${label} · ${date}`),
    html: shell(
      locale,
      `${label} · ${date} · ${timeLine(b, locale)}`,
      [
        htmlEyebrow(eyebrow),
        htmlTitle(label),
        htmlPara(lead),
        htmlRows(rows),
        privacy ? htmlNote(privacy) : "",
        htmlCta(url, cta),
      ].join(""),
      FOOTER_ES,
    ),
    text: textDoc([
      eyebrow.toUpperCase(),
      label,
      lead,
      textRows(rows),
      privacy,
      `${cta}:\n${url}`,
      `—\n${FOOTER_ES}`,
    ]),
  };
}

/**
 * `transfer` is passed in rather than read here because the builders are pure
 * functions of a record — see the header. It decides two things at once: which
 * account rows appear, and which of the three "what happens next" lines the
 * mail closes the step with.
 */
export function buildClientSubmitted(
  b: BookingRecord,
  token: string,
  transfer: TransferSettings,
): BuiltEmail {
  const locale = clientLocale(b);
  const c = CLIENT_COPY[locale];
  const date = formatDayLong(b.startsAt, recordTimeZone(b), locale);
  const name = pick(b.client.name, b.seed.name);
  const greeting = name ? fill(c.greeting, { name }) : "";
  const lead = fill(c.leadSubmitted, { date });
  const rows = whenRows(b, locale, c);
  // A resend after a MercadoPago payment lands here. Someone who has already
  // paid must not be handed a CBU and told to transfer — nothing is owed, and
  // the mail says so instead.
  if (b.payment) rows.push(clientPaymentRow(b.payment, c));
  const pay = b.payment ? [] : transferRows(c, transfer);
  const nextStep = b.payment
    ? c.nextStepPaid
    : pay.length
      ? c.nextStep
      : c.nextStepPay;
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
        htmlPara(nextStep),
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
      nextStep,
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
 *
 * `template` is passed in rather than read off `c` because there are now two of
 * them and the choice belongs to the caller, which is the only place that knows
 * whether the address was printed above.
 */
function outroHtml(c: ClientCopy, template: string): string {
  const filled = template
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

function outroText(c: ClientCopy, template: string): string {
  return template
    .replace("{studio}", `${c.studioLink} (${STUDIO_MAPS_URL})`)
    .replace("{contact}", `${c.contactLink} (${INSTAGRAM_DM_URL})`);
}

/**
 * THE ONE MAIL THAT CARRIES THE STUDIO'S STREET ADDRESS. Why it needs no status
 * check of its own, and why the other three must never grow one, is in the
 * header block.
 *
 * `studio` comes before `token` purely because TypeScript will not take a
 * required parameter after an optional one, and `token` stays optional for the
 * reason it always was: a caller holding just a record can still render this
 * mail, while `sendBookingEmails` always passes one, because a confirmation the
 * client cannot click back into is a worse confirmation.
 */
export function buildClientConfirmed(
  b: BookingRecord,
  studio: StudioSettings,
  token?: string,
): BuiltEmail {
  const locale = clientLocale(b);
  const c = CLIENT_COPY[locale];
  const tz = recordTimeZone(b);
  const date = formatDayLong(b.startsAt, tz, locale);
  const time = clockLine(b.startsAt, tz, locale);
  const name = pick(b.client.name, b.seed.name);
  const greeting = name ? fill(c.greeting, { name }) : "";
  // "Recibimos tu comprobante" is only true of the road that leaves one. A
  // MercadoPago booking is confirmed by its webhook and never uploads anything,
  // so it gets the line about the payment and a row naming the method.
  const lead = fill(b.payment ? c.leadConfirmedPaid : c.leadConfirmed, {
    date,
    time,
  });
  const rows = whenRows(b, locale, c);
  if (b.payment) rows.push(clientPaymentRow(b.payment, c));

  // An unset address is a settings document nobody has finished filling in, not
  // a broken mail: the block simply does not print and the closing line goes
  // back to promising the door by message, which is then exactly what happens.
  const address = studio.address.trim();
  // Gated on the ADDRESS, not on itself. "Timbre dos veces" with no street
  // above it is an instruction for a building the reader cannot find.
  const arrival = address ? studio.arrivalNote.trim() : "";
  const outro = address ? c.outroConfirmedAddress : c.outroConfirmed;
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
        // Its own headed block under the when-rows, so "where" reads as a
        // second answer rather than a fourth line of the appointment table.
        address
          ? htmlEyebrow(c.addressEyebrow) +
            htmlRows([{ label: c.labels.address, value: address }])
          : "",
        // htmlQuote and not another row: this is free text the studio typed,
        // and it is the one block here whose newlines are load-bearing — a
        // table cell would flatten "3º B / timbre dos veces" into one line.
        arrival ? htmlQuote(c.labels.arrival, arrival) : "",
        outroHtml(c, outro),
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
      address ? `${c.addressEyebrow}:\n${address}` : "",
      // Same shape as the owner mail's client note, and for the same reason:
      // padEnd alignment assumes a single-line value, which this is not.
      arrival ? `${c.labels.arrival}:\n${arrival}` : "",
      outroText(c, outro),
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
 * The settings document, or the defaults when the bucket cannot answer.
 *
 * Never throws, like everything else in this file: this runs after the record
 * has already committed, and a booking the client completed must not become an
 * error because a settings read failed. DEFAULT_SETTINGS is all-empty, and
 * empty means "fall back to the env var" — so a bucket outage sends exactly the
 * mail this feature sent before settings existed, from the same addresses,
 * rather than sending nothing.
 */
async function settingsOrDefaults(bookingId: string): Promise<Settings> {
  try {
    return await loadSettings();
  } catch (err) {
    console.error(`[booking-emails] ${bookingId} settings: ${messageOf(err)}`);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Who booking mail comes FROM. `pick` skips blanks, which is the whole
 * fallback rule: a cleared settings field is a way BACK to the env var, never a
 * way to send from an empty address. The chain ends in constants, so this
 * always returns something real — see the note on Sender in email.ts.
 */
function senderFrom(email: EmailSettings): Sender {
  return {
    email: pick(email.senderEmail, process.env.BREVO_SENDER_EMAIL, SITE_EMAIL),
    name: pick(email.senderName, process.env.BREVO_SENDER_NAME, DEFAULT_SENDER_NAME),
  };
}

/**
 * Where booking notifications land. Settings first, then the env var, then the
 * studio's public address — so the feature notifies correctly out of the box,
 * and the settings tab is now the way to point them somewhere else without a
 * redeploy.
 */
function ownerRecipient(email: EmailSettings): Recipient | null {
  const address = pick(email.notifyEmail, process.env.BOOKING_NOTIFY_EMAIL, SITE_EMAIL);
  return address ? { email: address, name: DEFAULT_SENDER_NAME } : null;
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

  // One read for the whole batch, and the only I/O this module does. Loaded
  // after the early return above so a caller asking for no mail never touches
  // the bucket at all.
  const settings = await settingsOrDefaults(b.id);
  const sender = senderFrom(settings.email);
  const owner = ownerRecipient(settings.email);
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
              ? buildClientSubmitted(b, token, settings.transfer)
              : // The one send that carries the address, from the same batch
                // read as everything else. Note that `settings.studio` is NOT
                // reachable from the other three branches: each builder is
                // handed the slice it is allowed to print, so the address
                // cannot end up in an owner mail by an edit made above.
                buildClientConfirmed(b, settings.studio, token);
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
    jobs.map((job) => sendTransactional(job.message, sender)),
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
