/**
 * The calendar's collection route: read a window of months, create a booking.
 *
 * Both handlers do the same two things — validate everything the caller sent
 * before an R2 key is built, then hand the storage to src/lib/bookings-store.ts.
 * Three constraints a reader should not have to reverse-engineer:
 *
 *   - `months` is capped at six and every entry is matched against MONTH_RE
 *     BEFORE it reaches monthKey(). The value is interpolated straight into an
 *     object key, so an unvalidated one is a path the caller chose.
 *   - the month index buckets by the **UTC** month of `startsAt` (see the
 *     bookings-store header), never the studio zone. A booking made in the
 *     three hours after UTC midnight on the 1st would otherwise land in a
 *     bucket no rebuild ever puts it back into.
 *   - both instants are re-serialised through Date before they are stored: the
 *     store sorts and buckets by comparing `startsAt` as a plain string, which
 *     is only chronological while every stored value is canonical UTC.
 *
 * The body validators below are duplicated in ../bookings/[id]/route.ts rather
 * than shared. A Next route module may only export HTTP handlers, so there is
 * no place to put them that both files can import from without adding a
 * library file outside this change.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { monthKeyOf } from "@/lib/booking-time";
import {
  addToMonthIndex,
  BookingConflictError,
  createBooking,
  listMonths,
  toAdminAppointment,
} from "@/lib/bookings-store";
import {
  ADMIN_NOTES_MAX,
  CURRENCIES,
  EMAIL_MAX,
  EMAIL_RE,
  hasContact,
  IG_RE,
  MAX_DURATION_MS,
  MONTH_RE,
  NAME_MAX,
  normalizeEmail,
  normalizeInstagram,
  PHONE_RE,
  type AdminAppointment,
  type BookingSeed,
  type Currency,
} from "@/lib/bookings-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";

/** The calendar keeps three months loaded; six is the generous ceiling. */
const MAX_MONTHS = 6;

/** Token-scoped admin data behind a CDN — never cached, on any response. */
const NO_STORE = { "cache-control": "no-store" };

function ok(body: Record<string, unknown>, status = 200): Response {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function fail(error: string, status: number, message?: string): Response {
  return NextResponse.json(
    message ? { error, message } : { error },
    { status, headers: NO_STORE },
  );
}

/**
 * One catch for the whole feature. Missing env is a 503 the calendar page
 * renders as a config panel; a lost CAS race is a 409 the admin can simply
 * retry. Anything else is R2 misbehaving and carries its message, which is
 * safe here in a way it would not be on a public route — this handler is
 * behind assertAdminApi().
 */
function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof BookingConflictError) return fail("conflict", 409, err.message);
  console.error(`bookings: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/* ────────────────────────── body validation ────────────────────────── */

type SeedResult =
  | { ok: true; seed: BookingSeed }
  | { ok: false; error: string; message: string };

/**
 * Normalise, then validate — in that order, because "@Bocha" and
 * "https://instagram.com/bocha/" are the same handle and neither matches IG_RE
 * until normalizeInstagram() has had it.
 */
function readSeed(raw: unknown): SeedResult {
  if (raw === undefined || raw === null) return { ok: true, seed: {} };
  if (typeof raw !== "object") {
    return { ok: false, error: "invalid-body", message: "`seed` must be an object." };
  }
  const input = raw as Record<string, unknown>;
  const fields = ["name", "email", "instagram", "phone"] as const;
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return {
        ok: false,
        error: "invalid-body",
        message: `seed.${field} must be a string.`,
      };
    }
  }
  const str = (field: (typeof fields)[number]): string => {
    const value = input[field];
    return typeof value === "string" ? value : "";
  };

  const name = str("name").trim();
  if (name.length > NAME_MAX) {
    return {
      ok: false,
      error: "invalid-body",
      message: `Name is longer than ${NAME_MAX} characters.`,
    };
  }
  const email = normalizeEmail(str("email"));
  if (email && (email.length > EMAIL_MAX || !EMAIL_RE.test(email))) {
    return {
      ok: false,
      error: "invalid-email",
      message: "That email address does not look valid.",
    };
  }
  const instagram = normalizeInstagram(str("instagram"));
  if (instagram && !IG_RE.test(instagram)) {
    return {
      ok: false,
      error: "invalid-instagram",
      message: "That Instagram handle does not look valid.",
    };
  }
  const phone = str("phone").trim();
  if (phone && !PHONE_RE.test(phone)) {
    return {
      ok: false,
      error: "invalid-phone",
      message: "That phone number does not look valid.",
    };
  }

  // Empty collapses to absent so a blank string never reaches bookingLabel()
  // and gets rendered as a name.
  return {
    ok: true,
    seed: {
      name: name || undefined,
      email: email || undefined,
      instagram: instagram || undefined,
      phone: phone || undefined,
    },
  };
}

type SlotResult =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; response: Response };

function readSlot(startsRaw: unknown, endsRaw: unknown): SlotResult {
  if (typeof startsRaw !== "string" || typeof endsRaw !== "string") {
    return {
      ok: false,
      response: fail("bad-slot", 400, "startsAt and endsAt must be ISO strings."),
    };
  }
  const start = Date.parse(startsRaw);
  const end = Date.parse(endsRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      ok: false,
      response: fail("bad-slot", 400, "startsAt and endsAt must be parseable instants."),
    };
  }
  if (end <= start) {
    return {
      ok: false,
      response: fail("bad-slot", 400, "An appointment must end after it starts."),
    };
  }
  if (end - start > MAX_DURATION_MS) {
    return {
      ok: false,
      response: fail(
        "bad-slot",
        400,
        `An appointment cannot run longer than ${MAX_DURATION_MS / 3_600_000} hours.`,
      ),
    };
  }
  return {
    ok: true,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  };
}

type DepositResult =
  | { ok: true; deposit: { amount: number; currency: Currency } | undefined }
  | { ok: false; response: Response };

/** `null` and absent both read as "no deposit"; PATCH is what tells them apart. */
function readDeposit(raw: unknown): DepositResult {
  if (raw === undefined || raw === null) return { ok: true, deposit: undefined };
  if (typeof raw !== "object") {
    return {
      ok: false,
      response: fail("invalid-body", 400, "`deposit` must be an object or null."),
    };
  }
  const input = raw as { amount?: unknown; currency?: unknown };
  if (
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return {
      ok: false,
      response: fail("invalid-body", 400, "deposit.amount must be a positive number."),
    };
  }
  if (typeof input.currency !== "string") {
    return {
      ok: false,
      response: fail("invalid-body", 400, "deposit.currency must be a string."),
    };
  }
  const declared = input.currency;
  const currency = CURRENCIES.find((c) => c === declared);
  if (!currency) {
    return {
      ok: false,
      response: fail(
        "invalid-body",
        400,
        `deposit.currency must be one of ${CURRENCIES.join(", ")}.`,
      ),
    };
  }
  return { ok: true, deposit: { amount: input.amount, currency } };
}

type NotesResult =
  | { ok: true; adminNotes: string | undefined }
  | { ok: false; response: Response };

function readAdminNotes(raw: unknown): NotesResult {
  if (raw === undefined || raw === null) return { ok: true, adminNotes: undefined };
  if (typeof raw !== "string") {
    return {
      ok: false,
      response: fail("invalid-body", 400, "`adminNotes` must be a string."),
    };
  }
  const trimmed = raw.trim();
  if (trimmed.length > ADMIN_NOTES_MAX) {
    return {
      ok: false,
      response: fail(
        "invalid-body",
        400,
        `Notes are longer than ${ADMIN_NOTES_MAX} characters.`,
      ),
    };
  }
  return { ok: true, adminNotes: trimmed || undefined };
}

type MonthsResult = { ok: true; months: string[] } | { ok: false; response: Response };

function readMonths(raw: string | null): MonthsResult {
  const months = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ),
  ];
  if (months.length === 0) {
    return {
      ok: false,
      response: fail("bad-month", 400, "Pass ?months=YYYY-MM,YYYY-MM."),
    };
  }
  if (months.length > MAX_MONTHS) {
    return {
      ok: false,
      response: fail("bad-month", 400, `At most ${MAX_MONTHS} months per request.`),
    };
  }
  for (const month of months) {
    if (!MONTH_RE.test(month)) {
      return {
        ok: false,
        response: fail("bad-month", 400, `"${month}" is not a YYYY-MM month.`),
      };
    }
  }
  return { ok: true, months };
}

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/* ────────────────────────── handlers ────────────────────────── */

export async function GET(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  const parsed = readMonths(new URL(req.url).searchParams.get("months"));
  if (!parsed.ok) return parsed.response;

  try {
    const byMonth = await listMonths(parsed.months);
    // listMonths() returns every requested key, empty months included, each
    // array already sorted by startsAt ascending.
    const months: Record<string, AdminAppointment[]> = {};
    for (const [month, records] of Object.entries(byMonth)) {
      months[month] = await Promise.all(records.map((r) => toAdminAppointment(r)));
    }
    return ok({ ok: true, months });
  } catch (err) {
    return storeFailure(err, "GET /api/admin/bookings");
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  const slot = readSlot(body.startsAt, body.endsAt);
  if (!slot.ok) return slot.response;

  const seed = readSeed(body.seed);
  if (!seed.ok) return fail(seed.error, 400, seed.message);
  if (!hasContact(seed.seed)) {
    return fail(
      "missing-contact",
      400,
      "A booking needs an email address or an Instagram handle.",
    );
  }

  const deposit = readDeposit(body.deposit);
  if (!deposit.ok) return deposit.response;

  const notes = readAdminNotes(body.adminNotes);
  if (!notes.ok) return notes.response;

  try {
    const record = await createBooking({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      seed: seed.seed,
      deposit: deposit.deposit,
      adminNotes: notes.adminNotes,
    });
    // Index second, and best-effort inside the store: the record is the source
    // of truth and a failed index write is repaired by the reindex route. It is
    // still reported — a booking that committed but is in no index is reachable
    // by its private link and invisible on the calendar, which is the one
    // failure here nobody would otherwise notice, so `indexWarning` tells the
    // admin to run the repair.
    const indexed = await addToMonthIndex(monthKeyOf(record.startsAt, "UTC"), record.id);
    const body: Record<string, unknown> = {
      ok: true,
      appointment: await toAdminAppointment(record),
    };
    if (!indexed) body.indexWarning = true;
    return ok(body, 201);
  } catch (err) {
    return storeFailure(err, "POST /api/admin/bookings");
  }
}
