"use client";
/**
 * The transfer receipt a client uploaded, shown inline in the booking sheet.
 *
 * The bytes come from /api/admin/bookings/<id>/receipt, which streams the
 * private-bucket object behind the admin cookie. Two rules shape this file:
 *
 *  1. Images render in an <img>, PDFs render as a link. NEVER <iframe> or
 *     <object>: the site already sends X-Frame-Options: DENY,
 *     frame-ancestors 'none' and object-src 'none', so an embed would paint a
 *     silent blank rectangle indistinguishable from a missing receipt.
 *  2. This is the one raw <img> in the project. Every other image goes through
 *     RemoteImage, which needs a manifest slug, dimensions and a public R2
 *     URL; a receipt has none of those. It is a cookie-gated, no-store,
 *     same-origin stream of unknown size, which the CSP's img-src 'self'
 *     already allows.
 *
 * Deleting is a real state change (green falls back to yellow and the client
 * can upload again), so it sits behind a native confirm().
 */
import { LocalTime } from "@/components/LocalTime";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import type { ReceiptPreviewProps } from "./contract";

/**
 * `dict` and `locale` arrive from the sheet, which got them from the page's
 * server render. Both are needed and neither implies the other: the strings
 * come out of `dict`, while `LocalTime` needs the locale itself to build its
 * `Intl` formatter.
 */
type Props = ReceiptPreviewProps & {
  dict: AdminDictionary;
  locale: Locale;
};

/** Receipts are phone photos and bank PDFs — KB under a megabyte, MB over. */
function formatBytes(bytes: number, dict: AdminDictionary): string {
  return bytes < 1_000_000
    ? dict.common.kilobytes.replace(
        "{size}",
        String(Math.max(1, Math.round(bytes / 1000))),
      )
    : dict.common.megabytes.replace("{size}", (bytes / 1_000_000).toFixed(1));
}

export function ReceiptPreview({ appt, busy, onDelete, dict, locale }: Props) {
  const receipt = appt.receipt;

  if (!receipt) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {dict.calendar.receipt.title}
        </h3>
        <p className="text-sm text-muted">{dict.calendar.receipt.empty}</p>
      </section>
    );
  }

  const href = `/api/admin/bookings/${appt.id}/receipt`;
  const isPdf = receipt.contentType === "application/pdf";

  function confirmDelete() {
    // The status this drops back to is named in the prose, so it is read from
    // the same table the badge reads rather than spelled out a second time.
    const ok = window.confirm(
      dict.calendar.receipt.deleteConfirm.replace(
        "{status}",
        dict.calendar.status.awaitingReceipt,
      ),
    );
    if (ok) onDelete();
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {dict.calendar.receipt.title}
      </h3>

      {isPdf ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line p-4 flex items-center gap-3 hover:border-fg transition-colors"
        >
          <span className="font-mono text-xs tracking-[0.2em] text-muted" aria-hidden>
            {dict.calendar.receipt.pdf}
          </span>
          <span className="text-sm underline underline-offset-4 break-all">
            {receipt.filename}
          </span>
        </a>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-line hover:border-fg transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see the file header: a private cookie-gated stream has no slug and no known dimensions. */}
          <img
            src={href}
            alt={dict.calendar.receipt.imageAlt.replace(
              "{filename}",
              receipt.filename,
            )}
            loading="lazy"
            className="w-full max-h-64 object-contain bg-fg/5"
          />
        </a>
      )}

      <p className="font-mono text-[10px] text-muted break-all">
        {receipt.filename} · {formatBytes(receipt.bytes, dict)} ·{" "}
        <LocalTime start={receipt.uploadedAt} locale={locale} showDate />
      </p>

      <div>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={busy}
          className="text-[10px] uppercase tracking-[0.2em] font-mono text-red-400 hover:underline disabled:opacity-40 cursor-pointer"
        >
          {dict.calendar.receipt.delete}
        </button>
      </div>
    </section>
  );
}
