/**
 * The booking persistence layer — the only module that knows the R2 key layout.
 *
 * Three object families, all in the PRIVATE bucket (see src/lib/r2-private.ts):
 *   bookings/records/<id>.json            one BookingRecord — the source of truth
 *   bookings/months/<YYYY-MM>.json        a derived index of IDs only
 *   bookings/receipts/<id>/<sha16>.<ext>  the receipt bytes, content-addressed
 *
 * Four constraints a reader should not have to reverse-engineer:
 *
 * 1. Every record update is a compare-and-swap (`IfMatch` on the ETag read a
 *    moment earlier), never a plain read-modify-write. Two writers genuinely
 *    race here: the admin editing an appointment in the sheet and the client
 *    accepting the terms or uploading a receipt through their private link. A
 *    last-write-wins PUT would let Bocha's "changed the time" save silently
 *    erase `termsAcceptedAt` — the one field in this record that exists to be
 *    evidence. mutateBooking() re-reads and re-applies instead, which is why
 *    its mutator must be pure.
 *
 * 2. Status is never stored. It is derived on every read by deriveStatus(), so
 *    nothing in here — least of all the month index — carries a status cache
 *    that could disagree with the facts.
 *
 * 3. The month index holds IDs and nothing else: no name, no email, no status,
 *    no label. It is written by ADMIN routes only, which is what makes it a
 *    single-writer object and keeps client requests touching exactly one key.
 *    It is derived data, so every index write here is best-effort — a failure
 *    is logged rather than failing a mutation that already committed to the
 *    record — but it is never silent: the helpers resolve `false` so the route
 *    can tell the admin the booking it just saved is not on the calendar yet.
 *    Two things are stricter. rebuildMonthIndexes() is an explicit repair and
 *    throws. And nothing here overwrites a whole month from a record scan that
 *    could not read every record (fetchRecords' `failed` bucket): a bad minute
 *    on R2 is not evidence a booking is gone, and these writes are full
 *    overwrites, so a hole in the scan is a booking erased from the calendar.
 *
 * 4. Index buckets are the **UTC** month of `startsAt` (BookingMonthIndex says
 *    so, and this file is the only thing that rebuilds them). A route adding or
 *    moving an entry must bucket the same way — `monthKeyOf(startsAt, "UTC")`,
 *    never the studio zone — or a booking scheduled in the three hours after
 *    UTC midnight on the 1st lands in a month nobody rebuilds it into.
 *
 * 5. A record carries its OWN `timeZone` — the zone of the place that session
 *    happens, since Bocha tattoos in Buenos Aires but also guest-spots abroad,
 *    so there is no single studio clock to render everything in. It is optional
 *    on the record because production is full of bookings written before the
 *    field existed, and both wire shapes below resolve it through
 *    `recordTimeZone`, so nothing downstream ever sees `undefined`.
 *
 * Callers validate ids against BOOKING_ID_RE before calling anything here; the
 * key builders interpolate what they are given.
 */
import "server-only";
import {
  BOOKING_ID_RE,
  BOOKING_SCHEMA_VERSION,
  BOOKING_TOKEN_RE,
  LINK_GRACE_MS,
  type AdminAppointment,
  type BookingAccess,
  type BookingId,
  type BookingMonthIndex,
  type BookingRecord,
  type BookingSeed,
  type Currency,
  type PublicBookingView,
  type ReceiptExt,
} from "./bookings-types";
import type { PublicPaymentSettings } from "./settings-types";
import { deriveStatus } from "./booking-status";
import {
  bookingLinks,
  mintBookingToken,
  newBookingId,
  parseBookingToken,
} from "./booking-token";
import { monthKeyOf, recordTimeZone, STUDIO_TIME_ZONE } from "./booking-time";
import {
  deletePrivate,
  getPrivateJson,
  listPrivate,
  putPrivateJson,
  PreconditionFailed,
} from "./r2-private";

/* ────────────────────────── keys ────────────────────────── */

export const recordKey = (id: BookingId) => `bookings/records/${id}.json`;
export const monthKey = (m: string) => `bookings/months/${m}.json`;
export const receiptKey = (id: BookingId, sha16: string, ext: ReceiptExt) =>
  `bookings/receipts/${id}/${sha16}.${ext}`;

/** Must stay in sync with recordKey() — it is what a full rebuild lists. */
const RECORDS_PREFIX = "bookings/records/";

/** Retry delays for a refused conditional write, in ms. 4 attempts total. */
const RETRY_BACKOFF_MS = [50, 120, 300];

/** How many record GETs are in flight at once while reading a month. */
const RECORD_FETCH_CONCURRENCY = 8;

export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingConflictError";
  }
}

/* ────────────────────────── records ────────────────────────── */

export type CreateBookingInput = {
  startsAt: string;
  endsAt: string;
  /** IANA zone of the place the session happens. The route validates it with
   *  isValidTimeZone() first; omitted means the record reads back as the studio. */
  timeZone?: string;
  seed: BookingSeed;
  deposit?: { amount: number; currency: Currency };
  adminNotes?: string;
};

/**
 * Mint a new booking. `IfNoneMatch: "*"` rather than a plain PUT: the id is 16
 * CSPRNG bytes so a collision is not a real scenario, but the failure mode if
 * one ever happened is overwriting a stranger's appointment, and a create that
 * cannot overwrite costs nothing.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingRecord> {
  const now = new Date().toISOString();
  const record: BookingRecord = {
    version: BOOKING_SCHEMA_VERSION,
    id: newBookingId(),
    createdAt: now,
    updatedAt: now,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
    seed: input.seed,
    client: {},
    deposit: input.deposit,
    adminNotes: input.adminNotes,
    // Epochs are 1-based: a stored 0 is a record no version of this code wrote.
    tokenEpoch: 1,
    counters: { submitAttempts: 0, uploadAttempts: 0 },
    emails: {},
  };
  await putPrivateJson(recordKey(record.id), record, { ifNoneMatch: "*" });
  return record;
}

export async function getBooking(id: BookingId): Promise<BookingRecord | null> {
  const found = await getPrivateJson<BookingRecord>(recordKey(id));
  return found ? found.data : null;
}

/**
 * Conditional read-modify-write of one record.
 *
 * `apply` MUST be a pure function of the record it is handed. It is re-run from
 * scratch on every retry against a freshly-read record, so it may not close
 * over a copy read earlier, mutate its argument, or depend on how many times it
 * has run. Returning the SAME OBJECT REFERENCE means "no change" and skips the
 * write entirely.
 *
 * This is the mechanism that stops an admin's edit from silently erasing the
 * client's consent record. The admin sheet and the client's private link write
 * the same object from different browsers minutes apart; a plain PUT of a
 * record read before the client accepted would drop `termsAcceptedAt`,
 * `termsVersion` and the receipt with no error anywhere. Here the losing writer
 * sees the ETag move, re-reads, and re-applies its own change on top.
 *
 * `updatedAt` is stamped here on every committed write so no mutator can forget
 * it. After 4 refused attempts this throws BookingConflictError; a missing
 * record throws a plain Error, so callers that must answer 404 read with
 * getBooking() first.
 */
export async function mutateBooking(
  id: BookingId,
  apply: (current: BookingRecord) => BookingRecord,
): Promise<BookingRecord> {
  const key = recordKey(id);
  for (let attempt = 0; ; attempt++) {
    const found = await getPrivateJson<BookingRecord>(key);
    if (!found) throw new Error(`Booking ${id} does not exist.`);

    const applied = apply(found.data);
    if (applied === found.data) return found.data;
    const next: BookingRecord = { ...applied, updatedAt: new Date().toISOString() };

    try {
      await putPrivateJson(key, next, { ifMatch: found.etag });
      return next;
    } catch (err) {
      // Only a refused precondition is retryable; anything else is R2 being
      // down or misconfigured and retrying it just delays the error.
      if (!(err instanceof PreconditionFailed)) throw err;
      if (attempt >= RETRY_BACKOFF_MS.length) {
        throw new BookingConflictError(
          `Booking ${id} was modified by someone else ${attempt + 1} times in a row.`,
        );
      }
      await sleep(jittered(RETRY_BACKOFF_MS[attempt]));
    }
  }
}

/**
 * Full teardown, in the order that never orphans bank data: the receipt blob
 * first, then the index entry, then the record. The record dies last so a
 * failure part-way leaves a booking that still resolves and can be deleted
 * again, rather than a receipt nothing points at.
 */
export async function deleteBooking(id: BookingId): Promise<void> {
  const record = await getBooking(id);
  if (record?.receipt) {
    try {
      await deletePrivate(record.receipt.key);
    } catch (err) {
      console.error(`bookings: failed to delete receipt for ${id}`, err);
    }
  }
  if (record) await removeFromMonthIndex(indexMonthOf(record), id);
  await deletePrivate(recordKey(id));
}

/* ────────────────────────── access ────────────────────────── */

/**
 * Resolve a private link, cheapest check first: a shape gate and an HMAC, both
 * with no I/O, before a single R2 read. A forged token therefore costs an
 * attacker one hash and buys them no information about which booking ids exist.
 *
 * Expiry is computed from the appointment AT CHECK TIME and is never stamped
 * into the token, so moving an appointment two months out extends the link Bocha
 * already sent instead of quietly killing it.
 *
 * Every reason is distinct here on purpose: the booking PAGE renders humane copy
 * for a revoked or expired link (its visitor demonstrably holds a signed token),
 * while the API routes collapse all five to one vague 404.
 */
export async function verifyBookingAccess(token: string): Promise<BookingAccess> {
  if (!BOOKING_TOKEN_RE.test(token)) return { ok: false, reason: "bad-token" };

  const parsed = await parseBookingToken(token);
  if (!parsed.ok) return { ok: false, reason: "bad-token" };

  const found = await getPrivateJson<BookingRecord>(recordKey(parsed.id));
  if (!found) return { ok: false, reason: "not-found" };
  const record = found.data;

  // One integer bump on the record kills every link ever issued before it.
  if (parsed.epoch < record.tokenEpoch) return { ok: false, reason: "link-revoked" };
  if (record.cancelledAt) return { ok: false, reason: "booking-cancelled" };
  if (Date.now() > Date.parse(record.endsAt) + LINK_GRACE_MS) {
    return { ok: false, reason: "link-expired" };
  }
  return { ok: true, record };
}

/* ────────────────────────── month index ────────────────────────── */

/** The bucket a record belongs in. UTC — see constraint 4 in the header. */
function indexMonthOf(b: Pick<BookingRecord, "startsAt">): string {
  return monthKeyOf(b.startsAt, "UTC");
}

/**
 * Read-modify-write of one month index, conditional for the same reason the
 * record CAS is, though the stakes are far lower: two admin tabs, never a
 * client. `apply` gets the current id list (empty when the index does not exist
 * yet) and must return the list it wants stored; returning an equal list on an
 * index that already exists skips the write.
 *
 * Throws on failure. Callers that are on a mutation path go through
 * bestEffortIndex() instead.
 */
async function mutateMonthIndex(
  month: string,
  apply: (ids: BookingId[]) => BookingId[],
): Promise<void> {
  const key = monthKey(month);
  for (let attempt = 0; ; attempt++) {
    const found = await getPrivateJson<BookingMonthIndex>(key);
    const current = found?.data.ids ?? [];
    const next = apply(current);
    // A missing index is still written when the result is empty: an existing
    // empty index is what stops listMonths() from rescanning the whole bucket
    // on every visit to a quiet month.
    if (found && sameIds(current, next)) return;

    const index: BookingMonthIndex = {
      version: 1,
      month,
      ids: next,
      updatedAt: new Date().toISOString(),
    };
    try {
      await putPrivateJson(
        key,
        index,
        found ? { ifMatch: found.etag } : { ifNoneMatch: "*" },
      );
      return;
    } catch (err) {
      if (!(err instanceof PreconditionFailed)) throw err;
      if (attempt >= RETRY_BACKOFF_MS.length) throw err;
      await sleep(jittered(RETRY_BACKOFF_MS[attempt]));
    }
  }
}

/**
 * The index is derived and rebuildable — from POST /api/admin/bookings/reindex,
 * or inline the next time listMonths() finds it missing — so a failed index
 * write must never fail the record mutation that already committed.
 *
 * Swallowed, but not silent: resolves `false` when the write failed, so a
 * mutation route can answer `indexWarning` and the admin learns that the
 * booking exists and is reachable by its private link but is not on the
 * calendar until someone reindexes.
 */
async function bestEffortIndex(
  month: string,
  apply: (ids: BookingId[]) => BookingId[],
): Promise<boolean> {
  try {
    await mutateMonthIndex(month, apply);
    return true;
  } catch (err) {
    console.error(`bookings: month index write failed for ${month}`, err);
    return false;
  }
}

/** False when the write failed and was swallowed — see bestEffortIndex(). */
export async function addToMonthIndex(month: string, id: BookingId): Promise<boolean> {
  return bestEffortIndex(month, (ids) => (ids.includes(id) ? ids : [...ids, id]));
}

/** False when the write failed and was swallowed — see bestEffortIndex(). */
export async function removeFromMonthIndex(
  month: string,
  id: BookingId,
): Promise<boolean> {
  return bestEffortIndex(month, (ids) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : ids,
  );
}

/**
 * Add first, remove second — and only remove once the add has actually landed.
 * Of the two ways a half-done move can end, appearing in two months is a
 * visible oddity that the next reindex fixes, while disappearing from both is a
 * booking Bocha cannot see. Ordering alone only buys that against process
 * death: addToMonthIndex() catches its own failure and resolves normally, so
 * the add goes through mutateMonthIndex() directly here and a throw returns
 * before the old entry is touched.
 *
 * Resolves false when either write failed. The record itself has already
 * committed, so the caller reports that rather than failing the request.
 */
export async function moveBetweenMonthIndexes(
  from: string,
  to: string,
  id: BookingId,
): Promise<boolean> {
  if (from === to) return true;
  try {
    await mutateMonthIndex(to, (ids) => (ids.includes(id) ? ids : [...ids, id]));
  } catch (err) {
    console.error(`bookings: month index add failed for ${to}`, err);
    return false; // leave the old entry: in two months beats in none
  }
  return removeFromMonthIndex(from, id);
}

/**
 * Rebuild indexes from the records themselves — the repair path, and the reason
 * no index is ever load-bearing. With no argument it rebuilds every month that
 * has a booking; with an explicit list it rebuilds exactly those months, so a
 * month whose bookings all moved away can be emptied rather than left stale.
 *
 * Unlike every other index write in this file, failures propagate: an explicit
 * repair that reports success while writing nothing is worse than an error.
 * That includes the scan — every write below REPLACES a month's id list, so a
 * record the scan could not read would be deleted from the calendar by the
 * very call that was supposed to repair it. One unreadable object therefore
 * aborts the rebuild before anything is written.
 *
 * The returned counts describe writes that committed: `months` is the months
 * rebuilt and `records` the ids now in their indexes, not the objects scanned.
 */
export async function rebuildMonthIndexes(
  months?: string[],
): Promise<{ months: number; records: number }> {
  const scan = await scanRecords();
  if (scan.failed.length > 0) {
    throw new Error(
      `Refusing to rebuild month indexes: ${scan.failed.length} record(s) could not ` +
        `be read (first: ${scan.failed[0]}). Retry once R2 is answering.`,
    );
  }
  const grouped = groupByMonth(scan.records);
  const wanted = months ? [...new Set(months)] : [...grouped.keys()];

  let records = 0;
  for (const month of wanted) {
    const ids = sortByStart(grouped.get(month) ?? []).map((r) => r.id);
    await mutateMonthIndex(month, () => ids);
    records += ids.length;
  }
  return { months: wanted.length, records };
}

/* ────────────────────────── reads ────────────────────────── */

/**
 * The calendar's one read. Every requested month comes back as a key, sorted by
 * `startsAt` ascending, even when it is empty or its index could not be written.
 *
 * A missing index is rebuilt inline from the records prefix — one scan covers
 * every missing month in the request, because the calendar always asks for
 * three at a time and a scan per month would be three full listings — but only
 * when that scan read every object it listed. See below.
 *
 * An id whose record 404s is pruned from the index. A record read that FAILS is
 * not: a bad minute on R2 is not evidence a booking is gone, and pruning on it
 * would delete the calendar one transient error at a time. This never throws on
 * such a read either: the scan sweeps the whole records prefix, so one
 * unreadable object would blank every month instead of hiding one booking.
 */
export async function listMonths(months: string[]): Promise<Record<string, BookingRecord[]>> {
  const wanted = [...new Set(months)];
  const out: Record<string, BookingRecord[]> = {};
  for (const month of wanted) out[month] = [];

  const indexed: Array<{ month: string; ids: BookingId[] }> = [];
  const missing: string[] = [];
  for (const month of wanted) {
    const found = await getPrivateJson<BookingMonthIndex>(monthKey(month));
    if (found) indexed.push({ month, ids: found.data.ids });
    else missing.push(month);
  }

  for (const { month, ids } of indexed) {
    const { records, gone } = await fetchRecords(ids);
    out[month] = sortByStart(records);
    if (gone.length > 0) {
      // Safe to write back: the index has a single writer class (admin routes)
      // and these ids just proved they resolve to nothing.
      await bestEffortIndex(month, (cur) => cur.filter((id) => !gone.includes(id)));
    }
  }

  if (missing.length > 0) {
    const scan = await scanRecords();
    // Serve what was read, but write nothing built on top of a hole. This
    // repair REPLACES the month's id list, and a scan that could not read
    // every object is not a list of what exists — a single failed read would
    // publish an index missing that booking (or, for a one-record month, an
    // empty one written with IfNoneMatch, which no later read ever revisits).
    // Leaving the index absent costs a rescan next time and loses nothing.
    const repairable = scan.failed.length === 0;
    if (!repairable) {
      console.error(
        `bookings: ${scan.failed.length} record(s) unreadable — serving ` +
          `${missing.join(", ")} from a partial scan, index write skipped`,
      );
    }
    const grouped = groupByMonth(scan.records);
    for (const month of missing) {
      const records = sortByStart(grouped.get(month) ?? []);
      out[month] = records;
      if (repairable) await bestEffortIndex(month, () => records.map((r) => r.id));
    }
  }

  return out;
}

/**
 * GET a list of records, 8 at a time, into three buckets: the records that came
 * back, the ids that resolved to nothing (`gone` — a 404, safe to prune from an
 * index), and the ids whose read THREW (`failed`).
 *
 * The third bucket is the one that matters. getPrivateJson() re-throws anything
 * that is not a genuine 404, so malformed JSON or a per-object permission
 * problem fails the same way every time, not once. Folding those ids into
 * `gone` — or dropping them, which is what this used to do — hands the caller a
 * list that reads as complete, and every caller that overwrites an index with
 * one deletes a booking from the calendar. `failed` is what lets them refuse.
 */
async function fetchRecords(
  ids: BookingId[],
): Promise<{ records: BookingRecord[]; gone: BookingId[]; failed: BookingId[] }> {
  const records: BookingRecord[] = [];
  const gone: BookingId[] = [];
  const failed: BookingId[] = [];
  for (let i = 0; i < ids.length; i += RECORD_FETCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + RECORD_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((id) => getPrivateJson<BookingRecord>(recordKey(id))),
    );
    settled.forEach((outcome, n) => {
      const id = chunk[n];
      if (outcome.status === "rejected") {
        console.error(`bookings: failed to read record ${id}`, outcome.reason);
        failed.push(id);
        return;
      }
      if (outcome.value) records.push(outcome.value.data);
      else gone.push(id);
    });
  }
  return { records, gone, failed };
}

/**
 * Every record in the bucket. The rebuild paths only — it lists and GETs
 * everything. `failed` is carried out because both callers are about to
 * overwrite an index and must not do it from a partial scan; a listed key that
 * 404s is not reported, since a record deleted mid-scan is genuinely not there.
 */
async function scanRecords(): Promise<{
  records: BookingRecord[];
  failed: BookingId[];
}> {
  const ids = (await listPrivate(RECORDS_PREFIX))
    .map((key) => key.slice(RECORDS_PREFIX.length).replace(/\.json$/, ""))
    .filter((id) => BOOKING_ID_RE.test(id));
  const { records, failed } = await fetchRecords(ids);
  return { records, failed };
}

/* ────────────────────────── wire shapes ────────────────────────── */

/**
 * The admin wire shape: the whole record, plus the derived status and a freshly
 * minted link, minus `receipt.key`. The private object key is the one field
 * that must never reach a browser — the receipt is served by a proxy route that
 * looks the key up server-side, so nothing in the UI has any use for it.
 * Built field by field for that reason: a secret added to BookingReceipt later
 * must not ride out on a spread.
 */
export async function toAdminAppointment(b: BookingRecord): Promise<AdminAppointment> {
  const token = await mintBookingToken(b.id, b.tokenEpoch);
  return {
    version: b.version,
    id: b.id,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    // Resolved on READ, so the dozen components that render a time never see an
    // absent zone. The fallback itself lives in booking-time's `recordTimeZone`
    // — one function shared with `toPublicView` and the emails, rather than an
    // `?? STUDIO_TIME_ZONE` written out three times and forgotten in one.
    timeZone: recordTimeZone(b),
    seed: b.seed,
    client: b.client,
    deposit: b.deposit,
    adminNotes: b.adminNotes,
    cancelledAt: b.cancelledAt,
    tokenEpoch: b.tokenEpoch,
    counters: b.counters,
    emails: b.emails,
    status: deriveStatus(b),
    receipt: b.receipt
      ? {
          filename: b.receipt.filename,
          contentType: b.receipt.contentType,
          ext: b.receipt.ext,
          bytes: b.receipt.bytes,
          sha256: b.receipt.sha256,
          uploadedAt: b.receipt.uploadedAt,
        }
      : undefined,
    // Passed through whole, unlike the receipt above. There is no private key
    // to strip here, and the provider payment id is the point: it is what the
    // admin searches for in their MercadoPago account when a client disputes a
    // deposit or asks for it back.
    payment: b.payment,
    token,
    links: bookingLinks(token),
  };
}

/**
 * The only shape the client booking page ever receives. Absent by construction:
 * `adminNotes`, `counters`, `emails`, `tokenEpoch` and `receipt.key`.
 *
 * Deliberately built field by field rather than by destructuring and spreading
 * the record. A spread with omissions is a denylist, and the next field added
 * to BookingRecord — an internal note, a flag, a second counter — would leak
 * through it silently. This way a new field is invisible here until someone
 * types it out. `payment` is the live example: it is collapsed to a boolean
 * below rather than sent, because the page renders "paid" and has no use for a
 * provider payment id or for an amount it did not choose.
 *
 * The payment settings arrive as an ARGUMENT rather than being read here. This
 * function is synchronous and pure — it is called inside route handlers that
 * have already committed a mutation — and loading a settings document from R2
 * in the middle of that would make it neither. Every caller (both booking pages
 * and the booking API routes) loads them once per request and hands them down.
 */
export function toPublicView(
  b: BookingRecord,
  paymentSettings: PublicPaymentSettings,
): PublicBookingView {
  const derived = deriveStatus(b);
  // verifyBookingAccess refuses a cancelled booking before anything can reach
  // this function, so this is unreachable. It throws rather than collapsing to
  // a softer status because the only soft value available is "pending", and a
  // cancelled appointment rendered as an open one would invite a client to
  // transfer a deposit for a session that no longer exists. An error page is
  // the better failure.
  if (derived === "cancelled") {
    throw new Error(`toPublicView called with a cancelled booking: ${b.id}`);
  }
  return {
    id: b.id,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    // The same `recordTimeZone` as toAdminAppointment: resolved once, on read,
    // so the booking page always has a zone to render this appointment in.
    timeZone: recordTimeZone(b),
    status: derived,
    seed: {
      name: b.seed.name,
      email: b.seed.email,
      instagram: b.seed.instagram,
      phone: b.seed.phone,
    },
    client: {
      name: b.client.name,
      email: b.client.email,
      instagram: b.client.instagram,
      phone: b.client.phone,
      note: b.client.note,
    },
    deposit: b.deposit,
    termsAccepted: Boolean(b.client.termsAcceptedAt),
    termsVersion: b.client.termsVersion,
    receipt: b.receipt
      ? {
          filename: b.receipt.filename,
          bytes: b.receipt.bytes,
          uploadedAt: b.receipt.uploadedAt,
        }
      : null,
    // The boolean, never the object. `payment` exists only on an approved
    // payment, so its presence IS the answer.
    paid: Boolean(b.payment),
    paymentSettings,
    studioTimeZone: STUDIO_TIME_ZONE,
  };
}

/* ────────────────────────── helpers ────────────────────────── */

/** UTC ISO strings sort chronologically as plain strings; every value here is one. */
function sortByStart(records: BookingRecord[]): BookingRecord[] {
  return [...records].sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
  );
}

function groupByMonth(records: BookingRecord[]): Map<string, BookingRecord[]> {
  const byMonth = new Map<string, BookingRecord[]>();
  for (const record of records) {
    const month = indexMonthOf(record);
    const bucket = byMonth.get(month);
    if (bucket) bucket.push(record);
    else byMonth.set(month, [record]);
  }
  return byMonth;
}

function sameIds(a: BookingId[], b: BookingId[]): boolean {
  return a === b || (a.length === b.length && a.every((id, i) => id === b[i]));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jitter over [base/2, 1.5 x base) so two racing writers never retry in lockstep. */
function jittered(base: number): number {
  return Math.round(base * (0.5 + Math.random()));
}
