"use client";
/**
 * The settings screen: everything the studio can change without a deploy.
 *
 * Three sections — email, bank transfer, MercadoPago — and ONE save, because
 * bookings/settings.json is one object and saveSettings() replaces it whole. A
 * save button per section would each claim to write its own block while
 * actually writing all three, and the day two tabs are open that lie costs a
 * CBU: the stale tab's "save email" would carry its stale bank details along
 * with it. One form, one PUT, one line saying what happened.
 *
 * The draft is seeded from `initial` ONCE, in a lazy initialiser. Not an
 * effect: this repo lints setState-inside-useEffect as an error, and an effect
 * would also let a parent re-render overwrite half-typed input with the
 * document as it was when the page was served.
 *
 * WHAT THIS COMPONENT NEVER RECEIVES is a secret. `mercadoPagoReady` is a
 * boolean the server derived from the access token's presence; the token
 * itself stays in the hosting environment and never enters a payload that a
 * browser — or this file — can read.
 *
 * The two "offer this method" toggles are DERIVED as much as they are stored.
 * A method that cannot work must not be offerable, because the cost is not a
 * broken settings screen, it is a client sitting on the payment step of their
 * own booking with no way forward: MercadoPago with no token cannot create a
 * preference, and a transfer with neither alias nor CBU names no destination.
 * So each toggle is disabled when its method is unusable, and each submits
 * `false` in that state rather than the value it happens to remember — which
 * also means saving the email section can never be blocked by a MercadoPago
 * token that disappeared out from under a document that said "enabled".
 */
import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { EMAIL_MAX, EMAIL_RE, NAME_MAX } from "@/lib/bookings-types";
import {
  ALIAS_MAX,
  BANK_MAX,
  CBU_MAX,
  HOLDER_MAX,
  type Settings,
} from "@/lib/settings-types";
import { readError } from "./read-error";

/** The document minus the two fields the store owns and a form may not send. */
type Draft = Omit<Settings, "version" | "updatedAt">;

/**
 * A CBU and a CVU are both exactly 22 digits — always, which is why
 * `dict.settings.errors.invalidCbu` can name the number.
 *
 * Stricter than the route, deliberately. CBU_MAX is a storage ceiling with
 * slack in it; this is the form telling an operator mid-paste that what they
 * have is not a whole account number yet, which is the difference between
 * catching a truncated copy here and printing it on a client's booking page.
 */
const CBU_DIGITS = 22;

const INPUT =
  "bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-fg";
const LABEL = "font-mono uppercase tracking-[0.2em] text-muted";
const SECTION = "flex flex-col gap-4 border border-line p-4";
const LEGEND = "px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
const HINT = "font-mono text-[10px] text-muted";
const ERROR = "font-mono text-[10px] uppercase tracking-[0.2em] text-red-400";

/** The booking form's field idiom, verbatim, so the two screens read as one. */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className={LABEL}>{label}</span>
      {children}
      {hint}
    </label>
  );
}

/** "" is a legitimate value everywhere it appears here — it means "fall back". */
function emailInvalid(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.length > 0 && (email.length > EMAIL_MAX || !EMAIL_RE.test(email));
}

function toDraft(s: Settings): Draft {
  // Copied field by field rather than spread, so the draft can never share a
  // nested object with the prop and mutate what the page was rendered from.
  return {
    email: {
      senderEmail: s.email.senderEmail,
      senderName: s.email.senderName,
      notifyEmail: s.email.notifyEmail,
    },
    transfer: {
      enabled: s.transfer.enabled,
      alias: s.transfer.alias,
      cbu: s.transfer.cbu,
      holder: s.transfer.holder,
      bank: s.transfer.bank,
    },
    mercadopago: { enabled: s.mercadopago.enabled },
  };
}

/**
 * `idle` before anything is sent and again after any edit — a "Saved ✓" left
 * standing beside changed fields claims a write that did not happen.
 */
type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "failed"; detail: string };

export function AdminSettings({
  initial,
  mercadoPagoReady,
  dict,
}: {
  initial: Settings;
  /** Whether MP_ACCESS_TOKEN exists on the server. Never the token itself. */
  mercadoPagoReady: boolean;
  dict: AdminDictionary;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const senderEmailErrorId = useId();
  const notifyEmailErrorId = useId();
  const cbuErrorId = useId();

  const t = dict.settings;

  /**
   * Every edit goes through one of these three, and all of them drop the
   * status back to idle on the way. One updater per section rather than a
   * generic deep patch: two levels is not enough depth to be worth a helper
   * that no longer says which field it is changing.
   */
  function patchEmail(p: Partial<Draft["email"]>) {
    setStatus({ kind: "idle" });
    setDraft((d) => ({ ...d, email: { ...d.email, ...p } }));
  }

  function patchTransfer(p: Partial<Draft["transfer"]>) {
    setStatus({ kind: "idle" });
    setDraft((d) => {
      const transfer = { ...d.transfer, ...p };
      // Clearing the last destination turns the offer off in the same
      // keystroke. Left on, the checkbox would sit there checked while the
      // method it names had nowhere to send money — and the route would refuse
      // the save with `transfer-unusable` for a reason the screen never showed.
      if (!transfer.alias.trim() && !transfer.cbu) transfer.enabled = false;
      return { ...d, transfer };
    });
  }

  function patchMercadoPago(enabled: boolean) {
    setStatus({ kind: "idle" });
    setDraft((d) => ({ ...d, mercadopago: { enabled } }));
  }

  const senderEmailBad = emailInvalid(draft.email.senderEmail);
  const notifyEmailBad = emailInvalid(draft.email.notifyEmail);
  const cbuBad = draft.transfer.cbu.length > 0 && draft.transfer.cbu.length !== CBU_DIGITS;

  /** An alias OR a CBU. Holder and bank identify an account; they are not one. */
  const transferUsable =
    draft.transfer.alias.trim().length > 0 || draft.transfer.cbu.length > 0;

  // What the toggles SHOW and what the PUT SENDS — the same expression for
  // both, so the screen can never promise a method the document will not carry.
  const transferOn = draft.transfer.enabled && transferUsable;
  const mercadoPagoOn = draft.mercadopago.enabled && mercadoPagoReady;

  const blocked = senderEmailBad || notifyEmailBad || cbuBad;
  const saving = status.kind === "saving";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || blocked) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          transfer: { ...draft.transfer, enabled: transferOn },
          mercadopago: { enabled: mercadoPagoOn },
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { settings?: Settings };
      // Seeded from the ANSWER, not from what was sent: the route lowercases
      // addresses and strips a pasted CBU's spaces, and the operator should be
      // looking at what is actually stored rather than at what they typed.
      if (data.settings) setDraft(toDraft(data.settings));
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "failed", detail: (err as Error).message });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl" noValidate>
      {/* The page heading is `settings.title` and not `nav.settings`: the tab
          has room for one word, this line has room to say a little more. */}
      <h1 className="font-serif italic text-2xl md:text-3xl">{t.title}</h1>

      {/* ── Email ───────────────────────────────────────────────────── */}
      <fieldset className={SECTION}>
        <legend className={LEGEND}>{t.sections.email}</legend>

        <Field
          label={t.fields.senderEmail}
          hint={
            senderEmailBad ? (
              <span id={senderEmailErrorId} className={ERROR}>
                {t.errors.invalidEmail}
              </span>
            ) : null
          }
        >
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            value={draft.email.senderEmail}
            onChange={(e) => patchEmail({ senderEmail: e.target.value })}
            aria-invalid={senderEmailBad}
            aria-describedby={senderEmailBad ? senderEmailErrorId : undefined}
            className={INPUT}
          />
        </Field>

        <Field label={t.fields.senderName}>
          <input
            type="text"
            maxLength={NAME_MAX}
            value={draft.email.senderName}
            onChange={(e) => patchEmail({ senderName: e.target.value })}
            className={INPUT}
          />
        </Field>

        <Field
          label={t.fields.notifyEmail}
          hint={
            notifyEmailBad ? (
              <span id={notifyEmailErrorId} className={ERROR}>
                {t.errors.invalidEmail}
              </span>
            ) : null
          }
        >
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            value={draft.email.notifyEmail}
            onChange={(e) => patchEmail({ notifyEmail: e.target.value })}
            aria-invalid={notifyEmailBad}
            aria-describedby={notifyEmailBad ? notifyEmailErrorId : undefined}
            className={INPUT}
          />
        </Field>

        {/* Under all three, because it is about the blank field and not about
            any one of them: empty here is a value, not an omission. */}
        <p className={HINT}>{t.hints.email}</p>
      </fieldset>

      {/* ── Bank transfer ───────────────────────────────────────────── */}
      <fieldset className={SECTION}>
        <legend className={LEGEND}>{t.sections.transfer}</legend>

        <Field label={t.fields.alias}>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={ALIAS_MAX}
            value={draft.transfer.alias}
            onChange={(e) => patchTransfer({ alias: e.target.value })}
            className={INPUT}
          />
        </Field>

        <Field
          label={t.fields.cbu}
          hint={
            cbuBad ? (
              <span id={cbuErrorId} className={ERROR}>
                {t.errors.invalidCbu}
              </span>
            ) : null
          }
        >
          {/* Non-digits are dropped as they arrive rather than rejected after
              the fact, so pasting "0170 0999 2000 0000 0012 34" out of a
              banking app just works — the same way the booking form eats a
              leading @ off an Instagram handle. */}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={CBU_MAX}
            value={draft.transfer.cbu}
            onChange={(e) => patchTransfer({ cbu: e.target.value.replace(/\D/g, "") })}
            aria-invalid={cbuBad}
            aria-describedby={cbuBad ? cbuErrorId : undefined}
            className={INPUT}
          />
        </Field>

        <Field label={t.fields.holder}>
          <input
            type="text"
            maxLength={HOLDER_MAX}
            value={draft.transfer.holder}
            onChange={(e) => patchTransfer({ holder: e.target.value })}
            className={INPUT}
          />
        </Field>

        <Field label={t.fields.bank}>
          <input
            type="text"
            maxLength={BANK_MAX}
            value={draft.transfer.bank}
            onChange={(e) => patchTransfer({ bank: e.target.value })}
            className={INPUT}
          />
        </Field>

        {/* Last in the section, under the numbers it depends on: the switch
            only becomes usable once one of them is filled in. */}
        <label
          className={`flex items-center gap-2 text-xs ${
            transferUsable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}
        >
          <input
            type="checkbox"
            checked={transferOn}
            disabled={!transferUsable}
            onChange={(e) => patchTransfer({ enabled: e.target.checked })}
            className={transferUsable ? "cursor-pointer" : "cursor-not-allowed"}
          />
          <span className={LABEL}>{t.toggles.transfer}</span>
        </label>
      </fieldset>

      {/* ── MercadoPago ─────────────────────────────────────────────── */}
      <fieldset className={SECTION}>
        <legend className={LEGEND}>{t.sections.mercadopago}</legend>

        <label
          className={`flex items-center gap-2 text-xs ${
            mercadoPagoReady ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}
        >
          <input
            type="checkbox"
            checked={mercadoPagoOn}
            disabled={!mercadoPagoReady}
            onChange={(e) => patchMercadoPago(e.target.checked)}
            className={mercadoPagoReady ? "cursor-pointer" : "cursor-not-allowed"}
          />
          <span className={LABEL}>{t.toggles.mercadopago}</span>
        </label>

        {/*
          Always shown, because it is the only place this screen says where the
          token lives — and it carries the whole weight of the answer when the
          token is missing, in the amber the calendar reserves for "this needs
          your attention", beside a switch that cannot be moved. Nothing here
          can set the token: the disabled toggle plus this sentence is the
          screen telling the operator to go to the hosting environment.
        */}
        <p
          className={
            mercadoPagoReady ? HINT : "font-mono text-[10px] text-status-partial"
          }
        >
          {t.hints.mercadopago}
        </p>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || blocked}
          className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
        >
          {saving ? dict.common.saving : dict.common.save}
        </button>

        {/* One line, beside the button that produced it. The failure prints the
            route's own message under the headline: the codes it answers with
            name a field, and swallowing that leaves "could not be saved" as
            the only clue on a form with eight of them. */}
        {status.kind === "saved" ? (
          <p role="status" className="font-mono text-[10px] text-status-done">
            {t.saved}
          </p>
        ) : null}
        {status.kind === "failed" ? (
          <p role="alert" className="font-mono text-[10px] text-red-400 break-words">
            {t.saveFailed} <span className="text-muted">{status.detail}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
