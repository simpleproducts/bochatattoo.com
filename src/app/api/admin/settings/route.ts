/**
 * The studio settings document: read it, replace it.
 *
 * Two verbs and no PATCH, because src/lib/settings-store.ts stores ONE object
 * and saveSettings() replaces it wholesale. The form is rendered from a
 * complete document and submits a complete document, so a partial verb would
 * only invent a second way to write half of one.
 *
 * EVERYTHING IS VALIDATED HERE. The store deliberately validates nothing — its
 * header says so — and unlike a booking, nothing downstream ever re-checks
 * these values: a malformed sender address is handed straight to Brevo, and a
 * CBU with a letter in it is printed on a client's booking page for them to
 * copy into their banking app. Whatever gets past this file is what the studio
 * lives with until someone notices.
 *
 * Each failure answers its own CODE. One `bad-settings` for the lot would tell
 * the form nothing it could point at, and these are eight fields the operator
 * types by hand off a home-banking screen; "which one" is the entire question.
 *
 * NO SECRET IS READ OR WRITTEN HERE. `mercadoPagoConfigured()` answers whether
 * the access token exists, never what it is — see the header of
 * src/lib/settings-types.ts for why this document is the wrong place for a
 * live credential.
 *
 * The validators are spelled out rather than imported from a shared helper:
 * a Next route module may only export HTTP handlers, so there is nowhere the
 * sibling routes and this one could share them from without adding a library
 * file — the same trade ../trips/route.ts and ../bookings/route.ts already make.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { EMAIL_MAX, EMAIL_RE, NAME_MAX } from "@/lib/bookings-types";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { BookingsNotConfiguredError } from "@/lib/r2-private";
import {
  loadSettings,
  saveSettings,
  SettingsConflictError,
} from "@/lib/settings-store";
import {
  ALIAS_MAX,
  BANK_MAX,
  CBU_MAX,
  HOLDER_MAX,
  type EmailSettings,
  type TransferSettings,
} from "@/lib/settings-types";

export const runtime = "nodejs";

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
 * One catch for both handlers, mapping the same three failures the trips and
 * bookings routes do: missing env is a 503, a lost compare-and-swap race is a
 * 409 the form can simply retry, and anything else is R2 misbehaving. The
 * message rides along, which is safe here in a way it would not be on a public
 * route — this handler is behind assertAdminApi().
 */
function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof SettingsConflictError) return fail("conflict", 409, err.message);
  console.error(`settings: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

/* ────────────────────────── body validation ────────────────────────── */

type Read<T> = { ok: true; value: T } | { ok: false; response: Response };

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * A whole section of the document. Absent is NOT tolerated: this is a full
 * replace, so a body that omits `transfer` would erase the bank details rather
 * than leave them alone, and the request that did it would look successful.
 */
function readSection(
  raw: unknown,
  code: string,
  field: string,
): Read<Record<string, unknown>> {
  const section = readJsonObject(raw);
  if (!section) {
    return { ok: false, response: fail(code, 400, `\`${field}\` must be an object.`) };
  }
  return { ok: true, value: section };
}

/**
 * An address, or "". Empty is a legitimate value and means "fall back to the
 * env var" — settings-types.ts is emphatic about that — so it is the one input
 * here that must NOT be rejected for being blank.
 *
 * Stored lowercased, like every other address in this codebase: an operator
 * who types "Bocha@Studio.com" and an operator who types "bocha@studio.com"
 * must not end up with two different sender identities.
 */
function readEmail(raw: unknown, code: string, field: string): Read<string> {
  if (typeof raw !== "string") {
    return { ok: false, response: fail(code, 400, `\`${field}\` must be a string.`) };
  }
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: true, value: "" };
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    // The value is not echoed back: it is an arbitrary-length string off the
    // wire, and the form already knows which field it sent.
    return {
      ok: false,
      response: fail(code, 400, `\`${field}\` is not a valid email address.`),
    };
  }
  return { ok: true, value: email };
}

/**
 * A plain line of text under a cap, trimmed. Every one of these is printed,
 * never parsed, so the only question is whether it fits the space it is drawn
 * in — which is what the caps in settings-types.ts are for.
 */
function readText(raw: unknown, code: string, field: string, max: number): Read<string> {
  if (typeof raw !== "string") {
    return { ok: false, response: fail(code, 400, `\`${field}\` must be a string.`) };
  }
  const text = raw.trim();
  if (text.length > max) {
    return {
      ok: false,
      response: fail(code, 400, `\`${field}\` is longer than ${max} characters.`),
    };
  }
  return { ok: true, value: text };
}

/**
 * A CBU or CVU: digits, and nothing else.
 *
 * Separators are stripped rather than refused — a studio pastes "0170 0999
 * 2000 0000 0012 34" straight out of a banking app, and a route that answered
 * 400 to the number they were looking at would be arguing about punctuation.
 * What is STORED is bare digits, so the booking page can print it in one
 * shape and a client can copy it without cleaning it up first.
 *
 * A blank is allowed here: the transfer block below is what decides whether
 * the studio may offer a method with nowhere to send the money.
 */
function readCbu(raw: unknown): Read<string> {
  if (typeof raw !== "string") {
    return { ok: false, response: fail("bad-cbu", 400, "`cbu` must be a string.") };
  }
  const cbu = raw.replace(/[\s.-]/g, "");
  if (!cbu) return { ok: true, value: "" };
  if (!/^\d+$/.test(cbu)) {
    return { ok: false, response: fail("bad-cbu", 400, "A CBU is digits only.") };
  }
  if (cbu.length > CBU_MAX) {
    return {
      ok: false,
      response: fail("bad-cbu", 400, `A CBU cannot be longer than ${CBU_MAX} digits.`),
    };
  }
  return { ok: true, value: cbu };
}

function readBool(raw: unknown, code: string, field: string): Read<boolean> {
  if (typeof raw !== "boolean") {
    return { ok: false, response: fail(code, 400, `\`${field}\` must be a boolean.`) };
  }
  return { ok: true, value: raw };
}

/* ────────────────────────── handlers ────────────────────────── */

export async function GET(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  try {
    // An unwritten document is DEFAULT_SETTINGS, not a 404: a studio that has
    // never opened this tab is in a normal state, not a broken one.
    return ok({ ok: true, settings: await loadSettings() });
  } catch (err) {
    return storeFailure(err, "GET /api/admin/settings");
  }
}

export async function PUT(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  const emailSection = readSection(body.email, "bad-email-section", "email");
  if (!emailSection.ok) return emailSection.response;

  const senderEmail = readEmail(
    emailSection.value.senderEmail,
    "bad-sender-email",
    "email.senderEmail",
  );
  if (!senderEmail.ok) return senderEmail.response;

  const senderName = readText(
    emailSection.value.senderName,
    "bad-sender-name",
    "email.senderName",
    NAME_MAX,
  );
  if (!senderName.ok) return senderName.response;

  const notifyEmail = readEmail(
    emailSection.value.notifyEmail,
    "bad-notify-email",
    "email.notifyEmail",
  );
  if (!notifyEmail.ok) return notifyEmail.response;

  const transferSection = readSection(body.transfer, "bad-transfer-section", "transfer");
  if (!transferSection.ok) return transferSection.response;

  const alias = readText(
    transferSection.value.alias,
    "bad-alias",
    "transfer.alias",
    ALIAS_MAX,
  );
  if (!alias.ok) return alias.response;

  const cbu = readCbu(transferSection.value.cbu);
  if (!cbu.ok) return cbu.response;

  const holder = readText(
    transferSection.value.holder,
    "bad-holder",
    "transfer.holder",
    HOLDER_MAX,
  );
  if (!holder.ok) return holder.response;

  const bank = readText(
    transferSection.value.bank,
    "bad-bank",
    "transfer.bank",
    BANK_MAX,
  );
  if (!bank.ok) return bank.response;

  const transferEnabled = readBool(
    transferSection.value.enabled,
    "bad-transfer-enabled",
    "transfer.enabled",
  );
  if (!transferEnabled.ok) return transferEnabled.response;

  /*
   * Offering a transfer with no alias and no CBU sends the client to a payment
   * step that names no destination — they cannot pay, cannot upload a receipt
   * for a payment they could not make, and the booking sits amber forever. The
   * holder and the bank are not enough on their own: they identify an account,
   * they are not an address money can be sent to.
   */
  if (transferEnabled.value && !alias.value && !cbu.value) {
    return fail(
      "transfer-unusable",
      400,
      "Bank transfer needs an alias or a CBU before it can be offered.",
    );
  }

  const mpSection = readSection(body.mercadopago, "bad-mercadopago-section", "mercadopago");
  if (!mpSection.ok) return mpSection.response;

  const mpEnabled = readBool(
    mpSection.value.enabled,
    "bad-mercadopago-enabled",
    "mercadopago.enabled",
  );
  if (!mpEnabled.ok) return mpEnabled.response;

  /*
   * The same refusal, for the same reason, one layer down: with no access
   * token the server cannot create a preference, so a client who picks
   * MercadoPago is stranded at the payment step with no way forward and no
   * second method to fall back to. The settings form disables this toggle
   * when the token is absent, so in practice this only catches a stale tab or
   * a hand-rolled request — which is exactly when it matters.
   */
  if (mpEnabled.value && !mercadoPagoConfigured()) {
    return fail(
      "mercadopago-not-configured",
      400,
      "MercadoPago cannot be offered until MP_ACCESS_TOKEN is set on the server.",
    );
  }

  const email: EmailSettings = {
    senderEmail: senderEmail.value,
    senderName: senderName.value,
    notifyEmail: notifyEmail.value,
  };
  const transfer: TransferSettings = {
    enabled: transferEnabled.value,
    alias: alias.value,
    cbu: cbu.value,
    holder: holder.value,
    bank: bank.value,
  };

  try {
    // `version` and `updatedAt` are the store's to stamp, which is why the
    // argument type does not have them: see saveSettings().
    const settings = await saveSettings({
      email,
      transfer,
      mercadopago: { enabled: mpEnabled.value },
    });
    return ok({ ok: true, settings });
  } catch (err) {
    return storeFailure(err, "PUT /api/admin/settings");
  }
}
