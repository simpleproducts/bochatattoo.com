"use client";
/**
 * The composer / edit form for one appointment.
 *
 * The form speaks the wall clock the admin typed and never an instant: every
 * translation to UTC goes through `toApiSlot` in contract.ts, so a date can
 * never be converted twice or not at all.
 *
 * The zone that translation uses is a FIELD OF THIS FORM, not the calendar's.
 * Bocha books guest spots abroad, and "14:00" typed for a Berlin session means
 * 14:00 in Berlin whether it is typed from Berlin or from Buenos Aires. So the
 * zone select below is the appointment's, `viewerTz` and `studioTz` are only
 * the two shortcuts at the head of its list, and neither ever converts
 * anything.
 *
 * `initial` is read once, at mount. The sheet gives this component a key that
 * changes with the booking being edited, so a re-render of the parent can
 * never overwrite half-typed input with stale props.
 *
 * Overlaps are a WARNING and never a block. Two people in the studio at once
 * is sometimes deliberate (a touch-up during a long session), and a calendar
 * that refuses the booking Bocha actually made is a calendar he stops using.
 */
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
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
import { timeZoneOptions, type TimeZoneOption } from "@/lib/timezone-options";
import {
  DURATION_CHIPS,
  parseDeposit,
  toApiSeed,
  toApiSlot,
  type BookingFormProps,
  type BookingFormValues,
} from "./contract";

/**
 * `dict` supplies the words; `locale` is what `formatTimeRange` needs for the
 * overlap warning. Neither can be derived from the other, so both come down
 * from the sheet.
 *
 * The echo line prints the zone abbreviation again. It was dropped when every
 * time in this form was necessarily in the one zone the admin was looking at,
 * and the abbreviation then restated that on every keystroke without
 * distinguishing anything. That is no longer true: the numbers on that line
 * are in the APPOINTMENT'S zone, which during a guest spot is not the reader's,
 * and "18:00" alone no longer says which 18:00 it is.
 */
type Props = BookingFormProps & {
  dict: AdminDictionary;
  locale: Locale;
};

/**
 * Every IANA zone the runtime knows. A verbatim twin of the toolbar's hook —
 * that one is private to CalendarToolbar, and a zone select whose list came
 * from somewhere else would be the one control on this screen offering a
 * different set of zones from the one beside it.
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

const INPUT =
  "bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-fg";
const LABEL = "font-mono uppercase tracking-[0.2em] text-muted";

/**
 * "1h" · "8h" · "1h30" · "otro" — short enough to fit the whole row on a phone.
 * Only the `null` chip is a word: the rest are numerals plus an "h", which
 * reads the same in both languages.
 */
function chipLabel(minutes: number | null, dict: AdminDictionary): string {
  if (minutes === null) return dict.calendar.form.chipCustom;
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
  viewerTz,
  studioTz,
  initial,
  busy,
  error,
  submitLabel,
  others,
  onSubmit,
  onCancel,
  dict,
  locale,
}: Props) {
  const [values, setValues] = useState<BookingFormValues>(initial);
  const [attempted, setAttempted] = useState(false);
  const depositErrorId = useId();
  // The booking's own zone is passed in so editing a guest-spot booking made
  // in a zone outside the curated list still shows that zone selected.
  const zoneOptions = useZoneOptions([values.timeZone, viewerTz, studioTz]);
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
      return toApiSlot(values);
    } catch {
      return null;
    }
  }, [values]);

  /**
   * The abbreviation for the zone the wall clock above is in, read AT that
   * instant so a session either side of a DST switch is labelled CET or CEST
   * rather than whichever one today happens to be.
   */
  const slotAbbrev = slot ? zoneAbbrev(slot.startsAt, values.timeZone, locale) : "";

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <p className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words">
          {error}
        </p>
      )}

      <Field label={dict.calendar.form.date}>
        <input
          type="date"
          required
          value={values.date}
          onChange={(e) => patch({ date: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label={dict.calendar.form.starts}>
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
        <span className={LABEL}>{dict.calendar.form.lasts}</span>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={dict.calendar.form.duration}
        >
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
                {chipLabel(chip, dict)}
              </button>
            );
          })}
        </div>

        {custom && (
          <div className="flex flex-wrap items-end gap-4 pt-1">
            <label className="flex flex-col gap-1 text-xs">
              <span className={LABEL}>{dict.calendar.form.ends}</span>
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
              <span className={LABEL}>{dict.calendar.form.nextDay}</span>
            </label>
          </div>
        )}

        {/* The zone belongs on this line and nowhere else in the block: it is
            the only place the raw numbers appear, and during a guest spot they
            are not the reader's numbers. */}
        <p className="font-mono text-[10px] text-muted">
          {values.startTime || "--:--"} → {values.endTime || "--:--"}
          {values.endsNextDay ? " (+1)" : ""}
          {slotAbbrev ? ` ${slotAbbrev}` : ""} ·{" "}
          {slot ? durationLabel(slot.startsAt, slot.endsAt) : "—"}
        </p>

        {backwards && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400">
            {dict.calendar.form.endBeforeStart}
          </p>
        )}

        {/*
          `overlaps` compares instants, so the warning is already right across
          zones and needs no change. What it PRINTS is rendered in the zone
          being composed rather than in the other booking's own or the
          reader's: the point of the line is that these two sessions collide,
          and two clocks that do not visibly overlap would argue the opposite.
        */}
        {conflicts.map((o) => (
          <p
            key={o.id}
            className="font-mono text-[10px] text-status-partial break-words"
          >
            {dict.calendar.form.overlap
              .replace(
                "{range}",
                formatTimeRange(o.startsAt, o.endsAt, values.timeZone, locale),
              )
              .replace("{name}", bookingLabel(o))}
          </p>
        ))}
      </div>

      {/*
        Below the times, because the hint under it points back up at them: this
        field says which clock they are on. Same shape as the toolbar's picker
        — the two zones nobody has to think about, then everything else — so
        the two selects on this screen are learned once.
      */}
      <Field
        label={dict.calendar.form.timeZone}
        hint={
          <span className="font-mono text-[10px] text-muted">
            {dict.calendar.form.timeZoneHint}
          </span>
        }
      >
        <select
          value={values.timeZone}
          onChange={(e) => patch({ timeZone: e.target.value })}
          className={`${INPUT} cursor-pointer`}
        >
          <option value={studioTz} className="bg-bg text-fg">
            {dict.calendar.form.timeZoneStudio.replace("{tz}", studioTz)}
          </option>
          {/* Skipped when the calendar is already being read in studio hours:
              two options with the same value are one option and a puzzle. */}
          {viewerTz !== studioTz ? (
            <option value={viewerTz} className="bg-bg text-fg">
              {dict.calendar.form.timeZoneCurrent.replace("{tz}", viewerTz)}
            </option>
          ) : null}
          {zoneOptions.length > 0
            ? (["americas", "europe"] as const).map((region) => {
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
              })
            : values.timeZone !== studioTz && values.timeZone !== viewerTz ? (
                /* No list yet (pre-mount) and the booking is in a third zone.
                   Without this the select would show and report the studio while
                   the form state said Berlin — editing an existing guest-spot
                   booking would move it on save. */
                <option value={values.timeZone} className="bg-bg text-fg">
                  {values.timeZone}
                </option>
              ) : null}
        </select>
      </Field>

      {/*
        Instagram and Email are ONE requirement, not two fields that happen to
        sit together: exactly one of them has to be filled. Rendered as a
        captioned group with a shared border so the rule is stated once, above
        both inputs, instead of as a hint hanging under the second one — where
        it read as a note about the email address.
      */}
      <fieldset
        className={`flex flex-col gap-3 border p-3 ${
          attempted && !contactOk ? "border-red-400" : "border-line"
        }`}
      >
        <legend
          className={`px-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
            attempted && !contactOk ? "text-red-400" : "text-muted"
          }`}
        >
          {dict.calendar.form.contactGroup}
        </legend>

        <label className="flex flex-col gap-1 text-xs">
        <span className={LABEL}>{dict.common.instagram}</span>
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

      <Field label={dict.common.email}>
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
      </fieldset>

      <Field label={dict.common.name}>
        <input
          type="text"
          maxLength={NAME_MAX}
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          className={INPUT}
        />
      </Field>

      <Field label={dict.common.phone}>
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
            <span className={LABEL}>{dict.common.deposit}</span>
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
            aria-label={dict.calendar.form.depositCurrency}
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
            {dict.calendar.form.invalidAmount}
          </p>
        )}
      </div>

      <Field
        label={dict.calendar.form.notes}
        hint={
          <span className="font-mono text-[10px] text-muted">
            {dict.calendar.form.notesHint}
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

      {attempted && !contactOk ? (
        <p
          role="alert"
          className="border border-red-400 text-red-400 p-2 text-[10px] uppercase tracking-[0.2em] font-mono"
        >
          {dict.calendar.form.contactRequired}
        </p>
      ) : null}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          /*
           * Only `busy` disables this. Gating it on the field checks too made
           * the form silent: the button greyed out, submit never fired, and the
           * "at least one required" hint — which only turns red after an
           * attempt — could never turn red. A button that explains why it
           * refused beats one that cannot be pressed.
           */
          disabled={busy}
          className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
        >
          {busy ? dict.common.saving : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
        >
          {dict.common.cancel}
        </button>
      </div>
    </form>
  );
}
