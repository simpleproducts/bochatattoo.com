/**
 * MercadoPago Checkout Pro, over plain fetch — two calls and nothing else.
 *
 * NO SDK, deliberately. This integration needs exactly two endpoints: one POST
 * to create a preference and one GET to read a payment back. A client library
 * would add a supply chain and a release cadence the studio has no way to
 * audit, in exchange for typing that this file writes out itself in twenty
 * lines. The same reasoning the project applies everywhere else.
 *
 * THREE RULES HOLD ACROSS BOTH CALLS:
 *
 *   - `external_reference` IS the link between a MercadoPago payment and a
 *     booking, and it is never optional. The webhook has nothing else to
 *     resolve a payment with — no token, no cookie, no session — so a
 *     preference created without it produces money that arrives with no way of
 *     saying what it paid for. Everything else in the preference is
 *     presentation; that one field is the integration.
 *
 *   - NOTHING UPSTREAM IS RETHROWN VERBATIM. Every failure leaves here as a
 *     MercadoPagoError whose message this file wrote, because the caller LOGS
 *     it: the raw body of a 4xx from a payment API is a shape nobody has
 *     reviewed — an HTML error page from a proxy, a stack trace, an echo of the
 *     request — and none of that belongs in a log line, let alone in a
 *     response. Callers branch on `code`; `message` is for the log and for
 *     nowhere else.
 *
 *   - THE ACCESS TOKEN STAYS IN THE ENVIRONMENT (MP_ACCESS_TOKEN) and is never
 *     read from the settings document. See the header of settings-types.ts: the
 *     settings tab decides WHICH methods are offered, the deploy holds the
 *     credential that authenticates the studio to MercadoPago.
 *
 * Read together with src/app/api/mp/webhook/route.ts, which is the only writer
 * of a booking's `payment` and the reason `getPayment` exists at all: the
 * browser coming back from the redirect is a URL the client controls, so the
 * only trustworthy account of a payment is the one this file asks for.
 */
import "server-only";
import { bookingLinks } from "./booking-token";
import { SITE_URL } from "./site";

const API_BASE = "https://api.mercadopago.com";

/**
 * Where every preference tells MercadoPago to send its notifications. It is a
 * literal because Next.js routing is file-based and there is nothing to import
 * from a route module: if src/app/api/mp/webhook/route.ts ever moves, this
 * string moves with it or the studio stops being told about payments.
 */
const WEBHOOK_PATH = "/api/mp/webhook";

/** Same budget as the Brevo transport: a stuck upstream must not hold a route open. */
const TIMEOUT_MS = 8000;

/** How much of an upstream complaint is worth keeping in a log line. */
const UPSTREAM_DETAIL_MAX = 200;

export type MercadoPagoErrorCode =
  /** MP_ACCESS_TOKEN is not set. A deploy problem, never a client's problem. */
  | "not-configured"
  /** We would be sending MercadoPago something it cannot accept. Caught here. */
  | "bad-request"
  /** MercadoPago answered 4xx: it looked at the request and said no. */
  | "rejected"
  /** 5xx or 429 — MercadoPago itself is having a moment. */
  | "unavailable"
  | "timeout"
  | "network"
  /** 2xx, but not the shape this file was promised. */
  | "bad-response";

/**
 * The one error type this module throws. `code` is the contract — the routes
 * map it to a kebab-case code for the client — and `message` is a sentence
 * written here, safe to put in a server log.
 */
export class MercadoPagoError extends Error {
  readonly code: MercadoPagoErrorCode;
  /** Upstream HTTP status where there was one. Absent for timeouts and sockets. */
  readonly status?: number;

  constructor(code: MercadoPagoErrorCode, message: string, status?: number) {
    super(message);
    this.name = "MercadoPagoError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Is MercadoPago usable on this deploy at all?
 *
 * Separate from the `mercadopago.enabled` flag in settings, and both are
 * checked: the settings flag is the studio saying "offer this method", this is
 * the deploy saying "the credential exists". Offering a method whose token is
 * missing sends a client to a checkout that cannot be created.
 */
export function mercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MercadoPagoError(
      "not-configured",
      "MP_ACCESS_TOKEN is not set on the server.",
    );
  }
  return token;
}

/** Errors reach a catch block as `unknown`; DOMException is an Error here (Node). */
function describe(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "", message: String(err) };
}

/**
 * A failure line for the log, built from the two fields MercadoPago documents
 * on its error bodies and from NOTHING else. One-lined and capped, so a
 * multi-kilobyte HTML page from something in front of the API cannot become a
 * log entry — the second rule in the header, enforced in one function.
 */
function upstreamSummary(status: number, body: unknown): string {
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message = typeof data.message === "string" ? data.message : "";
  const error = typeof data.error === "string" ? data.error : "";
  const detail = (message || error)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, UPSTREAM_DETAIL_MAX);
  return detail
    ? `MercadoPago responded ${status}: ${detail}`
    : `MercadoPago responded ${status}.`;
}

/**
 * Which side of the call went wrong.
 *
 * A 4xx means MercadoPago read the request and refused it — a currency this
 * account cannot charge, a token without permission, a malformed preference —
 * and retrying it changes nothing, so the client is told to try another method.
 * A 5xx or a 429 is MercadoPago having a moment, which is worth saying
 * differently even though today both collapse to the same sentence on screen.
 */
function upstreamError(status: number, body: unknown): MercadoPagoError {
  const code: MercadoPagoErrorCode =
    status >= 500 || status === 429 ? "unavailable" : "rejected";
  return new MercadoPagoError(code, upstreamSummary(status, body), status);
}

/**
 * The init point is handed to a browser as a navigation target, so its scheme
 * is checked rather than trusted. This is the single place in the feature where
 * a string from an upstream API becomes a redirect, and https is the only
 * protocol that may ever do that.
 */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

type MpResponse = { status: number; data: unknown };

/**
 * One request, with the timeout and the error wrapping both calls share.
 *
 * Returns the status rather than throwing on it: a 404 from the payments
 * endpoint is an ANSWER the webhook acts on, not a failure, and only the caller
 * knows which statuses are answers.
 */
async function mpFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<MpResponse> {
  const token = accessToken();
  const hasBody = init.body !== undefined;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(hasBody ? { "content-type": "application/json" } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
      // Payment state lives upstream and changes without us; a cached answer
      // here would be a lie told at the exact moment it matters most.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout() rejects with a TimeoutError; some runtimes report
    // the same condition as AbortError. Everything else is DNS/TLS/socket.
    const { name, message } = describe(err);
    const timedOut = name === "TimeoutError" || name === "AbortError";
    throw new MercadoPagoError(
      timedOut ? "timeout" : "network",
      timedOut
        ? `No response from MercadoPago in ${TIMEOUT_MS} ms.`
        : `Could not reach MercadoPago: ${message}`,
    );
  }

  // Never `res.json()` bare: an error page from a proxy is not JSON, and a
  // parse failure here would surface as a raw SyntaxError instead of the
  // status the caller actually needs to read.
  const data: unknown = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Create the Checkout Pro preference for one booking's deposit and hand back
 * the hosted page to send the client to.
 *
 * NOTHING IS STORED as a result of this call, by design. A preference the
 * client never pays is not a fact about the booking, and writing one down would
 * invent a "pending" state the record deliberately does not have — see
 * BookingPayment in bookings-types.ts. Tapping the button twice therefore
 * creates two preferences and costs nothing: an unpaid one simply expires.
 *
 * There is no idempotency key for the same reason. Reusing one would mean a
 * client who taps again after the studio changed the deposit gets sent to a
 * checkout for the OLD amount — a stale price is a worse failure than an extra
 * unused preference.
 */
export async function createPreference(args: {
  bookingId: string;
  title: string;
  amount: number;
  currency: string;
  payerEmail?: string;
  locale: "es" | "en";
  token: string;
}): Promise<{ id: string; initPoint: string }> {
  // The route refuses a booking with no deposit before it ever gets here. This
  // is the backstop that keeps a future caller from sending MercadoPago a NaN
  // and reading back an opaque 400 it would have to guess the meaning of.
  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    throw new MercadoPagoError(
      "bad-request",
      `Refusing to charge ${args.amount} for ${args.bookingId}.`,
    );
  }

  // Every outcome comes back to the client's own booking page, in the language
  // they were reading. One URL for all three: the page re-reads the booking
  // from the server on mount, so what it shows is the record — never the query
  // string MercadoPago appended, which the client can edit before it lands.
  const backUrl = bookingLinks(args.token)[args.locale];

  const { status, data } = await mpFetch("/checkout/preferences", {
    method: "POST",
    body: {
      items: [
        {
          id: args.bookingId,
          title: args.title,
          quantity: 1,
          unit_price: args.amount,
          currency_id: args.currency,
        },
      ],
      // THE link between money and booking. See the header — not optional.
      external_reference: args.bookingId,
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      // Send an approved payer straight back instead of parking them on
      // MercadoPago's own "done" screen, which reads as having lost the flow.
      auto_return: "approved",
      // Per-preference, so this works before anyone opens the MercadoPago
      // dashboard. The dashboard registration in .env.example is the wider net:
      // it also covers notifications this preference did not ask for.
      notification_url: `${SITE_URL}${WEBHOOK_PATH}`,
      // Pre-fills the payer's email on the checkout. Omitted entirely when we
      // have none — an empty string is a validation error upstream.
      ...(args.payerEmail ? { payer: { email: args.payerEmail } } : {}),
    },
  });

  if (status < 200 || status >= 300) throw upstreamError(status, data);

  const parsed =
    data && typeof data === "object"
      ? (data as { id?: unknown; init_point?: unknown; sandbox_init_point?: unknown })
      : {};

  // MercadoPago has sent both string and numeric ids over the years.
  const id =
    typeof parsed.id === "string"
      ? parsed.id
      : typeof parsed.id === "number"
        ? String(parsed.id)
        : "";

  // `init_point` is what a live access token returns; `sandbox_init_point` is
  // what a TEST token is exercised through. Reading both is what lets the
  // studio rehearse the whole flow on test credentials without this file
  // needing to know which mode the deploy is in.
  const initPoint =
    (typeof parsed.init_point === "string" && parsed.init_point) ||
    (typeof parsed.sandbox_init_point === "string" && parsed.sandbox_init_point) ||
    "";

  if (!id || !isHttpsUrl(initPoint)) {
    throw new MercadoPagoError(
      "bad-response",
      `MercadoPago accepted the preference for ${args.bookingId} but returned no usable checkout URL.`,
    );
  }

  return { id, initPoint };
}

/**
 * Read one payment back from MercadoPago.
 *
 * This is the function that makes the webhook trustworthy: the notification
 * body carries a status field and that field is never read anywhere, because
 * anyone can POST a body. Only what this call returns is believed.
 *
 * `null` means MercadoPago does not know that payment id — an answer, not a
 * failure, and the webhook acknowledges it rather than retrying into a payment
 * that has never existed.
 */
export async function getPayment(paymentId: string): Promise<{
  status: string;
  externalReference?: string;
  amount?: number;
  currency?: string;
} | null> {
  // Encoded even though every caller validates first: this value comes off a
  // public request and it is being pasted into a URL path.
  const { status, data } = await mpFetch(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    { method: "GET" },
  );

  if (status === 404) return null;
  if (status < 200 || status >= 300) throw upstreamError(status, data);

  const parsed =
    data && typeof data === "object"
      ? (data as {
          status?: unknown;
          external_reference?: unknown;
          transaction_amount?: unknown;
          currency_id?: unknown;
        })
      : {};

  const paymentStatus = typeof parsed.status === "string" ? parsed.status : "";
  // A 200 with no status is not a payment we can decide anything about, and
  // silently reading it as "not approved" would hide a broken integration
  // behind a booking that simply never goes green.
  if (!paymentStatus) {
    throw new MercadoPagoError(
      "bad-response",
      `MercadoPago returned a payment with no status for ${paymentId}.`,
    );
  }

  // Every field but `status` is optional in the returned shape, so each one is
  // omitted rather than defaulted: `amount: 0` on the record would read as a
  // payment of nothing, which is a claim this function cannot make.
  return {
    status: paymentStatus,
    ...(typeof parsed.external_reference === "string"
      ? { externalReference: parsed.external_reference }
      : {}),
    ...(typeof parsed.transaction_amount === "number"
      ? { amount: parsed.transaction_amount }
      : {}),
    ...(typeof parsed.currency_id === "string"
      ? { currency: parsed.currency_id }
      : {}),
  };
}
