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
import type { ReceiptPreviewProps } from "./contract";

/** Receipts are phone photos and bank PDFs — KB under a megabyte, MB over. */
function formatBytes(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function ReceiptPreview({ appt, busy, onDelete }: ReceiptPreviewProps) {
  const receipt = appt.receipt;

  if (!receipt) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Receipt
        </h3>
        <p className="text-sm text-muted">Nothing uploaded yet.</p>
      </section>
    );
  }

  const href = `/api/admin/bookings/${appt.id}/receipt`;
  const isPdf = receipt.contentType === "application/pdf";

  function confirmDelete() {
    const ok = window.confirm(
      "Delete this receipt?\n\nThe file is erased from storage and the booking drops back to AWAITING RECEIPT, so the client can upload another one.",
    );
    if (ok) onDelete();
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Receipt
      </h3>

      {isPdf ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line p-4 flex items-center gap-3 hover:border-fg transition-colors"
        >
          <span className="font-mono text-xs tracking-[0.2em] text-muted" aria-hidden>
            PDF
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
            alt={`Transfer receipt: ${receipt.filename}`}
            loading="lazy"
            className="w-full max-h-64 object-contain bg-fg/5"
          />
        </a>
      )}

      <p className="font-mono text-[10px] text-muted break-all">
        {receipt.filename} · {formatBytes(receipt.bytes)} ·{" "}
        <LocalTime start={receipt.uploadedAt} locale="en" showDate />
      </p>

      <div>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={busy}
          className="text-[10px] uppercase tracking-[0.2em] font-mono text-red-400 hover:underline disabled:opacity-40 cursor-pointer"
        >
          Delete receipt
        </button>
      </div>
    </section>
  );
}
