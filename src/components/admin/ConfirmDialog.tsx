"use client";
/**
 * The admin's confirmation dialog, replacing window.confirm().
 *
 * Native confirm() was doing this job and doing it badly: it cannot be
 * translated (Chrome labels its buttons in the browser's language, not the
 * page's, so a Spanish admin got "OK / Cancel"), it cannot say which of two
 * outcomes is the destructive one, it blocks the main thread, and on iOS it
 * renders a system sheet that looks like it came from Safari rather than from
 * this app.
 *
 * Sits at z-[300] — above the booking sheet's z-[200] — because every caller
 * is inside that sheet. Backdrop click does NOT dismiss: the whole point is a
 * deliberate answer, and a stray tap on a "discard your work?" question is the
 * exact accident being guarded against. Escape does dismiss, because Escape is
 * unambiguous and always means "no".
 *
 * Focus lands on the CANCEL control rather than the confirm one, so a reflexive
 * Enter keeps the appointment instead of destroying it.
 */
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  /** The destructive answer, e.g. "Descartar". */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The booking sheet also closes on Escape. Stop here so one press
      // answers the question rather than dismissing both at once.
      e.stopPropagation();
      onCancelRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] bg-bg/95 backdrop-blur-md flex items-end md:items-center justify-center px-4 pb-4 md:p-6 animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
    >
      <div className="w-full md:max-w-sm border border-line bg-bg p-5 flex flex-col gap-4">
        <h2 id="confirm-title" className="font-serif italic text-xl">
          {title}
        </h2>
        <p id="confirm-body" className="text-sm leading-relaxed text-fg/80">
          {body}
        </p>
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-3 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[40px] border border-red-400 text-red-400 px-4 text-xs uppercase tracking-[0.2em] font-mono hover:bg-red-400 hover:text-bg transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
