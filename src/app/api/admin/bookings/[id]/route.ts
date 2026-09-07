/**
 * One booking: read it, edit it, delete it.
 *
 * The important handler is PATCH, and the important thing about PATCH is
 * everything it does NOT write. An admin edit touches the slot, the appointment's
 * time zone, the seed, the deposit, the notes and the cancel flag — and nothing
 * else. `client`,
 * `receipt`, `counters`, `emails` and `tokenEpoch` are copied across from the
 * record the mutator was handed, so a save from the sheet can never erase
 * `termsAcceptedAt`. That field is the only consent evidence this system has,
 * the client writes it from a different browser minutes later, and losing it is
 * precisely the bug the CAS design in bookings-store.ts exists to prevent.
 * The next record is therefore built field by field rather than by spreading:
 * a field added to BookingRecord later must be typed out here before it can
 * ride along on an admin write.
 *
 * The mutator is also PURE — it is re-run from scratch on every CAS retry, so
 * every value it needs (the validated patch, the cancellation timestamp) is
 * computed once, before the loop, and only read inside it.
 *
 * The body validators below are duplicated from ../route.ts rather than shared.
 * A Next route module may only export HTTP handlers, so there is no place to
 * put them that both files can import from without adding a library file
 * outside this change.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { monthKeyOf } from "@/lib/booking-time";
import {
  BookingConflictError,
  deleteBooking,
  getBooking,
  moveBetweenMonthIndexes,
  mutateBooking,
  toAdminAppointment,
} from "@/lib/bookings-store";
import {
  ADMIN_NOTES_MAX,
  BOOKING_ID_RE,
  CURRENCIES,
  EMAIL_MAX,
  EMAIL_RE,
  hasContact,
  IG_RE,
  isValidTimeZone,
  MAX_DURATION_MS,
  NAME_MAX,
  normalizeEmail,
  normalizeInstagram,
  PHONE_RE,
  type BookingSeed,
  type Currency,
} from "@/lib/bookings-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof BookingConflictError) return fail("conflict", 409, err.message);
  console.error(`bookings: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/** Checked before any key is built — the id is interpolated into an R2 path. */
function rejectBadId(id: string): Response | null {
  return BOOKING_ID_RE.test(id)
    ? null
    : fail("bad-id", 400, "That is not a booking id.");
}

const NOT_FOUND = "No booking with that id.";

/* ────────────────────────── body validation ────────────────────────── */

type SeedResult =
  | { ok: true; seed: BookingSeed }
  | { ok: false; error: string; message: string };

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
  // Normalise before validating: "@Bocha" and an instagram.com URL are the same
  // handle and neither matches IG_RE until normalizeInstagram() has had it.
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

/**
 * Re-serialised through Date rather than stored as sent: the store sorts and
 * buckets records by comparing `startsAt` as a plain string, which is only
 * chronological while every stored value is canonical UTC.
 */
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

type TimeZoneResult =
  | { ok: true; timeZone: string | undefined }
  | { ok: false; response: Response };

/**
 * The zone of the place the session happens — never the admin's own, and never
 * the calendar's viewing zone. Checked against Intl here rather than at render
 * time: an invalid zone that reaches the bucket throws on every later format of
 * that booking — the calendar, the client's page, both emails — and the only
 * cure is editing the record back out.
 *
 * Blank reads as null does, an erase back to the studio fallback, so an admin
 * who clears the field gets the same record a pre-zone booking already is.
 */
function readTimeZone(raw: unknown): TimeZoneResult {
  if (raw === undefined || raw === null) return { ok: true, timeZone: undefined };
  if (typeof raw !== "string") {
    return {
      ok: false,
      response: fail("bad-timezone", 400, "`timeZone` must be an IANA zone name."),
    };
  }
  const timeZone = raw.trim();
  if (!timeZone) return { ok: true, timeZone: undefined };
  if (!isValidTimeZone(timeZone)) {
    return {
      ok: false,
      response: fail("bad-timezone", 400, "That is not a time zone Intl knows."),
    };
  }
  return { ok: true, timeZone };
}

type DepositResult =
  | { ok: true; deposit: { amount: number; currency: Currency } | undefined }
  | { ok: false; response: Response };

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

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/* ────────────────────────── handlers ────────────────────────── */

export async function GET(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  try {
    const record = await getBooking(id);
    if (!record) return fail("not-found", 404, NOT_FOUND);
    return ok({ ok: true, appointment: await toAdminAppointment(record) });
  } catch (err) {
    return storeFailure(err, `GET /api/admin/bookings/${id}`);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  // The two instants move together or not at all. Validating "ends after it
  // starts" against a half-patched pair would mean reading the stored record
  // inside the mutator, which is exactly what a pure mutator may not do.
  const hasStart = Object.hasOwn(body, "startsAt");
  const hasEnd = Object.hasOwn(body, "endsAt");
  if (hasStart !== hasEnd) {
    return fail("bad-slot", 400, "Send startsAt and endsAt together, or neither.");
  }
  let slot: { startsAt: string; endsAt: string } | undefined;
  if (hasStart && hasEnd) {
    const read = readSlot(body.startsAt, body.endsAt);
    if (!read.ok) return read.response;
    slot = { startsAt: read.startsAt, endsAt: read.endsAt };
  }

  // Same `set` convention as the deposit below, and validated out here for the
  // same reason as everything else in this handler: the mutator is re-run on
  // every CAS retry, so it may only assign a value this pass already checked.
  let timeZone: { set: boolean; value: string | undefined } = {
    set: false,
    value: undefined,
  };
  if (Object.hasOwn(body, "timeZone")) {
    const read = readTimeZone(body.timeZone);
    if (!read.ok) return read.response;
    timeZone = { set: true, value: read.timeZone };
  }

  let seed: BookingSeed | undefined;
  if (Object.hasOwn(body, "seed")) {
    const read = readSeed(body.seed);
    if (!read.ok) return fail(read.error, 400, read.message);
    // The seed's invariant is email || instagram, on edit as much as on create:
    // an edit that cleared both would leave a booking nobody can be told about.
    if (!hasContact(read.seed)) {
      return fail(
        "missing-contact",
        400,
        "A booking needs an email address or an Instagram handle.",
      );
    }
    seed = read.seed;
  }

  // `set` is what tells "leave it alone" (key absent) from "erase it" (null).
  let deposit: { set: boolean; value: { amount: number; currency: Currency } | undefined } =
    { set: false, value: undefined };
  if (Object.hasOwn(body, "deposit")) {
    const read = readDeposit(body.deposit);
    if (!read.ok) return read.response;
    deposit = { set: true, value: read.deposit };
  }

  let notes: { set: boolean; value: string | undefined } = { set: false, value: undefined };
  if (Object.hasOwn(body, "adminNotes")) {
    const read = readAdminNotes(body.adminNotes);
    if (!read.ok) return read.response;
    notes = { set: true, value: read.adminNotes };
  }

  let cancelled: boolean | undefined;
  if (Object.hasOwn(body, "cancelled")) {
    if (typeof body.cancelled !== "boolean") {
      return fail("invalid-body", 400, "`cancelled` must be a boolean.");
    }
    cancelled = body.cancelled;
  }

  // Stamped once, out here: reading the clock inside the mutator would make it
  // impure and give a retried write a different cancellation time.
  const cancelledNow = new Date().toISOString();

  try {
    // Read first so a missing booking is a 404 rather than the plain Error
    // mutateBooking throws, and so the index move below knows where it was.
    const before = await getBooking(id);
    if (!before) return fail("not-found", 404, NOT_FOUND);

    const updated = await mutateBooking(id, (current) => ({
      version: current.version,
      id: current.id,
      createdAt: current.createdAt,
      // Re-stamped by mutateBooking() on the committed write.
      updatedAt: current.updatedAt,
      startsAt: slot ? slot.startsAt : current.startsAt,
      endsAt: slot ? slot.endsAt : current.endsAt,
      timeZone: timeZone.set ? timeZone.value : current.timeZone,
      seed: seed ?? current.seed,
      deposit: deposit.set ? deposit.value : current.deposit,
      adminNotes: notes.set ? notes.value : current.adminNotes,
      // Re-cancelling keeps the original timestamp, so the flag is idempotent.
      cancelledAt:
        cancelled === undefined
          ? current.cancelledAt
          : cancelled
            ? (current.cancelledAt ?? cancelledNow)
            : undefined,
      // Never from an admin PATCH. See the header block.
      client: current.client,
      receipt: current.receipt,
      tokenEpoch: current.tokenEpoch,
      counters: current.counters,
      emails: current.emails,
    }));

    // After the record commits, never before: a move written first and a record
    // write that then lost its CAS race would point the index at a month the
    // booking is not in. Both index writes are best-effort inside the store,
    // which no-ops when the month did not change and never drops the old entry
    // on a failed add — but a half-done move leaves the appointment listed
    // under the wrong month, so `indexWarning` tells the admin to reindex.
    const from = monthKeyOf(before.startsAt, "UTC");
    const to = monthKeyOf(updated.startsAt, "UTC");
    const indexed = await moveBetweenMonthIndexes(from, to, id);

    const body: Record<string, unknown> = {
      ok: true,
      appointment: await toAdminAppointment(updated),
    };
    if (!indexed) body.indexWarning = true;
    return ok(body);
  } catch (err) {
    return storeFailure(err, `PATCH /api/admin/bookings/${id}`);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  const badId = rejectBadId(id);
  if (badId) return badId;

  try {
    if (!(await getBooking(id))) return fail("not-found", 404, NOT_FOUND);
    // deleteBooking() drops the receipt blob, then the month-index entry, then
    // the record — the order that never leaves bank data nothing points at.
    await deleteBooking(id);
    return ok({ ok: true });
  } catch (err) {
    return storeFailure(err, `DELETE /api/admin/bookings/${id}`);
  }
}
