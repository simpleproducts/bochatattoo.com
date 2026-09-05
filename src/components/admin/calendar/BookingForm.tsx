"use client";
/**
 * The composer / edit form for one appointment.
 *
 * The form speaks the wall clock the admin typed and never an instant: every
 * translation to UTC goes through `toApiSlot` in contract.ts, so a date can
 * never be converted twice or not at all. `tz` is the calendar's effective
 * zone, which is the studio zone before mount and the viewer's after.
 *
 * `initial` is read once, at mount. The sheet gives this component a key that
 * changes with the booking being edited, so a re-render of the parent can
 * never overwrite half-typed input with stale props.
 *
 * Overlaps are a WARNING and never a block. Two people in the studio at once
 * is sometimes deliberate (a touch-up during a long session), and a calendar
 * that refuses the booking Bocha actually made is a calendar he stops using.
 */
import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ADMIN_NOTES_MAX,
  CURRENCIES,
  EMAIL_MAX,
  NAME_MAX,
  bookingLabel,
  hasContact,
} from "@/lib/bookings-types";
import {
  durationLabel,
  formatTimeRange,
  overlaps,
  zoneAbbrev,
} from "@/lib/booking-time";
import {
  DURATION_CHIPS,
  parseDeposit,
  toApiSeed,
  toApiSlot,
  type BookingFormProps,
  type BookingFormValues,
} from "./contract";

const INPUT =
  "bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-fg";
const LABEL = "font-mono uppercase tracking-[0.2em] text-muted";

/** "30m" · "1h" · "1h30" · "custom" — short enough to fit seven chips on a phone. */
function chipLabel(minutes: number | null): string {
  if (minutes === null) return "custom";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

/** "HH:MM" -> minutes past midnight, or null when the input is mid-edit/empty. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Duration by the wall clock, which is what the chips represent. The echo line
 * uses the real UTC instants instead — the two disagree only across a DST
 * boundary, and there the chip label is the lie the admin asked for.
 */
function wallMinutes(v: BookingFormValues): number | null {
  const start = toMinutes(v.startTime);
  const end = toMinutes(v.endTime);
  if (start === null || end === null) return null;
  return end + (v.endsNextDay ? 1440 : 0) - start;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className={LABEL}>{label}</span>
      {children}
      {hint}
    </label>
  );
}

export function BookingForm({
  tz,
  initial,
  busy,
  error,
  submitLabel,
  others,
  onSubmit,
  onCancel,
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>(initial);
  const [attempted, setAttempted] = useState(false);
  const depositErrorId = useId();
  const [custom, setCustom] = useState(() => {
    const minutes = wallMinutes(initial);
    return minutes === null || !DURATION_CHIPS.includes(minutes);
  });

  const patch = (p: Partial<BookingFormValues>) =>
    setValues((v) => ({ ...v, ...p }));

  const minutes = wallMinutes(values);

  /**
   * The wall clock resolved to instants. `toUtcIso` throws on a half-cleared
   * date field, which is a normal keystroke, not an error worth surfacing —
   * the echo line just goes quiet until the field is whole again.
   */
  const slot = useMemo(() => {
    try {
      return toApiSlot(values, tz);
    } catch {
      return null;
    }
  }, [values, tz]);

  const conflicts = useMemo(() => {
    if (!slot) return [];
    return others.filter(
      (o) =>
        o.status !== "cancelled" &&
        overlaps(slot.startsAt, slot.endsAt, o.startsAt, o.endsAt),
    );
  }, [slot, others]);

  const contactOk = hasContact(toApiSeed(values));
  /**
   * An amount that does not parse must never reach the API: on the PATCH path
   * a missing deposit is the explicit erase, so "submit anyway" would delete
   * the client's deposit instead of saving the number the admin typed.
   */
  const depositOk = parseDeposit(values).ok;
  const backwards = slot !== null && Date.parse(slot.endsAt) <= Date.parse(slot.startsAt);

  function applyDuration(chip: number | null) {
    if (chip === null) {
      setCustom(true);
      return;
    }
    setCustom(false);
    const start = toMinutes(values.startTime);
    if (start === null) return;
    const total = start + chip;
    patch({ endTime: toClock(total), endsNextDay: total >= 1440 });
  }

  /** Moving the start drags the end with it, so a chip stays true after a nudge. */
  function onStartChange(next: string) {
    const nextStart = toMinutes(next);
    if (!custom && nextStart !== null && minutes !== null && minutes > 0) {
      const total = nextStart + minutes;
      patch({
        startTime: next,
        endTime: toClock(total),
        endsNextDay: total >= 1440,
      });
      return;
    }
    patch({ startTime: next });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (busy || !contactOk || !depositOk) return;
    onSubmit(values);
  }

  const abbrev = slot ? zoneAbbrev(slot.startsAt, tz, "en") : "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
          {error}
        </p>
      )}

      <Field label="Date">
        <input
          type="date"
          required
          value={values.date}
          onChange={(e) => patch({ date: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label="Starts">
        <input
          type="time"
          step="900"
          required
          value={values.startTime}
          onChange={(e) => onStartChange(e.target.value)}
          className={INPUT}
        />
      </Field>

      <div className="flex flex-col gap-2 text-xs">
        <span className={LABEL}>Lasts</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Duration">
          {DURATION_CHIPS.map((chip) => {
            const active = chip === null ? custom : !custom && minutes === chip;
            return (
              <button
                key={String(chip)}
                type="button"
                data-form-dirty="1"
                aria-pressed={active}
                onClick={() => applyDuration(chip)}
                className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                  active ? "border-fg text-fg" : "border-line text-muted hover:border-fg"
                }`}
              >
                {chipLabel(chip)}
              </button>
            );
          })}
        </div>

        {custom && (
          <div className="flex flex-wrap items-end gap-4 pt-1">
            <label className="flex flex-col gap-1 text-xs">
              <span className={LABEL}>Ends</span>
              <input
                type="time"
                step="900"
                value={values.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
                className={INPUT}
              />
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={values.endsNextDay}
                onChange={(e) => patch({ endsNextDay: e.target.checked })}
                className="cursor-pointer"
              />
              <span className={LABEL}>Next day</span>
            </label>
          </div>
        )}

        <p className="font-mono text-[10px] text-muted">
          {values.startTime || "--:--"} → {values.endTime || "--:--"}
          {values.endsNextDay ? " (+1)" : ""}
          {abbrev ? ` · ${abbrev}` : ""} ·{" "}
          {slot ? durationLabel(slot.startsAt, slot.endsAt) : "—"}
        </p>

        {backwards && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400">
            End must be after start
          </p>
        )}

        {conflicts.map((o) => (
          <p
            key={o.id}
            className="font-mono text-[10px] text-status-partial break-words"
          >
            ⚠ Overlaps {formatTimeRange(o.startsAt, o.endsAt, tz, "en")} ·{" "}
            {bookingLabel(o)}
          </p>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className={LABEL}>Instagram</span>
        {/* The @ is chrome, not data: the stored handle is always unprefixed,
            which is what normalizeInstagram() on the server also guarantees. */}
        <span className="flex items-center border border-line focus-within:border-fg">
          <span className="px-2 text-muted text-sm" aria-hidden>
            @
          </span>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={values.instagram}
            onChange={(e) => patch({ instagram: e.target.value.replace(/^@+/, "") })}
            className="flex-1 min-w-0 bg-transparent px-1 py-2 text-sm focus:outline-none"
          />
        </span>
      </label>

      <Field
        label="Email"
        hint={
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              attempted && !contactOk ? "text-red-400" : "text-muted"
            }`}
          >
            At least one required
          </span>
        }
      >
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={EMAIL_MAX}
          value={values.email}
          onChange={(e) => patch({ email: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label="Name">
        <input
          type="text"
          maxLength={NAME_MAX}
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label="Phone">
        <input
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => patch({ phone: e.target.value })}
          className={INPUT}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-xs flex-1 min-w-0">
            <span className={LABEL}>Deposit</span>
            <input
              type="text"
              inputMode="decimal"
              value={values.depositAmount}
              onChange={(e) => patch({ depositAmount: e.target.value })}
              aria-invalid={!depositOk}
              aria-describedby={depositOk ? undefined : depositErrorId}
              className={INPUT}
            />
          </label>
          <select
            aria-label="Deposit currency"
            value={values.depositCurrency}
            onChange={(e) => {
              // Look the value up instead of asserting it: a <select> is a
              // string input like any other, and CURRENCIES is the only list
              // that decides what a currency is.
              const next = CURRENCIES.find((c) => c === e.target.value);
              if (next) patch({ depositCurrency: next });
            }}
            className={`${INPUT} cursor-pointer`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-bg text-fg">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Shown the moment the field stops parsing rather than on submit, the
            same as the end-before-start line: the submit button is disabled
            while it is up, so without it the button looks broken. */}
        {!depositOk && (
          <p
            id={depositErrorId}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400"
          >
            Invalid amount — 50.000 or 50000,50
          </p>
        )}
      </div>

      <Field
        label="Notes"
        hint={
          <span className="font-mono text-[10px] text-muted">
            Private — never shown to the client.
          </span>
        }
      >
        <textarea
          rows={3}
          maxLength={ADMIN_NOTES_MAX}
          value={values.adminNotes}
          onChange={(e) => patch({ adminNotes: e.target.value })}
          className={`${INPUT} resize-y`}
        />
      </Field>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={busy || !contactOk || !depositOk}
          className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
