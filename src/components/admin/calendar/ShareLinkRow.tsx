"use client";
/**
 * The permanent private link for one booking.
 *
 * The token is an HMAC over immutable data, so the server re-derives it on
 * every read: this block is never a "shown once" secret and re-opening the
 * sheet next month shows the same link. Copy is therefore a convenience, not
 * the last chance to keep it.
 *
 * SHARE only renders after mount. `"share" in navigator` is false on the
 * server and true on a phone, so rendering it during SSR would hydrate-mismatch
 * — the button arriving one frame late is much the cheaper of the two costs.
 *
 * TWO languages meet in this one block and they are not the same choice. The
 * chrome — COPY, SHARE, ROTATE LINK — is admin copy and follows `dict`, i.e.
 * the cookie the studio set for itself. `MAIL_COPY` below is outbound CLIENT
 * copy, and it follows the ES·EN toggle in this block, which is the reader of
 * the link speaking, not its sender. An Argentine admin mailing an English
 * client must get a Spanish button and an English email, so these two must
 * never be collapsed into one.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import type { ShareLinkRowProps } from "./contract";

/** From the sheet, which got it from the page's server render. */
type Props = ShareLinkRowProps & { dict: AdminDictionary };

/**
 * Web Share is a browser capability, not React state: it is false on the
 * server and fixed for the life of the tab. `useSyncExternalStore` is the
 * hook that exists precisely to read one of those without an effect —
 * `getServerSnapshot` keeps SSR and the first client render agreeing, then
 * React re-renders once with the real answer.
 */
const subscribeNever = () => () => {};
const hasWebShare = () => "share" in navigator;
const noWebShare = () => false;

const ACTION =
  "border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-fg transition-colors disabled:opacity-40 cursor-pointer";

const MAIL_COPY: Record<"es" | "en", { subject: string; intro: string }> = {
  es: {
    subject: "Tu turno · Bocha Tattoo",
    intro: "Hola! Este es tu link privado para confirmar el turno:",
  },
  en: {
    subject: "Your appointment · Bocha Tattoo",
    intro: "Hi! This is your private link to confirm the appointment:",
  },
};

/**
 * Clipboard with the pre-permission fallback. `navigator.clipboard` needs a
 * secure context and can still reject (a denied permission, Safari outside a
 * user gesture), so the deprecated execCommand path stays as the second try.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea path rather than reporting a failure the
    // admin can still work around by copying the selection by hand.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function ShareLinkRow({ appt, busy, onRotate, dict }: Props) {
  const [linkLocale, setLinkLocale] = useState<"es" | "en">("es");
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(subscribeNever, hasWebShare, noWebShare);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const link = appt.links[linkLocale];
  const copy = MAIL_COPY[linkLocale];
  const mailto = `mailto:${appt.seed.email ?? ""}?subject=${encodeURIComponent(
    copy.subject,
  )}&body=${encodeURIComponent(`${copy.intro}\n\n${link}\n`)}`;

  async function onCopy() {
    await writeClipboard(link);
    // Leave the link selected either way: when the clipboard is refused, the
    // admin can still press Cmd-C on a selection they can see.
    inputRef.current?.focus();
    inputRef.current?.select();
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  async function onShare() {
    try {
      await navigator.share({ url: link });
    } catch (err) {
      // Dismissing the OS sheet reports AbortError. That is a decision, not a
      // failure, and it must not surface as one.
      if ((err as Error)?.name !== "AbortError") console.error(err);
    }
  }

  function onWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function onRotateClick() {
    const ok = window.confirm(dict.calendar.link.rotateConfirm);
    if (ok) onRotate();
  }

  return (
    <div className="border border-line p-4 flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {dict.calendar.link.title}
      </p>

      <input
        ref={inputRef}
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={dict.calendar.link.inputLabel.replace(
          "{locale}",
          linkLocale.toUpperCase(),
        )}
        className="bg-transparent border border-line px-2 py-2 font-mono text-[11px] w-full"
      />

      {/* The live region wraps the buttons so the COPY -> COPIED flip is
          announced; a visual-only confirmation would leave a screen reader
          with no idea whether the press worked. */}
      <div className="flex gap-2 flex-wrap" aria-live="polite">
        <button type="button" onClick={onCopy} className={ACTION}>
          {copied ? dict.calendar.link.copied : dict.calendar.link.copy}
        </button>
        {canShare && (
          <button type="button" onClick={onShare} className={ACTION}>
            {dict.calendar.link.share}
          </button>
        )}
        <button type="button" onClick={onWhatsApp} className={ACTION}>
          {dict.calendar.link.whatsapp}
        </button>
        <a href={mailto} className={ACTION}>
          {dict.common.email}
        </a>
      </div>

      <div className="flex gap-2 font-mono text-[10px] uppercase tracking-[0.3em]">
        <button
          type="button"
          onClick={() => setLinkLocale("es")}
          aria-pressed={linkLocale === "es"}
          className={
            linkLocale === "es"
              ? "text-fg cursor-pointer"
              : "text-muted hover:text-fg cursor-pointer"
          }
        >
          ES
        </button>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => setLinkLocale("en")}
          aria-pressed={linkLocale === "en"}
          className={
            linkLocale === "en"
              ? "text-fg cursor-pointer"
              : "text-muted hover:text-fg cursor-pointer"
          }
        >
          EN
        </button>
      </div>

      <button
        type="button"
        onClick={onRotateClick}
        disabled={busy}
        className="mt-2 border border-red-400 text-red-400 px-2 py-1 uppercase tracking-[0.2em] font-mono text-[10px] hover:bg-red-400 hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
      >
        {dict.calendar.link.rotate}
      </button>
    </div>
  );
}
