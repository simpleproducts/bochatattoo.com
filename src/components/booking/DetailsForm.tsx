"use client";
/**
 * Step one: the five fields, and the button that does not submit them.
 *
 * Three things here are load-bearing and easy to "tidy" into a bug:
 *
 * 1. The input class carries `text-base md:text-sm`. iOS Safari zooms the
 *    whole viewport in when an input with a computed font-size under 16px
 *    takes focus, and it never zooms back out — every field below the fold
 *    then sits off-screen for the rest of the session. `text-sm` alone looks
 *    tidier and breaks this form on the most common device it will ever be
 *    opened on. It is not a style choice.
 * 2. The submit button OPENS THE TERMS MODAL. It sends nothing. Consent is
 *    collected before the data it governs leaves the device, which is also why
 *    the route writes details and acceptance in a single atomic request.
 * 3. Fields the studio pre-filled arrive in `seed` and render read-only. The
 *    client fills in what is missing and can never silently rewrite what Bocha
 *    typed — and the server keeps client input in `client`, separate from
 *    `seed`, regardless of what arrives here.
 *
 * Validation lives in the parent and runs on blur and on submit, never on
 * keystroke: telling someone their email is invalid while they are still
 * halfway through typing it is noise, not help.
 */
import { useId, type ChangeEvent, type FormEvent } from "react";
import {
  EMAIL_MAX,
  HONEYPOT_FIELD,
  NAME_MAX,
  NOTE_MAX,
} from "@/lib/bookings-types";
import type { DetailsFormProps, DetailsValues } from "./contract";

const INPUT =
  "bg-transparent border border-line px-3 py-2 text-base md:text-sm focus:outline-none focus:border-fg";
/** Same box, minus the border — the Instagram row borders its wrapper instead. */
const INPUT_BARE =
  "flex-1 min-w-0 bg-transparent px-3 py-2 text-base md:text-sm focus:outline-none";
const LABEL = "flex flex-col gap-1 text-xs";
const LEGEND = "font-mono uppercase tracking-[0.2em] text-muted";
const NOTE = "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
const ERROR = "text-red-400 text-xs";
const LOCKED = "opacity-60 cursor-not-allowed";

export function DetailsForm({
  values,
  errors,
  seed,
  busy,
  dict,
  onChange,
  onBlurField,
  onContinue,
}: DetailsFormProps) {
  const uid = useId();
  const f = dict.booking.form;

  const errorId = (field: keyof DetailsValues) => `${uid}-${field}-error`;
  const noteId = (field: keyof DetailsValues) => `${uid}-${field}-note`;

  const describedBy = (
    field: keyof DetailsValues,
    hasNote: boolean,
  ): string | undefined => {
    const parts: string[] = [];
    if (hasNote) parts.push(noteId(field));
    if (errors[field]) parts.push(errorId(field));
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const change =
    (field: keyof DetailsValues) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next: DetailsValues = { ...values };
      next[field] = e.target.value;
      onChange(next);
    };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onContinue();
  };

  const nameLocked = Boolean(seed.name?.trim());
  const emailLocked = Boolean(seed.email?.trim());
  const igLocked = Boolean(seed.instagram?.trim());
  const phoneLocked = Boolean(seed.phone?.trim());

  // One note slot per field, so `aria-describedby` stays a single extra id.
  const emailNote = emailLocked ? `${f.prefilled} · ${f.emailHint}` : f.emailHint;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {f.eyebrow}
        </h2>
        <p className="text-sm leading-relaxed text-fg/80">{f.intro}</p>
      </div>

      {/* `relative` anchors the off-screen honeypot to this form rather than to
          whatever happens to be positioned further up the page. */}
      <form
        onSubmit={submit}
        noValidate
        aria-busy={busy}
        className="relative flex flex-col gap-5"
      >
        {/* NAME */}
        <label className={LABEL}>
          <span className={LEGEND}>{f.name}</span>
          <input
            type="text"
            value={values.name}
            onChange={change("name")}
            onBlur={() => onBlurField("name")}
            readOnly={nameLocked}
            maxLength={NAME_MAX}
            autoComplete="name"
            enterKeyHint="next"
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy("name", nameLocked)}
            className={nameLocked ? `${INPUT} ${LOCKED}` : INPUT}
          />
          {nameLocked ? (
            <span id={noteId("name")} className={NOTE}>
              {f.prefilled}
            </span>
          ) : null}
          {errors.name ? (
            <span id={errorId("name")} className={ERROR}>
              {errors.name}
            </span>
          ) : null}
        </label>

        {/* EMAIL — required: it is the only address the confirmation can go to. */}
        <label className={LABEL}>
          <span className={LEGEND}>{f.email}</span>
          <input
            type="email"
            inputMode="email"
            value={values.email}
            onChange={change("email")}
            onBlur={() => onBlurField("email")}
            readOnly={emailLocked}
            maxLength={EMAIL_MAX}
            autoComplete="email"
            enterKeyHint="next"
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={describedBy("email", true)}
            className={emailLocked ? `${INPUT} ${LOCKED}` : INPUT}
          />
          <span id={noteId("email")} className={NOTE}>
            {emailNote}
          </span>
          {errors.email ? (
            <span id={errorId("email")} className={ERROR}>
              {errors.email}
            </span>
          ) : null}
        </label>

        {/* INSTAGRAM — the "@" is a static span so the stored value stays bare. */}
        <label className={LABEL}>
          <span className={LEGEND}>
            {f.instagram}
            {/* Optional, like the phone, and marked so — the submit route asks
                for name and email and nothing else. A locked field says
                "prefilled" below instead, where "(optional)" would only be
                confusing about a value the reader cannot change. */}
            {igLocked ? null : (
              <>
                {" "}
                <span className="normal-case tracking-normal text-muted/70">
                  ({f.optional})
                </span>
              </>
            )}
          </span>
          <span
            className={`flex items-center border border-line focus-within:border-fg ${
              igLocked ? "opacity-60" : ""
            }`}
          >
            <span className="px-2 text-muted" aria-hidden>
              @
            </span>
            <input
              type="text"
              value={values.instagram}
              onChange={change("instagram")}
              onBlur={() => onBlurField("instagram")}
              readOnly={igLocked}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              enterKeyHint="next"
              aria-invalid={Boolean(errors.instagram) || undefined}
              aria-describedby={describedBy("instagram", igLocked)}
              className={igLocked ? `${INPUT_BARE} cursor-not-allowed` : INPUT_BARE}
            />
          </span>
          {igLocked ? (
            <span id={noteId("instagram")} className={NOTE}>
              {f.prefilled}
            </span>
          ) : null}
          {errors.instagram ? (
            <span id={errorId("instagram")} className={ERROR}>
              {errors.instagram}
            </span>
          ) : null}
        </label>

        {/* PHONE */}
        <label className={LABEL}>
          <span className={LEGEND}>
            {f.phone}{" "}
            <span className="normal-case tracking-normal text-muted/70">
              ({f.optional})
            </span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={change("phone")}
            onBlur={() => onBlurField("phone")}
            readOnly={phoneLocked}
            maxLength={24}
            autoComplete="tel"
            enterKeyHint="next"
            aria-invalid={Boolean(errors.phone) || undefined}
            aria-describedby={describedBy("phone", phoneLocked)}
            className={phoneLocked ? `${INPUT} ${LOCKED}` : INPUT}
          />
          {phoneLocked ? (
            <span id={noteId("phone")} className={NOTE}>
              {f.prefilled}
            </span>
          ) : null}
          {errors.phone ? (
            <span id={errorId("phone")} className={ERROR}>
              {errors.phone}
            </span>
          ) : null}
        </label>

        {/* MESSAGE */}
        <label className={LABEL}>
          <span className={LEGEND}>
            {f.note}{" "}
            <span className="normal-case tracking-normal text-muted/70">
              ({f.optional})
            </span>
          </span>
          <textarea
            rows={2}
            value={values.note}
            onChange={change("note")}
            onBlur={() => onBlurField("note")}
            maxLength={NOTE_MAX}
            enterKeyHint="done"
            className={INPUT}
          />
        </label>

        {/* Honeypot. Named `bt_ref` on purpose: a field called "website" or
            "company" gets autofilled by password managers, which would silently
            drop a real booking. Off-screen rather than display:none so the
            naive scrapers that skip hidden inputs still fill it in. */}
        <label
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden"
        >
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[44px] border border-fg px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
        >
          {busy ? f.sending : f.continue}
        </button>
      </form>
    </section>
  );
}
