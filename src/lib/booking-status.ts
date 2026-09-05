/**
 * The single definition of a booking's red / yellow / green, plus the one
 * table that maps it to pixels and words.
 *
 * Status is DERIVED, never stored: it is three booleans over facts the record
 * already holds, so it cannot desync from them the way a cached field would.
 * Nothing anywhere else in the codebase may assign a status literal — every
 * surface (calendar chip, sheet header, agenda row, progress rail, emails)
 * calls `deriveStatus` and reads `STATUS_META`.
 *
 * Colour is never the only channel. Each status carries four redundant ones —
 * hue (`dot`/`text`), glyph, border style, and a label — because a colour-blind
 * reader and a greyscale print must both still read the status. `○ ◐ ●` differ
 * in fill, `border-dashed` / solid / `border-dotted` differ in stroke, and the
 * label is real text. Drop any one of them and the other three still carry it.
 *
 * The label is the one channel that is NOT in this file. It used to be, as an
 * English `adminLabel`, back when the admin was English-only; the four words
 * now live at `dict.calendar.status.*` in src/i18n/admin.ts and each render
 * site reads `dict.calendar.status[meta.dictKey]`. Nothing else moved: a colour
 * and a glyph are the same in both languages, so the rest of the table below is
 * still the single mapping it always was.
 *
 * No `server-only`: client components import this.
 */
import type { BookingRecord, BookingStatus } from "./bookings-types";

/** THE definition of red/yellow/green. Nothing anywhere assigns a status literal. */
export function deriveStatus(
  b: Pick<BookingRecord, "cancelledAt" | "client" | "receipt">,
): BookingStatus {
  if (b.cancelledAt) return "cancelled";
  const contact = Boolean(b.client.email?.trim() || b.client.instagram?.trim());
  const detailsDone = Boolean(
    b.client.submittedAt && b.client.termsAcceptedAt && b.client.name?.trim() && contact,
  );
  if (!detailsDone) return "pending";
  return b.receipt ? "confirmed" : "awaiting_receipt";
}

export type StatusMeta = {
  glyph: "○" | "◐" | "●" | "⌀";
  dot: string; // e.g. "bg-status-pending"
  text: string; // e.g. "text-status-pending"
  border: string; // e.g. "border-l-2 border-dashed border-status-pending"
  /**
   * Key into `dict.booking.status` on the client side and into
   * `dict.calendar.status` in the admin dictionary — the two are deliberately
   * keyed alike, so one field answers for both. "cancelled" has no client-side
   * string on purpose: the token resolver rejects a cancelled booking before
   * its page ever renders, so only the admin surfaces ever ask for that one.
   */
  dictKey: "pending" | "awaitingReceipt" | "confirmed" | "cancelled";
};

export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  pending: {
    glyph: "○",
    dot: "bg-status-pending",
    text: "text-status-pending",
    border: "border-l-2 border-dashed border-status-pending",
    dictKey: "pending",
  },
  awaiting_receipt: {
    glyph: "◐",
    dot: "bg-status-partial",
    text: "text-status-partial",
    border: "border-l-2 border-status-partial",
    dictKey: "awaitingReceipt",
  },
  confirmed: {
    glyph: "●",
    dot: "bg-status-done",
    text: "text-status-done",
    border: "border-l-2 border-status-done",
    dictKey: "confirmed",
  },
  // Neutral, not red: a cancelled booking is a resolved state, and red-400 is
  // reserved for destructive actions.
  cancelled: {
    glyph: "⌀",
    dot: "bg-muted",
    text: "text-muted",
    border: "border-l-2 border-dotted border-line",
    dictKey: "cancelled",
  },
};
