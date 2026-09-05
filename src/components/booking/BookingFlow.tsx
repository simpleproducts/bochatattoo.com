"use client";
/**
 * The private booking page's whole client tree: the shell, the step machine,
 * and the only two writes a reader can make.
 *
 * Three rules shape everything below.
 *
 * 1. The `PublicBookingView` in state is only ever REPLACED by the body of a
 *    successful POST, and is never refetched. Both routes answer with the view
 *    they just committed, so a re-read could only ever be staler — and a
 *    booking that has just gone green must never flicker back to yellow
 *    because a second request landed out of order.
 * 2. The step the reader lands on is DERIVED from that view, not counted up
 *    from zero. Someone who finished last week and reopens the link sees the
 *    confirmed panel; they are never shown the form again.
 * 3. Consent precedes data. `Continue` opens the terms modal and sends
 *    nothing; the modal's confirm is what posts details and acceptance
 *    together, which is also how the record makes "details submitted, terms
 *    not accepted" unrepresentable.
 *
 * The sessionStorage draft is insurance against a dropped connection or a
 * fat-fingered reload, not state: read once in the first render after
 * hydration (reading it in the hydrating render would desync the SSR pass),
 * rewritten on change, and dropped the moment the server has the data.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Dictionary } from "@/i18n/types";
import type { PublicBookingView } from "@/lib/bookings-types";
import {
  EMAIL_RE,
  HONEYPOT_FIELD,
  IG_RE,
  NOTE_MAX,
  PHONE_RE,
  RECEIPT_CLIENT_MAX_BYTES,
  RECEIPT_MAX_BYTES,
  normalizeEmail,
  normalizeInstagram,
} from "@/lib/bookings-types";
import { TERMS_VERSION } from "@/lib/booking-terms";
import {
  draftKey,
  errorMessage,
  networkMessage,
  readBookingError,
  type BookingFlowProps,
  type BookingStep,
  type DetailsErrors,
  type DetailsValues,
  type UploadPhase,
} from "./contract";
import { downscaleImage } from "./downscale";
import { AppointmentCard } from "./AppointmentCard";
import { BookingHeader } from "./BookingHeader";
import { ConfirmedPanel } from "./ConfirmedPanel";
import { DetailsForm } from "./DetailsForm";
import { PaymentDetails } from "./PaymentDetails";
import { ProgressRail } from "./ProgressRail";
import { ReceiptUploader } from "./ReceiptUploader";
import { TermsModal } from "./TermsModal";

const FIELDS = ["name", "email", "instagram", "phone", "note"] as const;

type Seed = PublicBookingView["seed"];

/**
 * Seed values win over everything, including a restored draft. Those fields
 * render read-only, so any other value in them could only have come from a
 * stale draft or a hand-edited store — never from the reader.
 */
function withSeed(values: DetailsValues, seed: Seed): DetailsValues {
  return {
    ...values,
    name: seed.name?.trim() || values.name,
    email: seed.email?.trim() || values.email,
    instagram: seed.instagram?.trim() || values.instagram,
    phone: seed.phone?.trim() || values.phone,
  };
}

function initialValues(view: PublicBookingView): DetailsValues {
  const c = view.client;
  return withSeed(
    {
      name: c.name ?? "",
      email: c.email ?? "",
      instagram: c.instagram ?? "",
      phone: c.phone ?? "",
      note: c.note ?? "",
    },
    view.seed,
  );
}

/** The whole reason a reader never re-does work the server already has. */
function initialStep(view: PublicBookingView): BookingStep {
  if (view.termsAccepted && view.receipt) return "done";
  if (view.termsAccepted) return "receipt";
  return "details";
}

function mergeDraft(current: DetailsValues, raw: unknown): DetailsValues {
  if (typeof raw !== "object" || raw === null) return current;
  const draft = raw as Partial<Record<keyof DetailsValues, unknown>>;
  const next: DetailsValues = { ...current };
  for (const field of FIELDS) {
    const value = draft[field];
    if (typeof value === "string") next[field] = value;
  }
  return next;
}

/**
 * One field's message, or undefined. The same function serves blur and submit.
 *
 * Name and email are the only two required fields, which is exactly what
 * `POST .../submit` enforces — the handle is optional on both sides. It used to
 * be demanded here whenever the studio had seeded only an email, and since the
 * page offers no way past a field it refuses to accept, a client with no
 * Instagram account could not complete their booking at all. Nothing was gained
 * by it: the seed is not rewritable from this page, so a handle the studio
 * already has would have been re-typed for nothing, and every mail this feature
 * sends goes to the email address that is still mandatory.
 */
function fieldError(
  field: keyof DetailsValues,
  values: DetailsValues,
  dict: Dictionary,
): string | undefined {
  const f = dict.booking.form;
  const value = values[field].trim();
  switch (field) {
    case "name":
      return value ? undefined : f.nameRequired;
    case "email":
      if (!value) return f.emailRequired;
      return EMAIL_RE.test(normalizeEmail(value)) ? undefined : f.invalidEmail;
    case "instagram":
      // Optional, but still a handle when it is there — the route answers
      // `invalid-instagram` for a malformed one, and catching it here keeps
      // that a field message rather than a submit failure.
      if (!value) return undefined;
      return IG_RE.test(normalizeInstagram(value))
        ? undefined
        : f.invalidInstagram;
    case "phone":
      if (!value) return undefined;
      return PHONE_RE.test(value) ? undefined : f.invalidPhone;
    case "note":
      return undefined;
  }
}

function validateAll(values: DetailsValues, dict: Dictionary): DetailsErrors {
  const found: DetailsErrors = {};
  for (const field of FIELDS) {
    const message = fieldError(field, values, dict);
    if (message) found[field] = message;
  }
  return found;
}

/**
 * "Has this tree hydrated yet" is a fact about the runtime, not state. The
 * server snapshot is false, so SSR and the hydrating render agree; React then
 * re-renders once with true, and THAT render is the first one allowed to look
 * at sessionStorage.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** The parsed draft stored under `key`, or undefined when there is none to apply. */
function readDraft(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    // Private mode, a full quota, or a hand-edited value. The draft is a
    // convenience; losing it is not worth a broken page.
    return undefined;
  }
}

function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Private mode or a locked-down browser. There was nothing to lose.
  }
}

export function BookingFlow({
  view: served,
  token,
  locale,
  dict,
}: BookingFlowProps) {
  const [view, setView] = useState<PublicBookingView>(served);
  const [step, setStep] = useState<BookingStep>(() => initialStep(served));
  const [values, setValues] = useState<DetailsValues>(() =>
    initialValues(served),
  );
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Bumped on every successful submit so a re-submit still scrolls. */
  const [advanced, setAdvanced] = useState(0);

  const seed = view.seed;
  const key = draftKey(view.id);
  const receiptRef = useRef<HTMLDivElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Restore in the first render AFTER hydration, never in the hydrating one:
  // the server has no sessionStorage and a draft-shaped first render would not
  // match the HTML it sent. `mounted` is what keeps those two passes identical.
  // Adjusting state during that render rather than from an effect is React's
  // documented shape for this, and it paints the restored draft in the same
  // commit instead of one frame after the empty form.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const restored = restoredKey === key;
  if (mounted && !restored) {
    setRestoredKey(key);
    const parsed = readDraft(key);
    if (parsed !== undefined) {
      setValues((current) => withSeed(mergeDraft(current, parsed), served.seed));
    }
  }

  // Gated on `restored` for the same reason the flag exists at all: this runs
  // on every `values` change, and a pass that ran before the restore would
  // overwrite the stored draft with the empty form it was meant to refill.
  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(values));
    } catch {
      // Same as above — a draft that cannot be saved simply is not saved.
    }
  }, [key, values, restored]);

  // An in-flight upload outlives nothing: leaving the page cancels it.
  useEffect(() => () => xhrRef.current?.abort(), []);

  useEffect(() => {
    if (advanced === 0) return;
    const el = receiptRef.current;
    if (!el) return;
    // Focus deliberately stays put — the progress rail is the live region that
    // announces the move — so the scroll is the only signal a sighted reader
    // gets, and it has to respect the OS setting.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [advanced]);

  const onValuesChange = useCallback(
    (next: DetailsValues) => {
      // Not validation-on-keystroke: a message about a field the reader is
      // actively fixing is noise. It comes back on blur if it still applies.
      setErrors((prev) => {
        const kept: DetailsErrors = {};
        for (const field of FIELDS) {
          const message = prev[field];
          if (message && next[field] === values[field]) kept[field] = message;
        }
        return kept;
      });
      setValues(next);
    },
    [values],
  );

  const onBlurField = useCallback(
    (field: keyof DetailsValues) => {
      const message = fieldError(field, values, dict);
      setErrors((prev) => {
        const next: DetailsErrors = { ...prev };
        next[field] = message;
        return next;
      });
    },
    [values, dict],
  );

  const onContinue = useCallback(() => {
    const found = validateAll(values, dict);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSubmitError(null);
    setTermsOpen(true);
  }, [values, dict]);

  const onAccept = useCallback(async () => {
    if (busy) return;
    const found = validateAll(values, dict);
    if (Object.keys(found).length > 0) {
      // Autofill or a second tab changed a value while the modal was open.
      // Send the reader back to the field rather than to a server error.
      setErrors(found);
      setTermsOpen(false);
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      // The honeypot is uncontrolled and lives inside DetailsForm: keeping it
      // out of DetailsValues is what stops the draft from persisting — and
      // then replaying — whatever a bot typed into it.
      const trap = document.querySelector<HTMLInputElement>(
        `input[name="${HONEYPOT_FIELD}"]`,
      );

      const body: Record<string, unknown> = {
        name: values.name.trim(),
        email: normalizeEmail(values.email),
        locale,
        acceptTerms: true,
        termsVersion: TERMS_VERSION,
        [HONEYPOT_FIELD]: trap?.value ?? "",
      };
      // Optional fields are omitted rather than sent empty: "" would have to
      // clear a value the studio may have filled in.
      const instagram = normalizeInstagram(values.instagram);
      if (instagram) body.instagram = instagram;
      const phone = values.phone.trim();
      if (phone) body.phone = phone;
      const note = values.note.trim();
      if (note) body.note = note.slice(0, NOTE_MAX);

      const res = await fetch(`/api/booking/${token}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setSubmitError(await readBookingError(res, dict));
        return;
      }

      let next: PublicBookingView | null = null;
      try {
        const data = (await res.json()) as { view?: PublicBookingView };
        next = data.view ?? null;
      } catch {
        next = null;
      }
      if (!next) {
        setSubmitError(dict.booking.errors.generic);
        return;
      }

      clearDraft(key);
      setView(next);
      setTermsOpen(false);
      setStep(next.receipt ? "done" : "receipt");
      setAdvanced((n) => n + 1);
    } catch {
      setSubmitError(networkMessage(dict));
    } finally {
      setBusy(false);
    }
  }, [busy, values, dict, locale, token, key]);

  const onEdit = useCallback(() => {
    setSubmitError(null);
    setStep("details");
  }, []);

  const onUpload = useCallback(
    async (file: File) => {
      if (phase === "uploading" || phase === "verifying") return;
      // The guard above reads `phase` out of this closure, which a second file
      // picked in the same tick still sees as "idle". The ref is the runtime
      // truth, so whatever is still in flight loses to the newer pick: an
      // orphaned XHR is not cancelled by being forgotten, and its `onload`
      // could land last and overwrite the view with the receipt the reader
      // just replaced.
      xhrRef.current?.abort();
      setUploadError(null);
      setProgress(0);
      setPhase("uploading");

      const tooLarge = () => {
        setPhase("error");
        setUploadError(dict.booking.errors.tooLarge);
      };

      // Above this, decoding the image would cost more than it can ever save.
      if (file.size > RECEIPT_CLIENT_MAX_BYTES) {
        tooLarge();
        return;
      }
      // downscale.ts names ReceiptUploader as its caller, so a file arriving
      // here is normally already shrunk; re-running it only on an oversized
      // one costs nothing in the common case and is the difference between a
      // working upload and "that file is too large" in the uncommon one.
      let prepared = file;
      if (prepared.size > RECEIPT_MAX_BYTES) {
        prepared = await downscaleImage(prepared);
      }
      if (prepared.size > RECEIPT_MAX_BYTES) {
        tooLarge();
        return;
      }

      const body = new FormData();
      body.append("file", prepared, prepared.name);
      body.append("locale", locale);
      body.append(HONEYPOT_FIELD, "");

      // The only XMLHttpRequest in this codebase, for one narrow reason:
      // fetch() still cannot report upload progress, and a receipt photo on a
      // phone connection is exactly where a progress bar earns its keep.
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", `/api/booking/${token}/receipt`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      // The bytes are gone; what is left is the server sniffing and storing
      // them, which is a wait with no progress to report.
      xhr.upload.onload = () => {
        setProgress(100);
        setPhase("verifying");
      };
      xhr.onabort = () => {
        xhrRef.current = null;
      };
      xhr.onerror = () => {
        xhrRef.current = null;
        setPhase("error");
        setUploadError(networkMessage(dict));
      };
      xhr.onload = () => {
        xhrRef.current = null;
        let parsed: { view?: PublicBookingView; error?: string } | null = null;
        try {
          parsed = JSON.parse(xhr.responseText) as {
            view?: PublicBookingView;
            error?: string;
          };
        } catch {
          parsed = null;
        }

        // A refusal that still carries a view is the server saying the record
        // is already further along than this page is — the 409 `booking-locked`
        // a client gets when their first upload committed but the response
        // never reached them. Adopting it is the only way out: rule 1 above
        // means this page never refetches, so without this the reader stays on
        // "this appointment is already confirmed", in red, under a receipt-
        // missing rail, for every retry. The status only decides whether there
        // is anything to show; the view decides what.
        if (!parsed?.view) {
          setPhase("error");
          setUploadError(errorMessage(parsed?.error ?? null, dict));
          return;
        }

        clearDraft(key);
        setView(parsed.view);
        setPhase("done");
        setStep("done");
      };

      xhr.send(body);
    },
    [phase, dict, locale, token, key],
  );

  const onReset = useCallback(() => {
    setUploadError(null);
    setProgress(0);
    setPhase("idle");
  }, []);

  // The modal is a layer over the details step, not a step of its own — but it
  // is a distinct one to the rail, which is the reader's map of the flow.
  const railStep: BookingStep = termsOpen ? "terms" : step;
  const summaryName = view.client.name || values.name;
  const summaryEmail = view.client.email || values.email;

  return (
    /* tabIndex -1 makes this focusable by script only, never by Tab. It is the
       landing spot TermsModal restores focus to when the control that opened
       it no longer exists — confirming advances the step and unmounts the
       whole details form, Continue button included, in the same commit. No
       ring: nobody can reach it with a keyboard, so a ring here would only
       ever be noise after a programmatic focus. */
    <main
      tabIndex={-1}
      className="max-w-md mx-auto px-6 py-10 md:py-16 flex flex-col gap-8 focus:outline-none"
    >
      <BookingHeader token={token} locale={locale} dict={dict} />
      <AppointmentCard view={view} locale={locale} dict={dict} />
      <ProgressRail step={railStep} dict={dict} />

      {step === "done" ? (
        <ConfirmedPanel view={view} locale={locale} dict={dict} />
      ) : (
        <>
          {step === "details" ? (
            <DetailsForm
              values={values}
              errors={errors}
              seed={seed}
              busy={busy}
              dict={dict}
              onChange={onValuesChange}
              onBlurField={onBlurField}
              onContinue={onContinue}
            />
          ) : (
            <section className="border border-line p-4 flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {dict.booking.form.savedSummary}
                </p>
                {/* Wraps rather than truncates. This is the address the
                    confirmation is going to, and Edit is a one-way door back
                    through the whole terms gate — a reader who cannot read
                    their own email here has no cheap way to check it. */}
                <p className="text-sm break-words">
                  {summaryName} <span className="text-muted">·</span>{" "}
                  {summaryEmail}{" "}
                  <span className="text-status-done" aria-hidden>
                    ✓
                  </span>
                </p>
              </div>
              {/* py-4/-my-4 cancel out, so the label sits exactly where it did
                  while the tap target is a full 44px tall; -mr-3 keeps its
                  right edge on the section's padding. Padding, never a bigger
                  font: this is a secondary control and must still read like
                  one. */}
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 -my-4 -mr-3 flex min-h-[44px] items-center px-3 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-fg transition-colors cursor-pointer"
              >
                {dict.booking.form.edit}
              </button>
            </section>
          )}

          {step === "receipt" ? (
            <div ref={receiptRef} className="flex flex-col gap-8">
              <PaymentDetails view={view} dict={dict} />
              <ReceiptUploader
                locale={locale}
                dict={dict}
                phase={phase}
                progress={progress}
                error={uploadError}
                existing={view.receipt}
                onUpload={onUpload}
                onReset={onReset}
              />
            </div>
          ) : null}
        </>
      )}

      <TermsModal
        open={termsOpen}
        locale={locale}
        dict={dict}
        busy={busy}
        error={submitError}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          void onAccept();
        }}
      />
    </main>
  );
}
