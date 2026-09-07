"use client";
/**
 * The four faces of step three, all presentational, all fed from props.
 *
 *   PaymentMethodChooser  — both methods on offer, so there is a choice
 *   MercadoPagoPanel      — the tap that leaves for Checkout Pro
 *   MercadoPagoPending    — back from Checkout Pro, webhook not in yet
 *   PaymentUnavailable    — nothing on offer, said out loud
 *   PaymentDetails        — where to send a transfer, one tap per field
 *
 * They live in one file because they are one step: a reader sees exactly one
 * of the first four at a time, and the choice between them belongs to
 * BookingFlow, which owns the settings, the requests and the step machine.
 * Nothing here fetches, and nothing here decides — that split is why none of
 * these takes the view's `paid` flag or the token.
 *
 * WHERE THE BANK DETAILS COME FROM CHANGED. They used to be typed into a
 * src/config/payment.ts that shipped with the deploy — now deleted, because a
 * file still announcing itself as the place to enter a CBU would send the next
 * operator to edit values nothing reads. They are now
 * `view.paymentSettings.transfer`, the studio's own settings document narrowed
 * for the wire, edited from the settings tab with no redeploy. The rule they are rendered under did not change: alias and CBU
 * are the destination, and with neither of them filled in the block would be
 * an ALIAS row with nothing after it, which reads as a broken page. So it
 * renders nothing at all and the reader simply uploads whatever receipt they
 * already have — a flow that still completes end to end.
 */
import { useEffect, useRef, useState } from "react";
import type {
  MercadoPagoPanelProps,
  MercadoPagoPendingProps,
  PaymentDetailsProps,
  PaymentMethodChooserProps,
  PaymentUnavailableProps,
} from "./contract";

/** The one CTA shape this flow uses, shared with the details form's Continue. */
const CTA =
  "w-full min-h-[44px] border border-fg px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer";

const EYEBROW = "font-mono text-xs uppercase tracking-[0.2em] text-muted";

/** A secondary, text-only control at the flow's usual 44px tap height. */
const QUIET =
  "self-start min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer disabled:opacity-40";

type Row = {
  key: string;
  label: string;
  value: string;
  /** Only the fields a bank app asks you to paste get a copy button. */
  copyable: boolean;
};

/**
 * Which way to pay. Rendered only when the studio offers both — a list of one
 * is not a choice, and the flow renders that one method directly instead.
 *
 * Each option carries its hint because the brand names alone do not say what
 * the reader is actually choosing between: one finishes the booking on the
 * spot, the other still owes us a comprobante afterwards. `methods` arrives in
 * paint order (MercadoPago first) rather than being sorted here, so the order
 * stays one decision made in one place.
 */
export function PaymentMethodChooser({
  dict,
  methods,
  onChoose,
}: PaymentMethodChooserProps) {
  const p = dict.booking.payment;

  return (
    <section className="flex flex-col gap-3">
      <p className={EYEBROW}>{p.chooseTitle}</p>
      <ul className="flex flex-col gap-3">
        {methods.map((method) => {
          const m = p.methods[method];
          return (
            <li key={method}>
              <button
                type="button"
                onClick={() => onChoose(method)}
                className="w-full border border-line p-4 flex flex-col gap-1 text-left hover:border-fg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs uppercase tracking-[0.2em]">
                  {m.label}
                </span>
                <span className="text-sm leading-relaxed text-fg/80">
                  {m.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The MercadoPago tap.
 *
 * `redirect` is above the button rather than under it because it is a warning
 * about what the button does: the tab is about to change domain, and a reader
 * who was not told that reads the jump as having lost their booking.
 *
 * The busy label is the details form's `sending`. It is a generic "this is in
 * flight" string and this is generically that: the request creating the
 * preference is the only thing between the tap and the redirect, and it has
 * nothing more specific to say. The disabled state matters more than the word
 * — two taps are two preferences for one deposit.
 */
export function MercadoPagoPanel({
  dict,
  busy,
  error,
  onPay,
}: MercadoPagoPanelProps) {
  const p = dict.booking.payment;

  return (
    <section className="flex flex-col gap-3">
      <p className={EYEBROW}>{p.methods.mercadopago.label}</p>
      <p className="text-sm leading-relaxed text-fg/80">{p.mercadopago.redirect}</p>
      <button type="button" onClick={onPay} disabled={busy} className={CTA}>
        {busy ? dict.booking.form.sending : p.mercadopago.cta}
      </button>
      {error ? (
        <p role="status" aria-live="polite" className="text-red-400 text-xs">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Back from Checkout Pro, with the deposit not yet on the record.
 *
 * This is the honest state and not an error: the return URL is a link the
 * client controls, so it never marks anything paid, and MercadoPago's webhook
 * — which does — can land a second or two after the browser does. The reader
 * is told we are waiting and handed a way to look again, rather than being
 * dropped back on a payment step that acts as though they never left.
 *
 * The re-check reuses the receipt step's `retry`, and says `verifying` while it
 * runs: both are the same act in the reader's language — ask again, wait a
 * beat — and this panel is a place to be truthful, not to invent vocabulary.
 * The paragraph is the live region, so a screen reader hears the swap.
 */
export function MercadoPagoPending({
  dict,
  busy,
  error,
  onRecheck,
}: MercadoPagoPendingProps) {
  const p = dict.booking.payment;

  return (
    <section className="border border-status-partial p-4 flex flex-col gap-2">
      <p className={EYEBROW}>{p.methods.mercadopago.label}</p>
      <p role="status" aria-live="polite" className="text-sm leading-relaxed text-fg/80">
        {busy ? dict.booking.receipt.verifying : p.mercadopago.pending}
      </p>
      <button
        type="button"
        onClick={onRecheck}
        disabled={busy}
        className={QUIET}
      >
        {dict.booking.receipt.retry}
      </button>
      {error ? (
        <p role="status" aria-live="polite" className="text-red-400 text-xs">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Neither method is on offer — an unconfigured studio, or a settings read that
 * failed and fell back to the defaults, which offer nothing.
 *
 * A step with no controls and no words is the one outcome this must never be.
 * `paymentFailed` is the sentence: nothing was charged, nothing is owed right
 * now, and the reader should come back in a moment. The eyebrow is the rail's
 * own word for the step, because there is no transfer here to head.
 */
export function PaymentUnavailable({ dict }: PaymentUnavailableProps) {
  return (
    <section className="border border-line p-4 flex flex-col gap-2">
      <p className={EYEBROW}>{dict.booking.rail.payment}</p>
      <p role="status" className="text-sm leading-relaxed text-fg/80">
        {dict.booking.errors.paymentFailed}
      </p>
    </section>
  );
}

/**
 * Where to send the deposit: alias, CBU, holder, bank and the amount, each row
 * one tap away from the clipboard because the reader is about to retype it
 * into a banking app on the same phone.
 */
export function PaymentDetails({ view, dict }: PaymentDetailsProps) {
  const p = dict.booking.payment;
  const t = view.paymentSettings.transfer;
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Holder and bank alone are not somewhere money can be sent. See the header.
  if (!t.alias && !t.cbu) return null;

  const rows: Row[] = [
    { key: "alias", label: p.alias, value: t.alias, copyable: true },
    { key: "cbu", label: p.cbu, value: t.cbu, copyable: true },
    { key: "holder", label: p.holder, value: t.holder, copyable: false },
    { key: "bank", label: p.bank, value: t.bank, copyable: false },
    {
      key: "amount",
      label: p.amount,
      value: view.deposit
        ? `${view.deposit.currency} ${formatAmount(view.deposit.amount)}`
        : "",
      copyable: false,
    },
  ].filter((r) => r.value !== "");

  async function copy(row: Row) {
    await copyText(row.value);
    setCopied(row.key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="flex flex-col gap-3">
      <p className={EYEBROW}>{p.eyebrow}</p>
      <p className="text-sm leading-relaxed text-fg/80">{p.intro}</p>

      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between gap-3 py-1 border-b border-line"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted shrink-0">
              {row.label}
            </span>
            <span className="font-mono text-sm break-all text-right flex-1">
              {row.value}
            </span>
            {row.copyable ? (
              <button
                type="button"
                onClick={() => void copy(row)}
                aria-label={`${p.copy} ${row.label}`}
                className="shrink-0 min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
              >
                <span aria-live="polite">
                  {copied === row.key ? p.copied : p.copy}
                </span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Argentine grouping in both languages on purpose: the number exists to be
 * matched against a Spanish-language banking app, so switching separators for
 * an English reader would only make the two screens disagree.
 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
    amount,
  );
}

/** Clipboard API first; the textarea dance covers iOS in a non-secure context. */
async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Falls through to the legacy path below.
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // Nothing left to try; the value is on screen and selectable by hand.
  }
  ta.remove();
}
