/**
 * Booking domain types + pure validators.
 *
 * No `server-only` import: this file is imported by API routes AND by client
 * components, so it must stay free of the S3 SDK and of any Node built-in.
 * Status is NEVER a field on a record — see src/lib/booking-status.ts.
 */
import type { Locale } from "@/i18n/config";

export const BOOKING_SCHEMA_VERSION = 1 as const;

/** "bk_" + 22 base64url chars from 16 CSPRNG bytes. An identifier, not a credential. */
export type BookingId = string;

/** Derived, never stored. Red / Yellow / Green / neutral. */
export type BookingStatus = "pending" | "awaiting_receipt" | "confirmed" | "cancelled";

export type Currency = "ARS" | "USD" | "EUR";

export type BookingContact = {
  /** Trimmed, <= NAME_MAX chars. */
  name?: string;
  /** Trimmed + lowercased, matches EMAIL_RE, <= 254 chars. */
  email?: string;
  /** Normalised by normalizeInstagram(): no "@", no URL, lowercase, matches IG_RE. */
  instagram?: string;
  /** Trimmed, matches PHONE_RE. Never parsed as E.164. */
  phone?: string;
};

/** What the admin pre-filled at creation. Invariant: email || instagram. */
export type BookingSeed = BookingContact;

/** What the client submitted. Kept separate so a client can never overwrite the seed. */
export type BookingClient = BookingContact & {
  /** Optional free text from the client, <= NOTE_MAX chars. */
  note?: string;
  /** Locale of the page they actually used. Drives their confirmation email. */
  locale?: Locale;
  submittedAt?: string;      // UTC ISO
  termsAcceptedAt?: string;  // UTC ISO — set once, never overwritten
  termsVersion?: string;     // TERMS_VERSION at the moment of acceptance
};

export type ReceiptContentType =
  | "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export type ReceiptExt = "pdf" | "jpg" | "png" | "webp";

export type BookingReceipt = {
  /** Private-bucket object key. Server-derived. NEVER sent to any browser. */
  key: string;
  /** Sanitised original filename, display only. */
  filename: string;
  /** SNIFFED from magic bytes. Never the client's declared type. */
  contentType: ReceiptContentType;
  ext: ReceiptExt;
  bytes: number;
  /** hex sha256 of the stored bytes — content addressing + idempotent retries. */
  sha256: string;
  uploadedAt: string; // UTC ISO
};

export type BookingEmailKind =
  | "clientSubmitted" | "ownerSubmitted" | "ownerConfirmed" | "clientConfirmed";

export type BookingEmailLog = {
  clientSubmitted?: string;   // UTC ISO of a successful send
  ownerSubmitted?: string;
  ownerConfirmed?: string;
  clientConfirmed?: string;
  lastError?: { at: string; kind: BookingEmailKind; message: string };
};

/** The source of truth. One object per booking in the PRIVATE bucket. */
export type BookingRecord = {
  version: 1;
  id: BookingId;
  createdAt: string;   // UTC ISO, immutable
  updatedAt: string;   // UTC ISO
  /** Always UTC. Rendered with Intl in the viewer's zone. endsAt > startsAt. */
  startsAt: string;
  endsAt: string;
  seed: BookingSeed;
  client: BookingClient;
  deposit?: { amount: number; currency: Currency };
  /** Admin-only. Never in PublicBookingView, never in a client email. */
  adminNotes?: string;
  receipt?: BookingReceipt;
  /** Soft-cancel, reversible. Kills the link and greys the calendar row. */
  cancelledAt?: string;
  /** Bumped by POST .../link. Every previously issued token dies. */
  tokenEpoch: number;
  /** Durable abuse counters — the only limit that survives a cold start. */
  counters: { submitAttempts: number; uploadAttempts: number };
  emails: BookingEmailLog;
};

/** Derived index. IDs ONLY — no PII, no status, no label. Admin routes are its only writer. */
export type BookingMonthIndex = {
  version: 1;
  month: string;      // "YYYY-MM", UTC month of startsAt
  ids: BookingId[];
  updatedAt: string;  // UTC ISO
};

/** Admin wire shape. Full record minus the receipt key, plus derived status + a live link. */
export type AdminAppointment = Omit<BookingRecord, "receipt"> & {
  status: BookingStatus;
  receipt?: Omit<BookingReceipt, "key">;
  /** Re-derived server-side on every read — the link is never "shown once". */
  token: string;
  links: { es: string; en: string };
};

/**
 * The ONLY shape ever sent to the client booking page.
 * Absent by construction: receipt.key, adminNotes, counters, emails, tokenEpoch.
 */
export type PublicBookingView = {
  id: BookingId;
  startsAt: string;
  endsAt: string;
  /** "cancelled" never reaches this page — the token resolver rejects first. */
  status: "pending" | "awaiting_receipt" | "confirmed";
  seed: BookingSeed;
  client: Pick<BookingClient, "name" | "email" | "instagram" | "phone" | "note">;
  deposit?: { amount: number; currency: Currency };
  termsAccepted: boolean;
  termsVersion?: string;
  receipt: { filename: string; bytes: number; uploadedAt: string } | null;
  /** IANA zone, so the page can render a stable "studio time" second line. */
  studioTimeZone: string;
};

/** Why a token was refused. The API collapses all of these to one vague code. */
export type BookingAccessReason =
  | "bad-token" | "not-found" | "link-revoked" | "link-expired" | "booking-cancelled";

export type BookingAccess =
  | { ok: true; record: BookingRecord }
  | { ok: false; reason: BookingAccessReason };

/* ─────────────────────────── validation ─────────────────────────── */

export const BOOKING_ID_RE = /^bk_[A-Za-z0-9_-]{22}$/;
/** <payload>.<22-char sig>. Shape gate BEFORE any HMAC or key construction. */
export const BOOKING_TOKEN_RE = /^[A-Za-z0-9_-]{8,200}\.[A-Za-z0-9_-]{22}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Same regex as src/app/api/subscribe/route.ts. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const IG_RE = /^[a-z0-9._]{1,30}$/;
export const PHONE_RE = /^[+0-9][0-9 ()\-.]{5,23}$/;

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const NOTE_MAX = 500;
export const ADMIN_NOTES_MAX = 2000;
export const FILENAME_MAX = 120;

export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;           // Vercel body limit is ~4.5 MB
export const RECEIPT_CLIENT_MAX_BYTES = 12 * 1024 * 1024;   // pre-downscale ceiling in the browser
export const RECEIPT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
export const IMAGE_DOWNSCALE_MAX_EDGE = 1600;
export const IMAGE_DOWNSCALE_QUALITY = 0.82;

export const MAX_SUBMIT_ATTEMPTS = 20;
export const MAX_UPLOAD_ATTEMPTS = 8;

export const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
/** A link keeps working until this long after the appointment ENDS. */
export const LINK_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** Honeypot field name. Deliberately meaningless so no autofill heuristic targets it. */
export const HONEYPOT_FIELD = "bt_ref";

export const CURRENCIES: Currency[] = ["ARS", "USD", "EUR"];

export function normalizeInstagram(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The one business rule shared by admin create and client submit. */
export function hasContact(c: BookingContact): boolean {
  return Boolean(c.email?.trim() || c.instagram?.trim());
}

/** Best display name, in order of usefulness. "—" when we have nothing. */
export function bookingLabel(b: { seed: BookingSeed; client: BookingClient }): string {
  const c = b.client, s = b.seed;
  const ig = c.instagram || s.instagram;
  return (
    c.name || s.name ||
    (ig ? `@${ig}` : "") ||
    c.email || s.email ||
    "—"
  );
}

/** Strip anything that is not display-safe. Filenames are shown, never used as keys. */
export function sanitizeFilename(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._ -]/g, "").slice(0, FILENAME_MAX) || "receipt";
}
