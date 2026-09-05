"use client";
/**
 * The consent gate: the terms, one checkbox, and the confirm that posts the
 * client's details and their acceptance in the same request.
 *
 * Reuses the Lightbox overlay kit — Escape to leave, body-scroll lock with
 * scrollbar-gutter compensation, a pushed history entry so Android's Back
 * closes the sheet instead of abandoning the booking — with ONE deliberate
 * departure, called out again at the backdrop below: clicking outside does
 * NOT close it.
 *
 * Section bodies are rendered as plain React text nodes. Never
 * dangerouslySetInnerHTML: booking-terms.ts is edited on a legal cadence by
 * whoever is holding the text that day, and that edit must never be able to
 * turn into an injection vector.
 */
import { useEffect, useRef, useState } from "react";
import {
  TERMS,
  TERMS_REQUIRE_SCROLL,
  TERMS_VERSION,
} from "@/lib/booking-terms";
import type { TermsModalProps } from "./contract";

export function TermsModal({
  open,
  locale,
  dict,
  busy,
  error,
  onClose,
  onAccept,
}: TermsModalProps) {
  const t = dict.booking.terms;
  const doc = TERMS[locale];

  const [accepted, setAccepted] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(!TERMS_REQUIRE_SCROLL);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Consent is per-visit: every reopening starts unticked, whether the reader
  // left through Back, Escape, the hardware back button, or a submit that the
  // parent closed for them.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAccepted(false);
      setReachedEnd(!TERMS_REQUIRE_SCROLL);
    }
  }

  // Escape and popstate fire from listeners registered once per open; reading
  // the handler through a ref keeps them from re-subscribing on every render.
  // `busy` rides along for the same reason.
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  /**
   * The rule every dismissal path now obeys: while the submit is in flight,
   * there is no dismissal. This modal is where the request's outcome is
   * rendered, so closing now would throw away the error the server is about to
   * send and leave the reader back on the details step having watched nothing
   * happen at all. The confirm button already refuses to fire twice; the ×,
   * Back, Escape and the hardware back button now agree with it.
   *
   * This is the button half. The keydown and popstate listeners are registered
   * once per open and read everything through refs, so they re-check
   * `busyRef` themselves rather than close over this function — and popstate
   * has extra work to do besides.
   */
  const requestClose = () => {
    if (busyRef.current) return;
    closeRef.current();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll AND compensate for the scrollbar gutter so the page
    // doesn't jump rightward on desktop when the scrollbar disappears.
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // A pushed entry means the hardware Back button closes the gate instead of
  // leaving the page — on a phone that is the difference between "go back" and
  // "lose the form".
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ terms: true }, "", window.location.href);
    const onPopState = () => {
      // popstate cannot be vetoed — the entry is already gone by the time we
      // hear about it — so while the submit is in flight the only way to keep
      // the trap armed (and the modal up) is to push it again.
      if (busyRef.current) {
        window.history.pushState({ terms: true }, "", window.location.href);
        return;
      }
      closeRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      const state = window.history.state as { terms?: boolean } | null;
      if (state?.terms) window.history.back();
    };
  }, [open]);

  // Focus lands on the heading so a screen reader announces what just opened,
  // and returns to whatever opened it on close — but only if that node still
  // exists. On the path that matters most it does not: a successful confirm
  // advances the step and unmounts the details form, Continue button included,
  // in the same commit, and focusing a detached node silently drops focus to
  // <body>. The page's <main> (tabIndex -1, see BookingFlow) outlives every
  // step, so that is the fallback; `preventScroll` keeps it from fighting the
  // scroll into the receipt step that runs in the same commit.
  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    headingRef.current?.focus();
    return () => {
      if (opener?.isConnected) {
        opener.focus();
        return;
      }
      const main = document.querySelector("main");
      if (main instanceof HTMLElement) main.focus({ preventScroll: true });
    };
  }, [open]);

  // The scroll gate. Ships off; when booking-terms.ts flips it on, the
  // checkbox unlocks once a sentinel at the end of the text has been seen —
  // and immediately when the document is short enough not to scroll, because
  // an unreachable end would be an unsatisfiable requirement, not a gate.
  useEffect(() => {
    if (!open || !TERMS_REQUIRE_SCROLL) return;
    const body = bodyRef.current;
    const sentinel = sentinelRef.current;
    if (!body || !sentinel) return;
    if (body.scrollHeight <= body.clientHeight) {
      setReachedEnd(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setReachedEnd(true);
      },
      { root: body },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open]);

  if (!open) return null;

  const gated = TERMS_REQUIRE_SCROLL && !reachedEnd;

  return (
    /* No onClick on this backdrop, deliberately: everywhere else on the site a
       tap outside a panel dismisses it, but this one sits on top of a form the
       client just filled in. An accidental dismissal costs more than an
       explicit Back. */
    <div
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-end md:items-center justify-center animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <div className="w-full md:max-w-lg max-h-[92dvh] md:max-h-[80vh] bg-bg border-t md:border border-line flex flex-col">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2
            id="terms-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-serif italic text-2xl"
          >
            {t.title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label={t.back}
            className="w-9 h-9 flex items-center justify-center text-2xl leading-none text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 flex flex-col gap-4"
          >
            {doc.sections.map((s) => (
              <section key={s.heading} className="flex flex-col gap-1.5">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  {s.heading}
                </h3>
                <p className="text-sm leading-relaxed text-fg/80">{s.body}</p>
              </section>
            ))}
            <div ref={sentinelRef} aria-hidden className="h-px shrink-0" />
          </div>
          {/* Signals "there is more below" without a scrollbar, which mobile hides. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bg"
          />
        </div>

        <div className="shrink-0 border-t border-line px-6 py-4 flex flex-col gap-3">
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="cursor-pointer mt-0.5"
              checked={accepted}
              disabled={gated || busy}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>{t.accept}</span>
          </label>

          {gated ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {t.scrollHint}
            </p>
          ) : null}

          <p className="font-mono text-[10px] text-muted">
            {t.version.replace("{version}", TERMS_VERSION)}
          </p>

          {error ? (
            <p role="status" aria-live="polite" className="text-red-400 text-xs">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="min-h-[44px] px-5 py-3 border border-fg/30 hover:border-fg hover:bg-fg hover:text-bg transition-colors font-mono text-[10px] uppercase tracking-[0.3em] disabled:opacity-40 cursor-pointer"
            >
              {t.back}
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!accepted || busy}
              className="flex-1 min-h-[44px] px-5 py-3 border border-fg bg-fg text-bg hover:bg-transparent hover:text-fg transition-colors font-mono text-[10px] uppercase tracking-[0.3em] disabled:opacity-40 cursor-pointer"
            >
              {busy ? dict.booking.form.sending : t.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
