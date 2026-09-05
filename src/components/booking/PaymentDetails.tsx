"use client";
/**
 * Where to send the deposit: alias, CBU, holder, bank and the amount, each row
 * one tap away from the clipboard because the reader is about to retype it
 * into a banking app on the same phone.
 *
 * The whole block disappears when PAYMENT_ENABLED is false. That is the point
 * of the flag: an ALIAS row with nothing after it reads as a broken page,
 * while an absent block reads as "upload whatever receipt you already have",
 * which is exactly what the flow still supports.
 */
import { useEffect, useRef, useState } from "react";
import { PAYMENT_DETAILS, PAYMENT_ENABLED } from "@/config/payment";
import type { PaymentDetailsProps } from "./contract";

type Row = {
  key: string;
  label: string;
  value: string;
  /** Only the fields a bank app asks you to paste get a copy button. */
  copyable: boolean;
};

export function PaymentDetails({ view, dict }: PaymentDetailsProps) {
  const p = dict.booking.payment;
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!PAYMENT_ENABLED) return null;

  const rows: Row[] = [
    { key: "alias", label: p.alias, value: PAYMENT_DETAILS.alias, copyable: true },
    { key: "cbu", label: p.cbu, value: PAYMENT_DETAILS.cbu, copyable: true },
    { key: "holder", label: p.holder, value: PAYMENT_DETAILS.holder, copyable: false },
    { key: "bank", label: p.bank, value: PAYMENT_DETAILS.bank, copyable: false },
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
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {p.eyebrow}
      </p>
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
