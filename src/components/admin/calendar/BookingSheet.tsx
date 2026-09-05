"use client";
/**
 * The booking detail sheet — a right-hand panel on desktop, a bottom sheet on
 * a phone, the same component either way.
 *
 * The overlay kit is lifted from Lightbox.tsx and behaves identically, because
 * an admin who has learned the gallery's overlay should not have to learn a
 * second one: Escape closes, the body scroll lock compensates for the
 * scrollbar gutter so the page beneath never jumps sideways, a pushed history
 * entry makes Android's Back close the sheet instead of leaving the calendar,
 * and a click on the backdrop closes while a click inside does not.
 *
 * Added on top of that kit: focus moves to the heading on open and returns to
 * whatever opened the sheet on close, and closing an edited form asks first.
 * Dirtiness is observed rather than reported — the form's props are frozen in
 * contract.ts and carry no `onDirtyChange`, so the sheet listens for change
 * events bubbling out of the form and for clicks on controls that change state
 * without emitting one (the duration chips, tagged `data-form-dirty`).
 *
 * Which of the two panel geometries is used has to be decided in JS: both
 * animations are hand-written classes in globals.css rather than generated
 * utilities, so `md:animate-panel-in` would not exist as a rule.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LocalTime } from "@/components/LocalTime";
import { bookingLabel } from "@/lib/bookings-types";
import type { BookingEmailKind } from "@/lib/bookings-types";
import { dayKeyOf, durationLabel, formatDayLong } from "@/lib/booking-time";
import { BookingForm } from "./BookingForm";
import { ReceiptPreview } from "./ReceiptPreview";
import { ShareLinkRow } from "./ShareLinkRow";
import { StatusBadge } from "./StatusBadge";
import { emptyFormValues, formValuesFrom } from "./contract";
import type { BookingSheetProps } from "./contract";

/**
 * The sheet can be opened on an id the calendar has not loaded — the `?b=`
 * deep link from the owner's notification email does exactly that, for any
 * booking outside the three months the page server-rendered. These three
 * describe the fetch that goes and gets it, so an empty sheet can say what is
 * happening instead of implying the booking was deleted. Optional, and absent
 * for every sheet opened from a chip or an agenda row.
 */
type SheetProps = BookingSheetProps & {
  loadPending?: boolean;
  /** Why the by-id fetch failed, if it did. */
  loadError?: string | null;
  onRetryLoad?: () => void;
};

const MOBILE_PANEL =
  "fixed inset-x-0 bottom-0 max-h-[88vh] rounded-t-md border-t border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto overscroll-contain animate-sheet-up";
const DESKTOP_PANEL =
  "fixed right-0 top-0 bottom-0 w-[420px] border-l border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto animate-panel-in";

const DISCARD =
  "Discard your changes to this booking?\n\nNothing has been saved yet.";

const OUTLINE_ACTION =
  "border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer";
const QUIET_ACTION =
  "border border-line px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:border-fg hover:text-fg transition-colors disabled:opacity-40 cursor-pointer";

const EMAIL_ROWS: { kind: BookingEmailKind; label: string }[] = [
  { kind: "ownerSubmitted", label: "Owner · submitted" },
  { kind: "clientSubmitted", label: "Client · submitted" },
  { kind: "ownerConfirmed", label: "Owner · confirmed" },
  { kind: "clientConfirmed", label: "Client · confirmed" },
];

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </span>
      <span className="text-sm break-all">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

export function BookingSheet({
  state,
  appt,
  tz,
  busy,
  error,
  all,
  onClose,
  onSubmitForm,
  onRequestEdit,
  onCancelToggle,
  onDelete,
  onRotateLink,
  onDeleteReceipt,
  onResend,
  loadPending,
  loadError,
  onRetryLoad,
}: SheetProps) {
  const open = state.mode !== "closed";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirtyRef = useRef(false);

  // Desktop is the safe server-side guess: the sheet only ever renders after a
  // click, so this initialiser runs in the browser in practice.
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm(DISCARD)) return;
    onClose();
  }, [onClose]);

  // Read through refs inside the window listeners so that a new `onClose`
  // identity does not tear down and re-arm the history trap mid-sheet. The
  // sync is an effect with no dependency list, so it runs after every commit;
  // it is declared above the listener effects, and both refs are only ever
  // dereferenced later still, from an event. Assigning during render instead
  // would make the value a render output, which a ref is explicitly not.
  const requestCloseRef = useRef(requestClose);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
    onCloseRef.current = onClose;
  });

  /** Identity of what the sheet is showing — the form's remount key. */
  const formKey =
    state.mode === "create"
      ? `create:${state.dayKey}`
      : state.mode === "closed"
        ? "closed"
        : `${state.mode}:${state.id}`;

  useEffect(() => {
    dirtyRef.current = false;
  }, [formKey]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll AND compensate for the scrollbar gutter so the page
    // doesn't jump rightward on desktop when the scrollbar disappears.
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
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

  useEffect(() => {
    if (!open) return;
    // Same URL, extra entry: the calendar owns ?b=<id> and this must not fight
    // it for the query string.
    window.history.pushState({ bookingSheet: true }, "", window.location.href);
    const onPopState = () => {
      if (dirtyRef.current && !window.confirm(DISCARD)) {
        // The entry is already gone, so re-arm the trap; otherwise the next
        // Back press would leave the calendar entirely.
        window.history.pushState({ bookingSheet: true }, "", window.location.href);
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.bookingSheet) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  if (state.mode === "closed") return null;

  const composing = state.mode === "create" || state.mode === "edit";
  const title =
    state.mode === "create"
      ? "New appointment"
      : state.mode === "edit"
        ? "Edit appointment"
        : appt
          ? bookingLabel(appt)
          : "Appointment";

  function markDirtyFromClick(e: React.MouseEvent) {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest("[data-form-dirty]")) {
      dirtyRef.current = true;
    }
  }

  function confirmDelete() {
    const ok = window.confirm(
      "Delete this booking permanently?\n\nThe record and any receipt are erased and the link dies. Use Cancel booking instead if you only want to free the slot — that one is reversible.",
    );
    if (ok) onDelete();
  }

  /**
   * Built before the tree so `appt` narrows properly in the edit branch — a
   * ternary inside JSX would need a non-null assertion to say the same thing.
   */
  let composer: ReactNode = null;
  if (state.mode === "create") {
    composer = (
      <BookingForm
        key={formKey}
        tz={tz}
        initial={emptyFormValues(
          state.dayKey,
          tz,
          dayKeyOf(new Date().toISOString(), tz),
        )}
        busy={busy}
        error={error}
        submitLabel="Create appointment"
        others={all}
        onSubmit={onSubmitForm}
        onCancel={requestClose}
      />
    );
  } else if (state.mode === "edit") {
    composer = appt ? (
      <BookingForm
        key={formKey}
        tz={tz}
        initial={formValuesFrom(appt, tz)}
        busy={busy}
        error={error}
        submitLabel="Save changes"
        others={all.filter((a) => a.id !== appt.id)}
        onSubmit={onSubmitForm}
        onCancel={requestClose}
      />
    ) : (
      <p className="text-sm text-muted">This appointment is no longer loaded.</p>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg/60"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className={isDesktop ? DESKTOP_PANEL : MOBILE_PANEL}
      >
        {!isDesktop && (
          <div className="h-8 flex items-center justify-center" aria-hidden>
            <span className="w-10 h-1 rounded-full bg-line" />
          </div>
        )}

        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-md border-b border-line px-5 py-4 flex items-start justify-between gap-3">
          <h2
            id="booking-sheet-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-serif italic text-2xl focus:outline-none break-words"
          >
            {title}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {busy && <span className="text-xs font-mono text-muted">working…</span>}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center text-2xl leading-none text-muted hover:text-fg cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">
          {composing ? (
            <div
              onChange={() => {
                dirtyRef.current = true;
              }}
              onClick={markDirtyFromClick}
            >
              {composer}
            </div>
          ) : !appt ? (
            /* Never "no longer loaded": the admin reads that as deleted, and
               the usual cause is a booking months outside the loaded window
               that is still being fetched — or a fetch that failed and can be
               tried again. */
            <div className="flex flex-col gap-3 items-start">
              {loadPending ? (
                <p className="text-sm text-muted">Loading this appointment…</p>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    This appointment could not be loaded.
                  </p>
                  {loadError ? (
                    <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
                      {loadError}
                    </p>
                  ) : null}
                  {onRetryLoad ? (
                    <button type="button" onClick={onRetryLoad} className={QUIET_ACTION}>
                      Retry
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <>
              {error && (
                <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <StatusBadge status={appt.status} size="md" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Created{" "}
                  <LocalTime
                    start={appt.createdAt}
                    timeZone={tz}
                    locale="en"
                    showDate
                  />
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-serif italic text-2xl">
                  {formatDayLong(appt.startsAt, tz, "en")}
                </p>
                <p className="font-mono text-sm">
                  <LocalTime
                    start={appt.startsAt}
                    end={appt.endsAt}
                    timeZone={tz}
                    locale="en"
                    showZone
                  />
                  <span className="text-muted">
                    {" "}
                    · {durationLabel(appt.startsAt, appt.endsAt)}
                  </span>
                </p>
                {appt.deposit && (
                  <p className="font-mono text-xs text-muted">
                    Deposit {appt.deposit.currency} {appt.deposit.amount}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] border-b border-line pb-1">
                    Studio seed
                  </h3>
                  <Row label="Name" value={appt.seed.name} />
                  <Row
                    label="Instagram"
                    value={appt.seed.instagram ? `@${appt.seed.instagram}` : undefined}
                  />
                  <Row label="Email" value={appt.seed.email} />
                  <Row label="Phone" value={appt.seed.phone} />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] border-b border-line pb-1">
                    Client
                  </h3>
                  <Row label="Name" value={appt.client.name} />
                  <Row
                    label="Instagram"
                    value={
                      appt.client.instagram ? `@${appt.client.instagram}` : undefined
                    }
                  />
                  <Row label="Email" value={appt.client.email} />
                  <Row label="Phone" value={appt.client.phone} />
                  <Row label="Message" value={appt.client.note} />
                </div>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted break-words">
                {appt.client.termsAcceptedAt ? (
                  <>
                    Terms accepted{" "}
                    <LocalTime
                      start={appt.client.termsAcceptedAt}
                      timeZone={tz}
                      locale="en"
                      showDate
                    />
                    {appt.client.termsVersion ? ` · ${appt.client.termsVersion}` : ""}
                  </>
                ) : (
                  "Terms not accepted yet"
                )}
              </p>

              <ReceiptPreview appt={appt} busy={busy} onDelete={onDeleteReceipt} />

              {appt.adminNotes?.trim() && (
                <section className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    Private notes
                  </h3>
                  <p className="text-sm text-fg/80 whitespace-pre-wrap break-words">
                    {appt.adminNotes}
                  </p>
                </section>
              )}

              <ShareLinkRow appt={appt} busy={busy} onRotate={onRotateLink} />

              <section className="flex flex-col gap-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Email
                </h3>
                <ul className="flex flex-col divide-y divide-line border-y border-line">
                  {EMAIL_ROWS.map(({ kind, label }) => {
                    const sentAt = appt.emails[kind];
                    return (
                      <li
                        key={kind}
                        className="flex items-center justify-between gap-3 py-2 flex-wrap"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                          {label}
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[10px] text-muted">
                            {sentAt ? (
                              <>
                                <span aria-hidden>✓ </span>
                                <LocalTime
                                  start={sentAt}
                                  timeZone={tz}
                                  locale="en"
                                  showDate
                                />
                              </>
                            ) : (
                              "not sent"
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => onResend(kind)}
                            disabled={busy}
                            className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
                          >
                            Resend
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {appt.emails.lastError && (
                  <p className="font-mono text-[10px] text-red-400 break-words">
                    {appt.emails.lastError.kind}: {appt.emails.lastError.message}
                  </p>
                )}
              </section>

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={onRequestEdit}
                  disabled={busy}
                  className={OUTLINE_ACTION}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onCancelToggle(!appt.cancelledAt)}
                  disabled={busy}
                  className={QUIET_ACTION}
                >
                  {appt.cancelledAt ? "Restore" : "Cancel booking"}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={busy}
                  className="ml-auto border border-red-400 text-red-400 px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-red-400 hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
