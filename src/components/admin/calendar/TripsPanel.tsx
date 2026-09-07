"use client";
/**
 * The trips manager — the one screen where a trip is added, corrected or
 * retired.
 *
 * The overlay kit is BookingSheet's, lifted wholesale for the reason that file
 * gives for lifting it from Lightbox: an admin who has learned one overlay on
 * this screen should not have to learn a second one beside it. Escape closes,
 * the body scroll lock compensates for the scrollbar gutter so the page beneath
 * never jumps sideways, a pushed history entry makes Android's Back close the
 * panel instead of leaving the calendar, the backdrop closes while a click
 * inside does not, and focus moves to the heading on open and returns to
 * whatever opened it on close.
 *
 * What it deliberately does NOT lift is the sheet's dirty-form guard. An
 * appointment carries a client's details and is typed once; a trip is four
 * short fields, and the only thing in here that cannot be typed again is the
 * delete — which is why that one control, and only that one, asks first.
 *
 * Dates are printed raw ("2026-03-10 → 2026-03-20") rather than formatted, and
 * the missing `locale` in the props is the reason as much as the consequence:
 * these are calendar dates, not instants (see trips-types.ts), and the ISO
 * shape is exactly what the two <input type="date"> fields below hold. A
 * prettified "10 de marzo" would be a second spelling of the same string with
 * nothing to gain by it.
 *
 * The three checks the route makes are made here first — a label that is empty
 * or over TRIP_LABEL_MAX, a reversed range — so the ordinary typo costs no
 * round trip. They do not replace the route's: this is a convenience, and the
 * server still refuses what it refuses. A failure from there arrives back as
 * `error`, already humanised by `readError`.
 *
 * There is no success channel in these props, so a submitted form closes
 * itself and the LIST is what confirms the write: the saved trip appears in it
 * a moment later, and a failure says so in the error strip at the top. That is
 * the same bargain the rest of the admin makes — the server's answer, not the
 * form's optimism, is what the screen ends up showing.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { AdminDictionary } from "@/i18n/admin";
import { isValidTimeZone } from "@/lib/bookings-types";
import { timeZoneOptions, type TimeZoneOption } from "@/lib/timezone-options";
import { TRIP_LABEL_MAX, type Trip } from "@/lib/trips-types";

/**
 * The four editable fields, and the whole of what a trip is from the outside:
 * `id` and the two timestamps belong to the store, and nothing in this panel
 * can write them.
 */
export type TripDraft = {
  label: string;
  timeZone: string;
  startDate: string;
  endDate: string;
};

export type TripsPanelProps = {
  open: boolean;
  trips: Trip[];
  busy: boolean;
  /** Already-humanised message from `readError`, or null. */
  error: string | null;
  /** The studio's zone, offered as the first named shortcut in the zone select. */
  studioTz: string;
  /** The zone the calendar is being read in — the other shortcut, and the default. */
  viewerTz: string;
  dict: AdminDictionary;
  onClose: () => void;
  onCreate: (t: TripDraft) => void;
  onUpdate: (id: string, t: TripDraft) => void;
  onDelete: (id: string) => void;
};

/** Both geometries are hand-written animations in globals.css — see BookingSheet. */
const MOBILE_PANEL =
  "fixed inset-x-0 bottom-0 max-h-[88vh] rounded-t-md border-t border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto overscroll-contain animate-sheet-up";
const DESKTOP_PANEL =
  "fixed right-0 top-0 bottom-0 w-[420px] border-l border-line bg-bg/95 backdrop-blur-md z-[200] overflow-y-auto animate-panel-in";

const INPUT =
  "bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-fg";
const LABEL = "font-mono uppercase tracking-[0.2em] text-muted";
const OUTLINE_ACTION =
  "border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer";
const QUIET_ACTION =
  "text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg disabled:opacity-40 cursor-pointer";
/**
 * The per-row controls. A real 36px target around a single glyph: they repeat
 * down the list and the words for them would not survive the narrow panel, so
 * the label lives in `aria-label` instead — which is what `trips.editOne` and
 * `trips.deleteOne` are for.
 */
const ROW_ACTION =
  "w-9 h-9 flex items-center justify-center text-base leading-none transition-colors disabled:opacity-40 cursor-pointer";

/**
 * A third verbatim twin of the hook in CalendarToolbar and BookingForm. Both
 * of those keep theirs private for the same reason this one is private: a zone
 * select whose list came from somewhere else would be the one control on this
 * screen offering a different set of zones from the two beside it.
 *
 * Gated on hydration rather than filled in by an effect: Node and the browser
 * can ship different ICU data, and a <select> whose options differ between the
 * server render and the first client render is a hydration mismatch.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

function useZoneOptions(extra: (string | undefined)[]): TimeZoneOption[] {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const key = extra.filter(Boolean).join("|");
  return useMemo(() => {
    if (!mounted) return [];
    return timeZoneOptions(new Date().getUTCFullYear(), key ? key.split("|") : []);
  }, [mounted, key]);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className ?? ""}`}>
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Which editor is open, if any. A union rather than two flags because the two
 * are mutually exclusive on screen: opening the add form has to put away a row
 * that was being edited, and the union is what makes that one assignment.
 */
type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

/**
 * One trip's four fields.
 *
 * `initial` is read once, at mount, exactly like BookingForm's: the callers
 * below give this component a key that changes with the trip being edited, so
 * a refresh landing mid-edit can never overwrite half-typed input with the
 * stored values.
 */
function TripForm({
  heading,
  initial,
  submitLabel,
  busy,
  studioTz,
  viewerTz,
  dict,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: TripDraft;
  submitLabel: string;
  busy: boolean;
  studioTz: string;
  viewerTz: string;
  dict: AdminDictionary;
  onSubmit: (t: TripDraft) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<TripDraft>(initial);
  // The trip's own zone is passed in as an `extra` so editing a trip stored in
  // a zone outside the curated list still shows that zone selected.
  const zoneOptions = useZoneOptions([values.timeZone, viewerTz, studioTz]);

  const patch = (p: Partial<TripDraft>) => setValues((v) => ({ ...v, ...p }));

  const label = values.label.trim();
  /**
   * The route's own three refusals, in the order they are worth reading. Only
   * one line is ever shown: they are independent problems but the admin fixes
   * them one at a time, and three red lines under four fields reads as a
   * broken form rather than a correctable one.
   *
   * An EMPTY label is not in here on purpose — `required` on the input below
   * already stops the submit, and the browser's own bubble says so at the
   * field instead of in a strip under it.
   */
  const problem =
    label.length > TRIP_LABEL_MAX
      ? dict.trips.errors.labelTooLong.replace("{max}", String(TRIP_LABEL_MAX))
      : values.startDate !== "" &&
          values.endDate !== "" &&
          values.endDate < values.startDate
        ? // A plain string compare, which is all an inclusive "YYYY-MM-DD"
          // range ever needs. See trips-types.ts.
          dict.trips.errors.invalidRange
        : !isValidTimeZone(values.timeZone)
          ? // Unreachable from the select, which only offers zones this
            // runtime resolved. Reachable by EDITING a trip stored in a zone
            // this runtime no longer knows — a tzdb release ago, or another
            // browser — where the select would otherwise sit silently on some
            // other value and save it.
            dict.trips.errors.invalidTimeZone
          : null;

  const complete =
    label !== "" && values.startDate !== "" && values.endDate !== "";

  /** True when the select's value is not one of the options it is drawing. */
  const zoneListed =
    values.timeZone === studioTz ||
    values.timeZone === viewerTz ||
    zoneOptions.some((z) => z.id === values.timeZone);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || problem !== null || !complete) return;
    // The trimmed label is what is stored: a trailing space is invisible in
    // the band it ends up in and would still count against TRIP_LABEL_MAX.
    onSubmit({ ...values, label });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {heading}
      </h3>

      <Field label={dict.common.name}>
        <input
          type="text"
          required
          placeholder={dict.trips.namePlaceholder}
          value={values.label}
          onChange={(e) => patch({ label: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label={dict.trips.timeZone}>
        <select
          value={values.timeZone}
          onChange={(e) => patch({ timeZone: e.target.value })}
          className={`${INPUT} cursor-pointer`}
        >
          {/* The same two shortcuts, in the same order, as the booking form's
              own zone select: the two selects on this screen are learned once. */}
          <option value={studioTz} className="bg-bg text-fg">
            {dict.calendar.form.timeZoneStudio.replace("{tz}", studioTz)}
          </option>
          {viewerTz !== studioTz ? (
            <option value={viewerTz} className="bg-bg text-fg">
              {dict.calendar.form.timeZoneCurrent.replace("{tz}", viewerTz)}
            </option>
          ) : null}
          {(["americas", "europe"] as const).map((region) => {
            const inRegion = zoneOptions.filter((z) => z.region === region);
            if (inRegion.length === 0) return null;
            return (
              <optgroup
                key={region}
                label={
                  region === "americas"
                    ? dict.calendar.toolbar.timezoneAmericas
                    : dict.calendar.toolbar.timezoneEurope
                }
              >
                {inRegion.map((z) => (
                  <option key={z.id} value={z.id} className="bg-bg text-fg">
                    {z.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
          {/* Pre-mount, or a stored zone the list could not resolve. Without
              it the select would show the studio while the state said Berlin,
              and saving the form untouched would move the trip. */}
          {zoneListed ? null : (
            <option value={values.timeZone} className="bg-bg text-fg">
              {values.timeZone}
            </option>
          )}
        </select>
      </Field>

      <div className="flex gap-3">
        <Field label={dict.trips.from} className="flex-1 min-w-0">
          <input
            type="date"
            required
            value={values.startDate}
            onChange={(e) => patch({ startDate: e.target.value })}
            className={INPUT}
          />
        </Field>
        <Field label={dict.trips.to} className="flex-1 min-w-0">
          <input
            type="date"
            required
            value={values.endDate}
            onChange={(e) => patch({ endDate: e.target.value })}
            className={INPUT}
          />
        </Field>
      </div>

      {problem ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400 break-words">
          {problem}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        {/*
          Only `busy` disables this, for the reason BookingForm's submit gives:
          a button that explains why it refused beats one that cannot be
          pressed. The line above is already up by then.
        */}
        <button type="submit" disabled={busy} className={OUTLINE_ACTION}>
          {busy ? dict.common.saving : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={QUIET_ACTION}
        >
          {dict.common.cancel}
        </button>
      </div>
    </form>
  );
}

export function TripsPanel({
  open,
  trips,
  busy,
  error,
  studioTz,
  viewerTz,
  dict,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: TripsPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState<Editing>(null);
  /** The trip the delete dialog is asking about, by id. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Desktop is the safe server-side guess: the panel only ever renders after a
  // click, so this initialiser runs in the browser in practice.
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  /**
   * React's documented "adjust state when a prop changes", run during render
   * rather than in an effect — which this repo lints as an error. A panel that
   * was closed mid-edit has to come back on the list: the half-typed form
   * behind it was abandoned, and reopening onto it would look like the trip
   * had been saved that way.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setEditing(null);
    setPendingDeleteId(null);
  }

  // Read through a ref inside the window listeners so a new `onClose` identity
  // does not tear down and re-arm the history trap mid-panel. Synced in an
  // effect with no dependency list — it runs after every commit, and the ref is
  // only ever dereferenced later still, from an event.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    // ConfirmDialog listens on the capture phase and stops propagation, so
    // while it is up one Escape answers it rather than closing this too.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
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
    // it for the query string. Its own state key, so the sheet's trap and this
    // one can never mistake each other's entry for their own.
    window.history.pushState({ tripsPanel: true }, "", window.location.href);
    const onPopState = () => onCloseRef.current();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.tripsPanel) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  const submitNew = useCallback(
    (draft: TripDraft) => {
      onCreate(draft);
      // Closed on the way out, not on the way back: these props carry no
      // result, so the list is what confirms the write and the error strip is
      // what reports a failure.
      setEditing(null);
    },
    [onCreate],
  );

  if (!open) return null;

  /**
   * Looked up rather than stored, so a refresh that deletes the trip out from
   * under an open editor or an open dialog closes it instead of leaving either
   * pointed at something that is gone.
   */
  const editingTrip =
    editing?.mode === "edit"
      ? (trips.find((t) => t.id === editing.id) ?? null)
      : null;
  const deleting = pendingDeleteId
    ? (trips.find((t) => t.id === pendingDeleteId) ?? null)
    : null;

  return (
    <div className="fixed inset-0 z-[200] bg-bg/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trips-panel-title"
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
            id="trips-panel-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-serif italic text-2xl focus:outline-none break-words"
          >
            {dict.trips.title}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {busy && (
              <span className="text-xs font-mono text-muted">
                {dict.common.working}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.common.close}
              className="w-9 h-9 flex items-center justify-center text-2xl leading-none text-muted hover:text-fg cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">
          {error ? (
            <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
              {error}
            </p>
          ) : null}

          {trips.length === 0 ? (
            /* Not "no trips": nobody has used this feature before, so the line
               teaches what a trip is for instead of reporting an empty list. */
            <p className="text-sm text-fg/80 leading-relaxed">{dict.trips.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {trips.map((trip) =>
                editingTrip?.id === trip.id ? (
                  <li key={trip.id} className="py-4">
                    <TripForm
                      key={trip.id}
                      heading={dict.trips.editTrip}
                      initial={{
                        label: trip.label,
                        timeZone: trip.timeZone,
                        startDate: trip.startDate,
                        endDate: trip.endDate,
                      }}
                      submitLabel={dict.common.save}
                      busy={busy}
                      studioTz={studioTz}
                      viewerTz={viewerTz}
                      dict={dict}
                      onSubmit={(draft) => {
                        onUpdate(trip.id, draft);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={trip.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm break-words">{trip.label}</span>
                      {/* The dates first, because that is what the row is
                          scanned for, and the zone after: it is the thing the
                          trip DOES, but only once the days are the right ones. */}
                      <span className="font-mono text-[10px] text-muted break-words">
                        {trip.startDate} → {trip.endDate} · {trip.timeZone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: "edit", id: trip.id })}
                        disabled={busy}
                        aria-label={dict.trips.editOne.replace("{label}", trip.label)}
                        className={`${ROW_ACTION} text-muted hover:text-fg`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(trip.id)}
                        disabled={busy}
                        aria-label={dict.trips.deleteOne.replace(
                          "{label}",
                          trip.label,
                        )}
                        className={`${ROW_ACTION} text-muted hover:text-red-400`}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}

          {editing?.mode === "new" ? (
            <TripForm
              key="new"
              heading={dict.trips.newTrip}
              /*
               * The zone the calendar is being read in, not the studio's. It is
               * never the worse guess of the two — planning a trip from home
               * they are the same value, and recording one from Berlin while
               * standing in it, this one is already the right answer.
               */
              initial={{
                label: "",
                timeZone: viewerTz,
                startDate: "",
                endDate: "",
              }}
              submitLabel={dict.common.add}
              busy={busy}
              studioTz={studioTz}
              viewerTz={viewerTz}
              dict={dict}
              onSubmit={submitNew}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setEditing({ mode: "new" })}
                disabled={busy}
                className={OUTLINE_ACTION}
              >
                {dict.trips.newTrip}
              </button>
            </div>
          )}
        </div>
      </div>

      {deleting ? (
        /* The only control in here that asks. Adding a trip or moving its
           dates is reversible by doing it again; deleting one is not, and its
           body's whole job is to say that no booking moves either way. */
        <ConfirmDialog
          open
          title={dict.trips.deleteTitle}
          body={dict.trips.deleteConfirm.replace("{label}", deleting.label)}
          confirmLabel={dict.common.delete}
          cancelLabel={dict.common.cancel}
          onConfirm={() => {
            setPendingDeleteId(null);
            onDelete(deleting.id);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      ) : null}
    </div>
  );
}
