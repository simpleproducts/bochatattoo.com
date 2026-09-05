"use client";
/**
 * The receipt step: pick a file, see it, watch it go up.
 *
 * This component owns everything that happens on the device — the picker, the
 * dropzone, the local preview, the canvas downscale and the size guard — and
 * hands the finished File to `onUpload`. The POST itself belongs to
 * BookingFlow, which owns the PublicBookingView the response returns; the
 * phase, the percentage and the server's message come back down as props.
 * That split is why there is no request in this file: a component that fired
 * its own would have nowhere to deliver the updated view.
 *
 * Two limits, both real: RECEIPT_CLIENT_MAX_BYTES rejects a file too big to be
 * worth decoding at all, and RECEIPT_MAX_BYTES is re-checked AFTER the
 * downscale, because the downscale is what usually gets a phone photo under
 * the proxy's ceiling. A rejection says "a screenshot works too" rather than
 * quoting a byte count nobody can act on.
 */
import { useEffect, useRef, useState } from "react";
import {
  RECEIPT_ACCEPT,
  RECEIPT_CLIENT_MAX_BYTES,
  RECEIPT_MAX_BYTES,
} from "@/lib/bookings-types";
import { LocalTime } from "@/components/LocalTime";
import { downscaleImage } from "./downscale";
import type { ReceiptUploaderProps } from "./contract";

type Preview = {
  /** Object URL for images, null for a PDF (which gets a glyph instead). */
  url: string | null;
  name: string;
  size: number;
};

export function ReceiptUploader({
  locale,
  dict,
  phase,
  progress,
  error,
  existing,
  onUpload,
  onReset,
}: ReceiptUploaderProps) {
  const r = dict.booking.receipt;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const busy = phase === "uploading" || phase === "verifying";

  // A receipt landing on the record ends the replacement detour and makes the
  // local preview stale. Adjusting here rather than in an effect keeps the two
  // in the same render as the prop that caused them.
  const receiptAt = existing?.uploadedAt ?? null;
  const [seenReceiptAt, setSeenReceiptAt] = useState(receiptAt);
  if (receiptAt !== seenReceiptAt) {
    setSeenReceiptAt(receiptAt);
    setReplacing(false);
    setPreview(null);
  }

  // Once a file is on screen the dropzone gives way to it — the preview row
  // carries its own "change" affordance, so two pickers would be noise.
  const showDropzone = !busy && !preview && (!existing || replacing);
  const message = localError ?? error;

  // One object URL alive at a time: revoke the previous one as soon as it is
  // replaced, and the last one on unmount.
  useEffect(() => {
    const url = preview?.url;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setLocalError(null);

    if (file.size > RECEIPT_CLIENT_MAX_BYTES) {
      setLocalError(dict.booking.errors.tooLarge);
      return;
    }

    // Preview the file the client chose, not the downscaled copy: they should
    // recognise what they just picked.
    const isPdf = file.type === "application/pdf";
    setPreview({
      url: isPdf ? null : URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    });

    const prepared = await downscaleImage(file);
    if (prepared.size > RECEIPT_MAX_BYTES) {
      setLocalError(dict.booking.errors.tooLarge);
      return;
    }
    onUpload(prepared);
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {r.eyebrow}
      </p>
      <p className="text-sm leading-relaxed text-fg/80">{r.intro}</p>

      {existing && !replacing ? (
        <div className="flex items-center justify-between gap-3 border border-line p-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {r.uploaded}
            </span>
            <span className="font-mono text-[11px] text-fg/80 truncate">
              {existing.filename}
              {" · "}
              <LocalTime start={existing.uploadedAt} locale={locale} showDate />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className="shrink-0 min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
          >
            {r.replace}
          </button>
        </div>
      ) : null}

      {preview ? (
        <div className="flex items-center gap-3 border border-line p-2 font-mono text-xs">
          {preview.url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview.url}
              alt=""
              className="w-10 h-10 object-cover bg-line shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-line shrink-0 flex items-center justify-center text-[10px] text-muted">
              PDF
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="truncate">{preview.name}</span>
            <span className="text-muted">
              {(preview.size / 1_000_000).toFixed(1)} MB
            </span>
          </div>
          {!busy ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
            >
              {r.change}
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === "uploading" ? (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={r.uploading}
            className="flex-1 h-0.5 bg-line"
          >
            <div
              className="h-full bg-fg transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted tabular-nums">
            {progress}%
          </span>
        </div>
      ) : null}

      {phase === "verifying" ? (
        <p
          role="status"
          aria-live="polite"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
        >
          {r.verifying}
        </p>
      ) : null}

      {showDropzone ? (
        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (busy) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            if (busy) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (busy) return;
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={[
            "border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center gap-3 text-center transition-colors",
            busy
              ? "border-line opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:border-fg hover:bg-fg/5",
            dragOver ? "border-fg bg-fg/10" : "border-line",
          ].join(" ")}
        >
          <div className="text-3xl leading-none" aria-hidden>
            ↑
          </div>
          <div className="font-serif italic text-xl">{r.drop}</div>
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted">
            {r.tap}
          </div>
          <div className="text-[10px] font-mono text-muted/70">{r.formats}</div>
        </div>
      ) : null}

      {/* Outside the dropzone: the preview's "change" button opens this same
          picker after the dropzone has stepped aside.
          No `capture` attribute on purpose: with it, iOS opens the camera and
          nothing else. Without it the sheet offers Take Photo, Photo Library
          and Browse — and the receipt is usually a screenshot already sitting
          in the library. */}
      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        disabled={busy}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {message ? (
        <div className="flex flex-col gap-2">
          <p role="status" aria-live="polite" className="text-red-400 text-xs">
            {message}
          </p>
          {phase === "error" ? (
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                onReset();
              }}
              className="self-start min-h-[44px] px-2 flex items-center text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
            >
              {r.retry}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
