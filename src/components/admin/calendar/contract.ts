/**
 * The frozen contract for the admin calendar component tree.
 *
 * Every prop shape the calendar's components pass between each other lives
 * here, in one file that none of them owns, so that the tree can be built and
 * changed in pieces without two components quietly disagreeing about a prop.
 *
 * It also holds the form <-> API converters. `BookingForm` speaks in the wall
 * clock the admin typed ("2026-09-12", "18:00") and the API speaks in UTC
 * instants; putting both halves of that translation in one place is what keeps
 * a date from being converted twice, or not at all, on one of the paths.
 *
 * Pure and client-safe: no `server-only`, no S3 SDK, no Node built-ins.
 */
import type {
  AdminAppointment,
  BookingEmailKind,
  BookingId,
  BookingSeed,
  BookingStatus,
  Currency,
} from "@/lib/bookings-types";
import { fromUtcIso, toUtcIso } from "@/lib/booking-time";

/** Month on desktop, agenda on mobile. Two views, deliberately — see the plan. */
export type CalendarView = "month" | "agenda";

/** Persisted so a returning admin gets the view they last chose, not the default. */
export const VIEW_STORAGE_KEY = "ba_cal_view";

/**
 * What the sheet is showing. `create` carries the day the admin tapped so the
 * composer opens on the right date; `view`/`edit` carry an id and read the
 * appointment out of the calendar's map, so a refresh updates the open sheet.
 */
export type SheetState =
  | { mode: "closed" }
  | { mode: "create"; dayKey: string }
  | { mode: "view"; id: BookingId }
  | { mode: "edit"; id: BookingId };

/**
 * Duration chips, in minutes — the real session lengths this studio books.
 * `null` is the "custom" chip, which reveals an end time and a "next day" box
 * for anything that does not land on one of these.
 */
export const DURATION_CHIPS: (number | null)[] = [60, 120, 240, 360, 480, null];

/**
 * The form's own state, in the admin's wall clock. Deliberately all-strings:
 * these are the raw values of native inputs, and a half-typed "3" in the
 * deposit field must not become NaN before the admin has finished typing.
 */
export type BookingFormValues = {
  /** "YYYY-MM-DD" in the effective timezone. */
  date: string;
  /** "HH:MM" in the effective timezone. */
  startTime: string;
  endTime: string;
  /** Lets a session cross midnight without a second date input. */
  endsNextDay: boolean;
  name: string;
  email: string;
  instagram: string;
  phone: string;
  /** Raw input. "" means no deposit. */
  depositAmount: string;
  depositCurrency: Currency;
  adminNotes: string;
};

/* ─────────────────────────── component props ─────────────────────────── */

export type StatusBadgeProps = {
  status: BookingStatus;
  /** `sm` is the chip/row variant, `md` the sheet header. */
  size?: "sm" | "md";
  className?: string;
};

export type AppointmentChipProps = {
  appt: AdminAppointment;
  tz: string;
  onOpen: (id: BookingId) => void;
};

export type CalendarToolbarProps = {
  /** "YYYY-MM" — the month the calendar is currently parked on. */
  monthKey: string;
  view: CalendarView;
  tz: string;
  tzAbbrev: string;
  onView: (v: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: () => void;
};

export type MonthGridProps = {
  monthKey: string;
  /** dayKey ("YYYY-MM-DD" in `tz`) -> that day's appointments, sorted by start. */
  byDay: Record<string, AdminAppointment[]>;
  tz: string;
  todayKey: string;
  onOpenAppt: (id: BookingId) => void;
  onCreate: (dayKey: string) => void;
};

export type AgendaListProps = {
  monthKey: string;
  byDay: Record<string, AdminAppointment[]>;
  tz: string;
  todayKey: string;
  selectedDayKey: string;
  onSelectDay: (dayKey: string) => void;
  onOpenAppt: (id: BookingId) => void;
  onCreate: (dayKey: string) => void;
};

export type BookingFormProps = {
  tz: string;
  initial: BookingFormValues;
  busy: boolean;
  /** Already-humanised message from `readError`, or null. */
  error: string | null;
  submitLabel: string;
  /**
   * Every other appointment in the loaded window — the source of the overlap
   * warning. A warning only: double-booking is sometimes deliberate and the
   * form never blocks on it.
   */
  others: AdminAppointment[];
  onSubmit: (values: BookingFormValues) => void;
  onCancel: () => void;
};

export type ShareLinkRowProps = {
  appt: AdminAppointment;
  busy: boolean;
  onRotate: () => void;
};

export type ReceiptPreviewProps = {
  appt: AdminAppointment;
  busy: boolean;
  onDelete: () => void;
};

export type BookingSheetProps = {
  state: SheetState;
  /** null while `state.mode === "create"`, or if the id is not loaded. */
  appt: AdminAppointment | null;
  tz: string;
  busy: boolean;
  error: string | null;
  /** Every loaded appointment, for the form's overlap warning. */
  all: AdminAppointment[];
  onClose: () => void;
  /** Create when `state.mode === "create"`, otherwise PATCH the open id. */
  onSubmitForm: (values: BookingFormValues) => void;
  onRequestEdit: () => void;
  onCancelToggle: (cancelled: boolean) => void;
  onDelete: () => void;
  onRotateLink: () => void;
  onDeleteReceipt: () => void;
  onResend: (kind: BookingEmailKind) => void;
};

/* ─────────────────────────── form <-> API ─────────────────────────── */

/** A fresh appointment's length, in hours. Matches the 4h duration chip. */
const DEFAULT_DURATION_HOURS = 4;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * A fresh composer for `dayKey`. Defaults to the next round hour from 12:00
 * onwards when the admin taps today, and to a flat 12:00 on any other day —
 * a tattoo session booked for "now-ish" is the common case only for today.
 */
export function emptyFormValues(
  dayKey: string,
  tz: string,
  todayKey?: string,
  now: Date = new Date(),
): BookingFormValues {
  let startHour = 12;
  if (todayKey && dayKey === todayKey) {
    const { time } = fromUtcIso(now.toISOString(), tz);
    const currentHour = Number(time.slice(0, 2));
    startHour = Math.max(12, Math.min(22, currentHour + 1));
  }
  // Four hours is the studio's normal session, so it is what a fresh composer
  // opens on. Wrapping rather than clamping: a 22:00 start has to become
  // 02:00 the next day, and a clamp would silently offer a one-hour slot.
  const endHour = startHour + DEFAULT_DURATION_HOURS;
  return {
    date: dayKey,
    startTime: `${pad2(startHour)}:00`,
    endTime: `${pad2(endHour % 24)}:00`,
    endsNextDay: endHour >= 24,
    name: "",
    email: "",
    instagram: "",
    phone: "",
    depositAmount: "",
    depositCurrency: "ARS",
    adminNotes: "",
  };
}

/** Hydrate the edit form from a stored appointment, back into `tz`'s wall clock. */
export function formValuesFrom(
  appt: AdminAppointment,
  tz: string,
): BookingFormValues {
  const start = fromUtcIso(appt.startsAt, tz);
  const end = fromUtcIso(appt.endsAt, tz);
  return {
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    endsNextDay: end.date !== start.date,
    name: appt.seed.name ?? "",
    email: appt.seed.email ?? "",
    instagram: appt.seed.instagram ?? "",
    phone: appt.seed.phone ?? "",
    depositAmount: appt.deposit ? String(appt.deposit.amount) : "",
    depositCurrency: appt.deposit?.currency ?? "ARS",
    adminNotes: appt.adminNotes ?? "",
  };
}

/**
 * The wall clock the admin typed, resolved to two UTC instants.
 *
 * `endsNextDay` increments the DATE STRING and resolves the end through the
 * same wall-clock conversion as the start. It used to add 24h of *elapsed*
 * time to the end instant instead, which preserved the duration but broke the
 * round trip: `formValuesFrom` reads the stored end back as a wall clock
 * (`endsNextDay: end.date !== start.date`), so form -> API -> form was not a
 * fixed point and every re-save of a midnight-crossing booking in a DST zone
 * walked the end an hour further (Madrid, 2026-03-28 23:00 + 4h: 04:00, then
 * 05:00, then 06:00, until PATCH answered 400 `bad-slot`).
 *
 * The trade is duration fidelity on a spring-forward night — 23:00 + a "4h"
 * chip is then stored as three real hours. That half of the trade is visible
 * while the admin types, because the form prints `durationLabel()` off these
 * same two instants; the drift it replaces was silent, and reached the
 * client's page and confirmation email. Argentina has no DST, so only a guest
 * spot abroad ever sees either.
 *
 * The +1 day is taken at 12:00Z so no offset can push the arithmetic across a
 * date boundary before `toUtcIso` gets its hands on the wall clock.
 */
export function toApiSlot(
  v: BookingFormValues,
  tz: string,
): { startsAt: string; endsAt: string } {
  const endDate = v.endsNextDay
    ? new Date(Date.parse(`${v.date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    : v.date;
  return {
    startsAt: toUtcIso(v.date, v.startTime, tz),
    endsAt: toUtcIso(endDate, v.endTime, tz),
  };
}

/** Trim to undefined: an empty string in a seed field would defeat `hasContact`. */
function orUndefined(s: string): string | undefined {
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

export function toApiSeed(v: BookingFormValues): BookingSeed {
  return {
    name: orUndefined(v.name),
    email: orUndefined(v.email),
    instagram: orUndefined(v.instagram),
    phone: orUndefined(v.phone),
  };
}

/**
 * What the deposit field said. Deliberately discriminated instead of
 * `{...} | null`: on the PATCH path `null` is the contract's explicit ERASE
 * (`[id]/route.ts`), so an amount that failed to parse must not be able to
 * take its shape. The old `Number(raw.replace(/[^0-9.]/g, ""))` could: it read
 * the es-AR "50.000" as 50 and "1.200.000" as NaN, i.e. as the erase.
 */
export type DepositParse =
  | { ok: true; value: { amount: number; currency: Currency } | null }
  | { ok: false };

/** es-AR grouped: "50.000", "1.200.000,50" — dots group, comma is decimal. */
const DEPOSIT_AR_GROUPED = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
/** Ungrouped with a comma decimal: "50000", "50000,5". */
const DEPOSIT_COMMA_DECIMAL = /^\d+(?:,\d{1,2})?$/;
/** Ungrouped with a dot decimal, i.e. what `String(amount)` round-trips as. */
const DEPOSIT_PLAIN = /^\d+(?:\.\d{1,2})?$/;

/**
 * Read the deposit field without ever coercing — the validating half of the
 * pair, and the one the form uses to gate its own submit.
 *
 * The admin types in es-AR, where "." groups thousands and "," is the decimal
 * point, and the app's output side renders deposits through
 * `Intl.NumberFormat("es-AR")` — it teaches the exact format it then has to be
 * able to read back. So the three grammars above are accepted and everything
 * else is a failure the caller must surface: this is the only money-valued
 * field in the feature, and a wrong number reaches the client's booking page
 * and their confirmation email.
 */
export function parseDeposit(v: BookingFormValues): DepositParse {
  // Whitespace and a leading "$" carry no numeric meaning in any of the three
  // grammars, and both come along when a formatted amount is pasted back in.
  const raw = v.depositAmount.replace(/\s/g, "").replace(/^\$/, "");
  if (!raw) return { ok: true, value: null };

  let normalized: string;
  if (DEPOSIT_AR_GROUPED.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (DEPOSIT_COMMA_DECIMAL.test(raw)) {
    normalized = raw.replace(",", ".");
  } else if (DEPOSIT_PLAIN.test(raw)) {
    normalized = raw;
  } else {
    return { ok: false };
  }

  const amount = Number(normalized);
  // The API rejects a non-positive amount with a 400; failing here turns that
  // round trip into the same inline message a typo gets — and, crucially,
  // keeps "0" from being quietly downgraded into the erase.
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false };
  return { ok: true, value: { amount, currency: v.depositCurrency } };
}

/**
 * The API-shaped accessor: the value the POST/PATCH bodies want. `null` means
 * one thing and one thing only — the empty field, which is the PATCH
 * contract's explicit erase.
 *
 * For callers that have already been past the form's submit guard, which is
 * where an unparseable amount is caught and shown. It throws rather than
 * returning `null` for one, because returning `null` would delete the client's
 * deposit — the exact bug this pair replaces. Use `parseDeposit` anywhere the
 * failure has to be handled instead of thrown.
 */
export function toApiDeposit(
  v: BookingFormValues,
): { amount: number; currency: Currency } | null {
  const parsed = parseDeposit(v);
  if (!parsed.ok) {
    throw new RangeError(`Unparseable deposit amount: ${v.depositAmount}`);
  }
  return parsed.value;
}
