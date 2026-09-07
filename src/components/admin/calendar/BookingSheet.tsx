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
 *
 * Two clocks, and they are not interchangeable. The APPOINTMENT'S zone renders
 * the session — day, range, abbreviation, and the zone spelled out — because
 * that is the time the client was given. `tz`, the calendar's viewing zone,
 * renders the audit timestamps (created, terms accepted, emails sent), which
 * really are facts about when someone did something, and the secondary "in
 * your own zone" line under the session, which only appears when it would say
 * something the primary line does not.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LocalTime } from "@/components/LocalTime";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import { bookingLabel } from "@/lib/bookings-types";
import type { BookingEmailKind } from "@/lib/bookings-types";
import { dayKeyOf, durationLabel, formatDayLong } from "@/lib/booking-time";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
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
  /**
   * The admin's language, resolved on the server from the cookie and handed
   * down by the calendar. `dict` is every word this subtree renders — the
   * sheet forwards it to the form, the link row and the receipt so none of
   * them has to look one up — and `locale` is what the `Intl`-backed helpers
   * (`formatDayLong`, `LocalTime`) need, which no dictionary can supply.
   */
  dict: AdminDictionary;
  locale: Locale;
  loadPending?: boolean;
  /** Why the by-id fetch failed, if it did. */
  loadError?: string | null;
  onRetryLoad?: () => void;
};

const MOBILE_PANEL =
  "fixed inset-x-0 bottom-0 max-h-[88vh] rounded-t-md border-t border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto overscroll-contain animate-sheet-up";
const DESKTOP_PANEL =
  "fixed right-0 top-0 bottom-0 w-[420px] border-l border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto animate-panel-in";

const OUTLINE_ACTION =
  "border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer";
const QUIET_ACTION =
  "border border-line px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:border-fg hover:text-fg transition-colors disabled:opacity-40 cursor-pointer";

/**
 * The order the four transactional emails are listed in — chronological, not
 * the declaration order of `BookingEmailKind`. Each kind is also its own key in
 * `dict.calendar.emails`, so the label is a lookup rather than a second table
 * that could fall out of step with this one.
 */
const EMAIL_ROWS: BookingEmailKind[] = [
  "ownerSubmitted",
  "clientSubmitted",
  "ownerConfirmed",
  "clientConfirmed",
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
  studioTz,
  defaultTimeZone,
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
  dict,
  locale,
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

  const discard = dict.calendar.sheet.discardConfirm;

  /**
   * Which question the dialog is asking, or null. `discard` and `discardPop`
   * differ only in how they got here — the Back button has already consumed a
   * history entry by the time it asks, and the popstate handler re-arms the
   * trap before opening this, so answering either way leaves the stack sane.
   */
  const [pending, setPending] = useState<null | "discard" | "discardPop" | "delete">(
    null,
  );

  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      setPending("discard");
      return;
    }
    onClose();
  }, [onClose]);

  // Read through refs inside the window listeners so that a new `onClose`
  // identity does not tear down and re-arm the history trap mid-sheet. The
  // sync is an effect with no dependency list, so it runs after every commit;
  // it is declared above the listener effects, and all three refs are only ever
  // dereferenced later still, from an event. Assigning during render instead
  // would make the value a render output, which a ref is explicitly not.
  // `discard` joins them for the same reason: the popstate listener needs the
  // current language, and switching it must not re-arm the history trap.
  const requestCloseRef = useRef(requestClose);
  const onCloseRef = useRef(onClose);
  const discardRef = useRef(discard);
  useEffect(() => {
    requestCloseRef.current = requestClose;
    onCloseRef.current = onClose;
    discardRef.current = discard;
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
      if (dirtyRef.current) {
        // The entry is already gone, so re-arm the trap before asking;
        // otherwise the next Back press would leave the calendar entirely.
        window.history.pushState({ bookingSheet: true }, "", window.location.href);
        setPending("discardPop");
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
      ? dict.calendar.sheet.newTitle
      : state.mode === "edit"
        ? dict.calendar.sheet.editTitle
        : appt
          ? bookingLabel(appt)
          : dict.calendar.sheet.fallbackTitle;

  function markDirtyFromClick(e: React.MouseEvent) {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest("[data-form-dirty]")) {
      dirtyRef.current = true;
    }
  }

  // Names the reversible alternative in prose; `sheet.cancelBooking` labels the
  // button it points at, in both languages.
  const confirmDelete = () => setPending("delete");

  const dialog =
    pending === "delete"
      ? {
          title: dict.calendar.sheet.deleteTitle,
          body: dict.calendar.sheet.deleteConfirm,
          confirmLabel: dict.common.delete,
          onConfirm: onDelete,
        }
      : pending
        ? {
            title: dict.calendar.sheet.discardTitle,
            body: discard,
            confirmLabel: dict.common.discard,
            onConfirm: onClose,
          }
        : null;

  /**
   * Built before the tree so `appt` narrows properly in the edit branch — a
   * ternary inside JSX would need a non-null assertion to say the same thing.
   */
  let composer: ReactNode = null;
  if (state.mode === "create") {
    composer = (
      <BookingForm
        key={formKey}
        viewerTz={tz}
        studioTz={studioTz}
        /*
         * The composer opens in the zone the admin last saved — a week of
         * Berlin guest-spot bookings is one zone set once — while the day it
         * opens on and "is that today" stay the reader's frame, because those
         * are the squares that were just tapped.
         */
        initial={emptyFormValues(
          state.dayKey,
          defaultTimeZone,
          dayKeyOf(new Date().toISOString(), tz),
        )}
        busy={busy}
        error={error}
        submitLabel={dict.calendar.form.create}
        others={all}
        onSubmit={onSubmitForm}
        onCancel={requestClose}
        dict={dict}
        locale={locale}
      />
    );
  } else if (state.mode === "edit") {
    composer = appt ? (
      <BookingForm
        key={formKey}
        viewerTz={tz}
        studioTz={studioTz}
        /* Hydrated from the appointment's own zone, so opening a Berlin
           booking and saving it untouched is a no-op. */
        initial={formValuesFrom(appt)}
        busy={busy}
        error={error}
        submitLabel={dict.calendar.form.saveChanges}
        others={all.filter((a) => a.id !== appt.id)}
        onSubmit={onSubmitForm}
        onCancel={requestClose}
        dict={dict}
        locale={locale}
      />
    ) : (
      <p className="text-sm text-muted">{dict.calendar.sheet.notLoaded}</p>
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
            {busy && (
              <span className="text-xs font-mono text-muted">
                {dict.common.working}
              </span>
            )}
            <button
              type="button"
              onClick={requestClose}
              aria-label={dict.common.close}
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
                <p className="text-sm text-muted">
                  {dict.calendar.sheet.loadingOne}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    {dict.calendar.sheet.loadFailed}
                  </p>
                  {loadError ? (
                    <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
                      {loadError}
                    </p>
                  ) : null}
                  {onRetryLoad ? (
                    <button type="button" onClick={onRetryLoad} className={QUIET_ACTION}>
                      {dict.common.retry}
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
                <StatusBadge status={appt.status} size="md" dict={dict} />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {dict.calendar.sheet.created}{" "}
                  <LocalTime
                    start={appt.createdAt}
                    timeZone={tz}
                    locale={locale}
                    showDate
                  />
                </p>
              </div>

              {/*
                The appointment's own zone is the primary clock, and it is
                named rather than merely abbreviated: "GMT+2" is not something
                anyone confirms a session against, "Europe/Berlin" is. The
                reader's own time follows only when the two differ, in the
                muted 10px line the sheet uses for its asides — and it carries
                its date, because a 01:00 Berlin session is the evening BEFORE
                in Buenos Aires and a bare clock would put it on the wrong day.
              */}
              <div className="flex flex-col gap-1">
                <p className="font-serif italic text-2xl">
                  {formatDayLong(appt.startsAt, appt.timeZone, locale)}
                </p>
                <p className="font-mono text-sm">
                  <LocalTime
                    start={appt.startsAt}
                    end={appt.endsAt}
                    timeZone={appt.timeZone}
                    locale={locale}
                    showZone
                  />
                  <span className="text-muted">
                    {" "}
                    · {durationLabel(appt.startsAt, appt.endsAt)}
                  </span>
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted break-words">
                  {dict.calendar.form.timeZone} · {appt.timeZone}
                </p>
                {appt.timeZone !== tz ? (
                  <p className="font-mono text-[10px] text-muted break-words">
                    {dict.calendar.form.timeZoneCurrent.replace("{tz}", tz)} ·{" "}
                    <LocalTime
                      start={appt.startsAt}
                      end={appt.endsAt}
                      timeZone={tz}
                      locale={locale}
                      showDate
                      showZone
                    />
                  </p>
                ) : null}
                {appt.deposit && (
                  <p className="font-mono text-xs text-muted">
                    {dict.common.deposit} {appt.deposit.currency}{" "}
                    {appt.deposit.amount}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] border-b border-line pb-1">
                    {dict.calendar.sheet.seed}
                  </h3>
                  <Row label={dict.common.name} value={appt.seed.name} />
                  <Row
                    label={dict.common.instagram}
                    value={appt.seed.instagram ? `@${appt.seed.instagram}` : undefined}
                  />
                  <Row label={dict.common.email} value={appt.seed.email} />
                  <Row label={dict.common.phone} value={appt.seed.phone} />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] border-b border-line pb-1">
                    {dict.calendar.sheet.client}
                  </h3>
                  <Row label={dict.common.name} value={appt.client.name} />
                  <Row
                    label={dict.common.instagram}
                    value={
                      appt.client.instagram ? `@${appt.client.instagram}` : undefined
                    }
                  />
                  <Row label={dict.common.email} value={appt.client.email} />
                  <Row label={dict.common.phone} value={appt.client.phone} />
                  <Row
                    label={dict.calendar.sheet.message}
                    value={appt.client.note}
                  />
                </div>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted break-words">
                {appt.client.termsAcceptedAt ? (
                  <>
                    {dict.calendar.sheet.termsAccepted}{" "}
                    <LocalTime
                      start={appt.client.termsAcceptedAt}
                      timeZone={tz}
                      locale={locale}
                      showDate
                    />
                    {appt.client.termsVersion ? ` · ${appt.client.termsVersion}` : ""}
                  </>
                ) : (
                  dict.calendar.sheet.termsPending
                )}
              </p>

              <ReceiptPreview
                appt={appt}
                busy={busy}
                onDelete={onDeleteReceipt}
                dict={dict}
                locale={locale}
              />

              {appt.adminNotes?.trim() && (
                <section className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {dict.calendar.sheet.notes}
                  </h3>
                  <p className="text-sm text-fg/80 whitespace-pre-wrap break-words">
                    {appt.adminNotes}
                  </p>
                </section>
              )}

              <ShareLinkRow
                appt={appt}
                busy={busy}
                onRotate={onRotateLink}
                dict={dict}
              />

              <section className="flex flex-col gap-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {dict.calendar.emails.heading}
                </h3>
                <ul className="flex flex-col divide-y divide-line border-y border-line">
                  {EMAIL_ROWS.map((kind) => {
                    const sentAt = appt.emails[kind];
                    return (
                      <li
                        key={kind}
                        className="flex items-center justify-between gap-3 py-2 flex-wrap"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                          {dict.calendar.emails[kind]}
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[10px] text-muted">
                            {sentAt ? (
                              <>
                                <span aria-hidden>✓ </span>
                                <LocalTime
                                  start={sentAt}
                                  timeZone={tz}
                                  locale={locale}
                                  showDate
                                />
                              </>
                            ) : (
                              dict.calendar.emails.notSent
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => onResend(kind)}
                            disabled={busy}
                            className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
                          >
                            {dict.calendar.emails.resend}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {appt.emails.lastError && (
                  /* The kind is named with the same label as the row above it,
                     so the failure points at a line the admin can see. The
                     message is whatever the mail provider said and stays
                     verbatim — translating a server string would invent one. */
                  <p className="font-mono text-[10px] text-red-400 break-words">
                    {dict.calendar.emails[appt.emails.lastError.kind]}:{" "}
                    {appt.emails.lastError.message}
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
                  {dict.common.edit}
                </button>
                <button
                  type="button"
                  onClick={() => onCancelToggle(!appt.cancelledAt)}
                  disabled={busy}
                  className={QUIET_ACTION}
                >
                  {appt.cancelledAt
                    ? dict.calendar.sheet.restore
                    : dict.calendar.sheet.cancelBooking}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={busy}
                  className="ml-auto border border-red-400 text-red-400 px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-red-400 hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {dict.common.delete}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {dialog ? (
        <ConfirmDialog
          open
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dict.common.cancel}
          onConfirm={() => {
            setPending(null);
            dialog.onConfirm();
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
