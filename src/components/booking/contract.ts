/**
 * The frozen contract for the client booking flow (/book/<token>).
 *
 * Same purpose as the calendar's contract file: one place that owns every prop
 * shape passed between the flow's components, so the pieces can be written and
 * revised independently without drifting apart.
 *
 * Also holds the API error-code -> dictionary mapping. Every route in the
 * feature answers with a kebab-case code and nothing else; this is where a code
 * becomes a sentence in the reader's language, and the reason a new code added
 * server-side degrades to `errors.generic` instead of showing a raw string.
 *
 * Pure and client-safe: no `server-only`, no S3 SDK, no Node built-ins.
 */
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n/config";
import type {
  BookingAccessReason,
  PublicBookingView,
} from "@/lib/bookings-types";
import type {
  PaymentMethod,
  PublicPaymentSettings,
} from "@/lib/settings-types";

/**
 * Where the reader is in the flow. `terms` is a modal over `details` rather
 * than a screen of its own, but it is a distinct step to the progress rail.
 *
 * The third step is still called `receipt` even though it now opens with a
 * payment choice, and that is deliberate: the rail types its own three keys off
 * this union, so a fourth value here would be a fourth item on a rail that has
 * exactly three. What the step CONTAINS is decided by the settings, not by a
 * step name.
 */
export type BookingStep = "details" | "terms" | "receipt" | "done";

/** sessionStorage key for the in-progress form, so a reload does not lose it. */
export function draftKey(bookingId: string): string {
  return `ba_book_${bookingId}`;
}

/**
 * sessionStorage key for "this tab sent its reader off to MercadoPago".
 *
 * Derived from draftKey so both keys share one per-booking prefix and one
 * cleanup story. It survives the round trip because sessionStorage is per tab
 * and per origin: leaving for mercadopago.com and coming back to ours restores
 * it, which is exactly the window this flag has to cover.
 *
 * IT IS PROOF OF NOTHING. A value in a browser store the reader can edit
 * decides one thing only — whether the payment step opens with "we are waiting
 * for MercadoPago" instead of the plain chooser. `view.paid`, written by the
 * webhook and by nothing else, is what says a deposit arrived.
 */
export function paymentAttemptKey(bookingId: string): string {
  return `${draftKey(bookingId)}_mp`;
}

/**
 * The query parameters Checkout Pro hangs off its back_url.
 *
 * Read for the same one purpose as the flag above and with the same standing:
 * they are in a URL the client controls, so they can say "this reader has just
 * come back from a payment attempt" — worth a different sentence on screen —
 * and they can never say "this booking is paid". Only the webhook says that.
 *
 * The list is generous on purpose. MercadoPago has changed which of these it
 * appends before, and a missed parameter costs the reader the honest waiting
 * copy, while an extra one costs nothing at all.
 */
const MP_RETURN_PARAMS = [
  "collection_id",
  "collection_status",
  "payment_id",
  "preference_id",
  "merchant_order_id",
  "status",
] as const;

/** Did this request land on the page carrying MercadoPago's return parameters? */
export function hasPaymentReturnParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  return MP_RETURN_PARAMS.some((name) => params[name] !== undefined);
}

/**
 * The methods the studio is offering right now, MercadoPago first because it
 * finishes the booking in one tap and a transfer does not.
 *
 * Order is part of the contract rather than a rendering detail: the chooser
 * paints the array in order, and its LENGTH is what decides whether there is a
 * choice to present at all. One method is not a choice — the flow renders it
 * directly, with no chooser over it — and zero is what an unwritten settings
 * document, or a settings read that failed, leaves behind. That last case is a
 * state to explain, never one to hide behind an empty step.
 */
export function offeredMethods(s: PublicPaymentSettings): PaymentMethod[] {
  const found: PaymentMethod[] = [];
  if (s.mercadopago.enabled) found.push("mercadopago");
  if (s.transfer.enabled) found.push("transfer");
  return found;
}

/** The details form's own state. All strings — these are raw input values. */
export type DetailsValues = {
  name: string;
  email: string;
  instagram: string;
  phone: string;
  note: string;
};

/** Per-field messages, already resolved to the reader's language. */
export type DetailsErrors = Partial<Record<keyof DetailsValues, string>>;

export type UploadPhase = "idle" | "uploading" | "verifying" | "done" | "error";

/* ─────────────────────────── component props ─────────────────────────── */

export type BookingFlowProps = {
  view: PublicBookingView;
  token: string;
  locale: Locale;
  dict: Dictionary;
  /**
   * The page saw MercadoPago's return parameters on this request. A hint about
   * which copy to open the payment step with, never a claim about the money —
   * see MP_RETURN_PARAMS above.
   */
  returnedFromPayment: boolean;
};

export type BookingHeaderProps = {
  token: string;
  locale: Locale;
  dict: Dictionary;
};

export type AppointmentCardProps = {
  view: PublicBookingView;
  locale: Locale;
  dict: Dictionary;
};

export type ProgressRailProps = {
  step: BookingStep;
  dict: Dictionary;
};

export type DetailsFormProps = {
  values: DetailsValues;
  errors: DetailsErrors;
  /** Seed fields the studio pre-filled: rendered read-only, never rewritable. */
  seed: PublicBookingView["seed"];
  busy: boolean;
  dict: Dictionary;
  onChange: (next: DetailsValues) => void;
  onBlurField: (field: keyof DetailsValues) => void;
  /** Opens the terms modal. It does NOT submit — consent comes first. */
  onContinue: () => void;
};

export type TermsModalProps = {
  open: boolean;
  locale: Locale;
  dict: Dictionary;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** Posts details + acceptance in one request. */
  onAccept: () => void;
};

/**
 * The bank-transfer block. It reads its alias, CBU, holder and bank off
 * `view.paymentSettings.transfer` — the studio's settings document, narrowed
 * for the wire — so there is nothing else to pass it.
 */
export type PaymentDetailsProps = {
  view: PublicBookingView;
  dict: Dictionary;
};

/** Rendered only when `offeredMethods` returned more than one. */
export type PaymentMethodChooserProps = {
  dict: Dictionary;
  /** In the order they are to be painted — see offeredMethods. */
  methods: PaymentMethod[];
  onChoose: (method: PaymentMethod) => void;
};

export type MercadoPagoPanelProps = {
  dict: Dictionary;
  /**
   * True from the tap until the browser has actually left for MercadoPago. The
   * button is disabled for that whole stretch because a second tap creates a
   * second preference for the same deposit.
   */
  busy: boolean;
  error: string | null;
  onPay: () => void;
};

export type MercadoPagoPendingProps = {
  dict: Dictionary;
  /** A re-check is in flight. */
  busy: boolean;
  error: string | null;
  onRecheck: () => void;
};

/** No method is on offer. One sentence, so the step is never blank. */
export type PaymentUnavailableProps = {
  dict: Dictionary;
};

export type ReceiptUploaderProps = {
  locale: Locale;
  dict: Dictionary;
  phase: UploadPhase;
  /** 0-100, only meaningful while `phase === "uploading"`. */
  progress: number;
  error: string | null;
  existing: PublicBookingView["receipt"];
  onUpload: (file: File) => void;
  onReset: () => void;
};

export type ConfirmedPanelProps = {
  view: PublicBookingView;
  locale: Locale;
  dict: Dictionary;
};

export type BookingInvalidProps = {
  reason: BookingAccessReason;
  dict: Dictionary;
};

/* ─────────────────────────── error mapping ─────────────────────────── */

/**
 * Every kebab-case code the booking API can answer with, mapped to its key in
 * `dict.booking.errors`. Anything not listed — a new code, a proxy's own error
 * page, a truncated body — falls through to `generic` rather than surfacing an
 * internal string to a client who cannot act on it.
 */
const ERROR_KEYS: Record<string, keyof Dictionary["booking"]["errors"]> = {
  "invalid-link": "invalidLink",
  "link-expired": "linkExpired",
  "booking-locked": "bookingLocked",
  "terms-required": "termsRequired",
  "missing-contact": "missingContact",
  "too-large": "tooLarge",
  "unsupported-type": "unsupportedType",
  "too-many-attempts": "tooManyAttempts",
  "rate-limited": "rateLimited",
  // The preference could not be created, and MercadoPago declining a payment
  // it did create. Both mean nothing was charged, which is why neither maps to
  // `generic`: "try again in a moment" and "try another method" are different
  // instructions, and a client staring at a checkout that went nowhere needs
  // the right one.
  "payment-failed": "paymentFailed",
  "payment-rejected": "paymentRejected",
  conflict: "conflict",
};

export function errorMessage(code: string | null, dict: Dictionary): string {
  if (!code) return dict.booking.errors.generic;
  const key = ERROR_KEYS[code];
  return key ? dict.booking.errors[key] : dict.booking.errors.generic;
}

/** Network failure is distinct from a server refusal — the reader can retry. */
export function networkMessage(dict: Dictionary): string {
  return dict.booking.errors.network;
}

/**
 * Read a booking API error body. Mirrors `readError` on the admin side, but
 * resolves to a translated sentence rather than to the server's own text:
 * nothing the booking routes emit is meant to be read by a client.
 */
export async function readBookingError(
  res: Response,
  dict: Dictionary,
): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return errorMessage(data.error ?? null, dict);
  } catch {
    return dict.booking.errors.generic;
  }
}
