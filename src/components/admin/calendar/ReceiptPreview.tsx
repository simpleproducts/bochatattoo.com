"use client";
/**
 * The transfer receipt, shown inline in the booking sheet — and, since the
 * studio can attach one itself, the control that puts it there.
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
 * UPLOADING happens because clients send proof by WhatsApp at least as often as
 * they use their own link, and a comprobante sitting in a chat is one the
 * booking does not have. The two states are different controls on purpose: with
 * no receipt the drop zone IS the empty state, because there is nothing to
 * protect and the fastest path is dropping the screenshot straight onto it;
 * with a receipt already on file, attaching another destroys the old blob, so
 * it is a button behind the confirmation dialog rather than something a stray
 * drop can do.
 *
 * Both size limits are the client uploader's, and for its reasons: a phone
 * photo is downscaled in the browser first (which is also what strips its GPS
 * EXIF), and only what survives that is measured against the proxy's ceiling.
 * The file's declared TYPE is checked nowhere here — `accept` is a hint to the
 * picker and nothing more. The server sniffs the magic bytes and its answer is
 * the only one that decides.
 *
 * Deleting is a real state change (green falls back to yellow and the client
 * can upload again), so it too sits behind a confirmation dialog.
 */
import { useRef, useState } from "react";
import { LocalTime } from "@/components/LocalTime";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { downscaleImage } from "@/components/booking/downscale";
import {
  RECEIPT_ACCEPT,
  RECEIPT_CLIENT_MAX_BYTES,
  RECEIPT_MAX_BYTES,
} from "@/lib/bookings-types";
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

/**
 * The proxy ceiling as `{max}` in `uploader.tooLarge`. Divided by 1024² rather
 * than a million because RECEIPT_MAX_BYTES is 4 MiB: the megabyte the copy
 * claims is the binary one, and the honest decimal figure (4.194) would be a
 * worse sentence, not a truer one. Same call AdminUploader makes.
 */
const MAX_MB = RECEIPT_MAX_BYTES / (1024 * 1024);

/** Receipts are phone photos and bank PDFs — KB under a megabyte, MB over. */
function formatBytes(bytes: number, dict: AdminDictionary): string {
  return bytes < 1_000_000
    ? dict.common.kilobytes.replace(
        "{size}",
        String(Math.max(1, Math.round(bytes / 1000))),
      )
    : dict.common.megabytes.replace("{size}", (bytes / 1_000_000).toFixed(1));
}

export function ReceiptPreview({
  appt,
  busy,
  onUpload,
  onDelete,
  dict,
  locale,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  /** The `uploader.tooLarge` fragment, or null. Local refusals only. */
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Adjust-state-during-render, the pattern AdminCalendar already uses for its
  // served months — not an effect, which is an eslint error in this repo. The
  // handler prop returns void, so `busy` going false is how this component
  // learns the calendar's write finished; without the reset the label would
  // claim an upload was still running forever.
  const [busyMark, setBusyMark] = useState(busy);
  if (busyMark !== busy) {
    setBusyMark(busy);
    if (!busy) setSending(false);
  }

  const receipt = appt.receipt;
  const disabled = busy || sending;

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setTooLarge(null);

    // Too big to be worth decoding at all — refused before the canvas work.
    if (file.size > RECEIPT_CLIENT_MAX_BYTES) {
      setTooLarge(sizeMessage(file.size));
      return;
    }

    // Never throws and never rejects: a PDF, or anything this browser cannot
    // decode, comes back untouched and the server decides. See downscale.ts.
    const prepared = await downscaleImage(file);
    if (prepared.size > RECEIPT_MAX_BYTES) {
      setTooLarge(sizeMessage(prepared.size));
      return;
    }

    setSending(true);
    onUpload(prepared);
  }

  function sizeMessage(size: number): string {
    return dict.uploader.tooLarge
      .replace("{size}", (size / 1_000_000).toFixed(1))
      .replace("{max}", String(MAX_MB));
  }

  function pickFile() {
    if (disabled) return;
    inputRef.current?.click();
  }

  const uploadLabel = sending
    ? dict.calendar.receipt.uploading
    : dict.calendar.receipt.upload;

  // The status this drops back to is named in the prose, so it is read from the
  // same table the badge reads rather than spelled out a second time.
  const confirmBody = dict.calendar.receipt.deleteConfirm.replace(
    "{status}",
    dict.calendar.status.awaitingReceipt,
  );

  const href = `/api/admin/bookings/${appt.id}/receipt`;
  const isPdf = receipt?.contentType === "application/pdf";

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {dict.calendar.receipt.title}
      </h3>

      {receipt ? (
        <>
          {isPdf ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-line p-4 flex items-center gap-3 hover:border-fg transition-colors"
            >
              <span
                className="font-mono text-xs tracking-[0.2em] text-muted"
                aria-hidden
              >
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

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setReplacing(true)}
              disabled={disabled}
              className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg hover:underline disabled:opacity-40 cursor-pointer"
            >
              {uploadLabel}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={disabled}
              className="text-[10px] uppercase tracking-[0.2em] font-mono text-red-400 hover:underline disabled:opacity-40 cursor-pointer"
            >
              {dict.calendar.receipt.delete}
            </button>
          </div>
        </>
      ) : (
        /* The drop zone in place of the empty state — the AdminUploader idiom,
           minus the multi-file list a booking has no room for. */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={pickFile}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pickFile();
            }
          }}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (disabled) return;
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={[
            "border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors",
            disabled
              ? "border-line opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:border-fg hover:bg-fg/5",
            dragOver ? "border-fg bg-fg/10" : "border-line",
          ].join(" ")}
        >
          <span className="text-2xl leading-none" aria-hidden>
            ↑
          </span>
          <span className="font-serif italic text-lg">{uploadLabel}</span>
          <span className="text-[10px] font-mono text-muted">
            {dict.calendar.receipt.empty}
          </span>
        </div>
      )}

      {tooLarge ? (
        <p className="text-xs text-red-400">
          {dict.calendar.receipt.uploadFailed}{" "}
          <span className="font-mono text-[10px]">{tooLarge}</span>
        </p>
      ) : null}

      {/* One input for both paths. `accept` is a picker hint, never a check:
          the server sniffs the bytes and only its answer is trusted. */}
      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        disabled={disabled}
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Cleared so picking the same file twice still fires a change.
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Replacing destroys the blob on file, so it asks first — and names the
          file it is about to destroy, since that is the fact the admin needs.
          The dictionary has no replace-specific prose and this component does
          not own the dictionary, so the dialog is assembled from keys that are
          each true on their own: the old receipt IS deleted, and the answer to
          the question is attaching a new one. */}
      <ConfirmDialog
        open={replacing}
        title={dict.calendar.receipt.deleteTitle}
        body={
          receipt
            ? `${receipt.filename} · ${formatBytes(receipt.bytes, dict)}`
            : ""
        }
        confirmLabel={dict.calendar.receipt.upload}
        cancelLabel={dict.common.cancel}
        onConfirm={() => {
          setReplacing(false);
          pickFile();
        }}
        onCancel={() => setReplacing(false)}
      />

      <ConfirmDialog
        open={confirming}
        title={dict.calendar.receipt.deleteTitle}
        body={confirmBody}
        confirmLabel={dict.calendar.receipt.delete}
        cancelLabel={dict.common.cancel}
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
