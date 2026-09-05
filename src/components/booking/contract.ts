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

/**
 * Where the reader is in the flow. `terms` is a modal over `details` rather
 * than a screen of its own, but it is a distinct step to the progress rail.
 */
export type BookingStep = "details" | "terms" | "receipt" | "done";

/** sessionStorage key for the in-progress form, so a reload does not lose it. */
export function draftKey(bookingId: string): string {
  return `ba_book_${bookingId}`;
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

export type PaymentDetailsProps = {
  view: PublicBookingView;
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
