/**
 * Transactional email through Brevo's SMTP API.
 *
 * Reuses BREVO_API_KEY from the newsletter route (src/app/api/subscribe/route.ts),
 * including Brevo's non-standard `api-key` request header — this API has no
 * Authorization scheme, so the key travels in a header of its own name.
 *
 * Nothing in this module throws. Booking mail is always sent AFTER the record
 * is committed to R2, and a mail failure must never turn a booking the client
 * already completed into an error they see: every failure path — unset env,
 * timeout, socket, 4xx, 5xx — comes back as { ok: false, code, message } for
 * the caller to record in `emails.lastError` and for the admin sheet to offer a
 * Resend on. That is also why the email env vars are the "silently skip" tier:
 * with them unset the calendar is still the source of truth, it just sends
 * nothing, and no caller has to branch on configuration.
 *
 * The From address defaults to SITE_EMAIL and needs no env var. Whatever it
 * resolves to MUST be a sender verified at https://app.brevo.com/senders, or
 * every send comes back 400 — that failure is invisible from here, so it lives
 * in the deploy checklist.
 */
import "server-only";
import { SITE_EMAIL } from "./site";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** A stuck upstream must not hold a booking route open; give up and log it. */
const TIMEOUT_MS = 8000;

const DEFAULT_SENDER_NAME = "Bocha Tattoo";

export type Recipient = { email: string; name?: string };

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; code: string; message: string };

export type TransactionalMessage = {
  to: Recipient[];
  subject: string;
  htmlContent: string;
  /** Never optional: a booking email without a plain-text twin lands in spam. */
  textContent: string;
  replyTo?: Recipient;
  tags?: string[];
};

/** Errors reach a catch block as `unknown`; DOMException is an Error here (Node). */
function describe(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "", message: String(err) };
}

export async function sendTransactional(
  msg: TransactionalMessage,
): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  // Defaults to the studio's public address, so the only thing this module
  // actually needs configured is the Brevo key the newsletter already uses.
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || SITE_EMAIL;
  if (!apiKey) {
    return {
      ok: false,
      code: "not-configured",
      message: "BREVO_API_KEY is required to send mail.",
    };
  }

  // Cheaper to name here than to read back as Brevo's opaque `missing_parameter`.
  if (msg.to.length === 0) {
    return { ok: false, code: "no-recipient", message: "No recipient address." };
  }

  const body = {
    sender: {
      email: senderEmail,
      name: process.env.BREVO_SENDER_NAME ?? DEFAULT_SENDER_NAME,
    },
    to: msg.to,
    subject: msg.subject,
    htmlContent: msg.htmlContent,
    textContent: msg.textContent,
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    ...(msg.tags?.length ? { tags: msg.tags } : {}),
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout() rejects with a TimeoutError; some runtimes report
    // the same condition as AbortError. Everything else is DNS/TLS/socket.
    const { name, message } = describe(err);
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return {
      ok: false,
      code: timedOut ? "timeout" : "network-error",
      message: timedOut ? `No response in ${TIMEOUT_MS} ms.` : message,
    };
  }

  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { messageId?: unknown };
    return typeof data.messageId === "string"
      ? { ok: true, messageId: data.messageId }
      : { ok: true };
  }

  // Brevo answers a 4xx with { code, message }. A 5xx, or an HTML error page
  // from something in between, parses as nothing — hence the status fallback.
  const data = (await res.json().catch(() => ({}))) as {
    code?: unknown;
    message?: unknown;
  };
  const code = typeof data.code === "string" && data.code ? data.code : "";
  const message = typeof data.message === "string" && data.message ? data.message : "";
  return {
    ok: false,
    code: code || `http-${res.status}`,
    message: message || `Brevo responded ${res.status}.`,
  };
}

/**
 * Every value interpolated into a booking email — name, note, Instagram handle,
 * receipt filename — is client input that arrived over a public link, so it is
 * escaped on the way into the HTML twin without exception. Quotes included:
 * some of these values land in attributes.
 */
export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
