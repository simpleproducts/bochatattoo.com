/**
 * The settings persistence layer — the sibling of src/lib/trips-store.ts, and
 * the only module that knows where settings live.
 *
 * One object, in the PRIVATE bucket:
 *   bookings/settings.json    the whole Settings document
 *
 * Four constraints a reader should not have to reverse-engineer:
 *
 * 1. The PRIVATE bucket, even though most of what is in here ends up printed on
 *    a client's booking page anyway. The email block does not — `notifyEmail`
 *    is the studio's own inbox — and the public half is chosen deliberately by
 *    toPublicPaymentSettings(), not by which bucket an object happens to sit
 *    in. Nothing should ever be readable merely because nobody thought about it.
 *
 * 2. Every write is a compare-and-swap (`IfMatch` on the ETag read a moment
 *    earlier), never a plain read-modify-write, for the same reason
 *    mutateBooking() and mutateTrips() are. The racing writers here are two
 *    admin tabs — or the same admin on a phone and a laptop — and the whole
 *    document is in the body, so a last-write-wins PUT would not lose a field:
 *    it would lose a whole SECTION. Saving the email form from a tab opened
 *    before the bank details were entered would blank the CBU, silently, and
 *    the next client to open their link would be shown nowhere to transfer to.
 *    mutateSettings() re-reads and re-applies instead, which is why its mutator
 *    must be PURE.
 *
 * 3. `IfNoneMatch: "*"` when the document does not exist yet, so the very first
 *    save cannot be made twice: two admins pressing Save at the same moment
 *    would otherwise both write a whole document and one of them would silently
 *    disappear. Like trips.json and unlike the month index in bookings-store.ts,
 *    an absent document is NOT written back on read — it costs nothing to read
 *    and DEFAULT_SETTINGS already answers it exactly.
 *
 * 4. Reads MERGE the stored document over DEFAULT_SETTINGS. A document written
 *    before the mercadopago block existed would otherwise hand every call site
 *    `undefined` where the type promises a boolean, and the compiler would
 *    never mention it, because a read is a cast over JSON.parse and casts do
 *    not check. The merge is per SECTION rather than one shallow spread for the
 *    same reason: spreading a stored `{ transfer: { alias } }` over the
 *    defaults replaces the entire default transfer block with a partial one,
 *    which does not remove the undefined — it just buries it a level deeper.
 *
 * Nothing is validated here. Lengths, address shapes and what counts as a
 * usable CBU are the route's job, exactly as they are for trips and bookings.
 */
import "server-only";
import {
  DEFAULT_SETTINGS,
  toPublicPaymentSettings,
  type EmailSettings,
  type PublicPaymentSettings,
  type Settings,
  type TransferSettings,
} from "./settings-types";
import { getPrivateJson, putPrivateJson, PreconditionFailed } from "./r2-private";

/** The whole store. Under bookings/ because that is the only feature it configures. */
const SETTINGS_KEY = "bookings/settings.json";

/** Retry delays for a refused conditional write, in ms. 4 attempts total. */
const RETRY_BACKOFF_MS = [50, 120, 300];

export class SettingsConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsConflictError";
  }
}

/**
 * What a stored document is actually known to contain, which is less than
 * `Settings` claims: every section is optional here because a document on R2
 * may have been written by an older deploy that had no mercadopago block, and
 * typing the read as `Settings` would be the cast that hides exactly that.
 *
 * `version` is absent on purpose — nothing below reads it. There is one schema,
 * and the merge is what makes an old document safe; the day there is a second,
 * this is where a real migration goes rather than a restamped number.
 */
type StoredSettings = {
  email?: Partial<EmailSettings>;
  transfer?: Partial<TransferSettings>;
  mercadopago?: { enabled?: boolean };
  updatedAt?: string;
};

/**
 * Fill in whatever the stored document is missing, section by section — see
 * constraint 4. `??` and not `||`, so a stored `false` or a deliberately
 * cleared "" survives instead of being helpfully replaced by a default that
 * happens to be the same falsy value in one direction and the opposite in the
 * other.
 *
 * Every object here is built fresh, which also means no caller can reach into
 * DEFAULT_SETTINGS and mutate the module's own constant through a returned
 * reference.
 */
function mergeSettings(stored: StoredSettings | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    // The current schema version, not the stored one: see StoredSettings.
    version: 1,
    email: {
      senderEmail: stored?.email?.senderEmail ?? d.email.senderEmail,
      senderName: stored?.email?.senderName ?? d.email.senderName,
      notifyEmail: stored?.email?.notifyEmail ?? d.email.notifyEmail,
    },
    transfer: {
      enabled: stored?.transfer?.enabled ?? d.transfer.enabled,
      alias: stored?.transfer?.alias ?? d.transfer.alias,
      cbu: stored?.transfer?.cbu ?? d.transfer.cbu,
      holder: stored?.transfer?.holder ?? d.transfer.holder,
      bank: stored?.transfer?.bank ?? d.transfer.bank,
    },
    mercadopago: {
      enabled: stored?.mercadopago?.enabled ?? d.mercadopago.enabled,
    },
    updatedAt: stored?.updatedAt ?? d.updatedAt,
  };
}

/* ────────────────────────── reads ────────────────────────── */

/**
 * The current settings, complete. A 404 is DEFAULT_SETTINGS and nothing else —
 * getPrivateJson() swallows only a genuine "never written" and rethrows a
 * credentials or connectivity failure, so "nothing configured yet" can never be
 * the story a broken bucket tells. That distinction matters more here than in
 * the sibling stores: the defaults say both payment methods are OFF, and a
 * bucket outage that read as "no settings" would quietly stop offering payment
 * on a booking page that is otherwise working perfectly.
 */
export async function loadSettings(): Promise<Settings> {
  const found = await getPrivateJson<StoredSettings>(SETTINGS_KEY);
  return mergeSettings(found?.data);
}

/**
 * The public half of the settings, for a caller that must not fail when the
 * settings read does. THE ONLY function in here that swallows an error, and it
 * is deliberate: every caller is on the booking path — the page that renders a
 * client's link, and the four routes that answer with a PublicBookingView —
 * where the settings are ONE FIELD of a response whose other twenty are a real
 * appointment the reader is entitled to see.
 *
 * Two of those callers make it more than a nicety. The submit and receipt
 * routes call this AFTER their compare-and-swap has committed, so a throw here
 * would turn a write that already landed into a 500, and the client would
 * retry an upload the booking already has.
 *
 * The fallback is DEFAULT_SETTINGS, which offers NEITHER method — the honest
 * answer to "we could not find out what the studio accepts", and the one that
 * cannot send a client to a checkout or a CBU we failed to read. The payment
 * step says so out loud rather than rendering empty; see PaymentUnavailable.
 *
 * Not a general-purpose wrapper around loadSettings(): the admin settings tab
 * and the MercadoPago preference route both need to know that a read FAILED —
 * one to refuse to draw a form over values it does not have, the other to
 * refuse to charge for a method it cannot confirm is on offer — so they call
 * loadSettings() and let it throw.
 */
export async function loadPublicPaymentSettings(): Promise<PublicPaymentSettings> {
  try {
    return toPublicPaymentSettings(await loadSettings());
  } catch (err) {
    console.error("settings: falling back to defaults, load failed", err);
    return toPublicPaymentSettings(DEFAULT_SETTINGS);
  }
}

/* ────────────────────────── writes ────────────────────────── */

/**
 * Conditional read-modify-write of the whole document.
 *
 * `apply` MUST be a pure function of the settings it is handed. It is re-run
 * from scratch on every retry against a freshly-read document, so it may not
 * close over a copy read earlier, mutate its argument, or depend on how many
 * times it has run — which is why timestamps are stamped by the LOOP below and
 * never by a mutator. Returning the SAME OBJECT REFERENCE means "no change" and
 * skips the write entirely; saveSettings() replaces wholesale and so never
 * takes that branch, but a future mutator that toggles one flag will want it,
 * and it is the contract the sibling stores are read against.
 *
 * After 4 refused attempts this throws SettingsConflictError; the route turns
 * that into a "someone else was editing" answer rather than a 500.
 */
async function mutateSettings(
  apply: (current: Settings) => Settings,
): Promise<Settings> {
  for (let attempt = 0; ; attempt++) {
    const found = await getPrivateJson<StoredSettings>(SETTINGS_KEY);
    // Merged, not raw: a mutator that carries a section forward must be handed
    // a complete one, or an old document would write its own gaps back.
    const current = mergeSettings(found?.data);

    const applied = apply(current);
    if (applied === current) return current;
    const next: Settings = { ...applied, updatedAt: new Date().toISOString() };

    try {
      await putPrivateJson(
        SETTINGS_KEY,
        next,
        found ? { ifMatch: found.etag } : { ifNoneMatch: "*" },
      );
      return next;
    } catch (err) {
      // Only a refused precondition is retryable; anything else is R2 being
      // down or misconfigured and retrying it just delays the error.
      if (!(err instanceof PreconditionFailed)) throw err;
      if (attempt >= RETRY_BACKOFF_MS.length) {
        throw new SettingsConflictError(
          `Settings were modified by someone else ${attempt + 1} times in a row.`,
        );
      }
      await sleep(jittered(RETRY_BACKOFF_MS[attempt]));
    }
  }
}

/**
 * Replace the document with what the settings form submitted, and return what
 * actually landed.
 *
 * `version` and `updatedAt` are not the caller's to send — the type says so.
 * The version is this module's, and `updatedAt` is stamped inside the CAS loop
 * on the attempt that COMMITS, so it records when the write happened rather
 * than when the request arrived or how many times it was retried.
 *
 * The mutator ignores `current` because this is a full replace: the form was
 * rendered from a complete document and submits every section, so honouring the
 * stored values would just re-apply what the admin was already looking at. It
 * closes over `next`, which is a constant for the life of the call, so re-running
 * it after a lost race yields the same document — the losing writer re-reads for
 * a fresh ETag and writes its own answer, exactly as intended.
 */
export async function saveSettings(
  next: Omit<Settings, "version" | "updatedAt">,
): Promise<Settings> {
  return mutateSettings((current) => ({
    version: current.version,
    email: next.email,
    transfer: next.transfer,
    mercadopago: next.mercadopago,
    // Carried forward so the mutator returns a complete Settings; the loop
    // overwrites it on the write that commits.
    updatedAt: current.updatedAt,
  }));
}

/* ────────────────────────── helpers ────────────────────────── */

// sleep() and jittered() are four lines each and live privately in
// bookings-store.ts and trips-store.ts too. Copied rather than exported from
// either: importing them would make this module depend on a whole record layer
// to borrow a setTimeout, and no copy has any reason to change.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jitter over [base/2, 1.5 x base) so two racing writers never retry in lockstep. */
function jittered(base: number): number {
  return Math.round(base * (0.5 + Math.random()));
}
