"use client";
/**
 * The one place the admin offers to become a home-screen app.
 *
 * Bocha runs the studio from a phone. The whole point of this component is
 * that he stops hunting for a tab — so it has to appear on the screen he opens
 * first, say the one thing that gets him there, and then never ask again.
 *
 * There is NO service worker behind any of this, on purpose. An installed
 * admin is still an online admin: every booking on the calendar is read live
 * from R2, and a cached calendar that shows an appointment which was deleted —
 * or hides one that was just made — is worse than a screen that says it could
 * not load. A future hand reaching for `next-pwa` or a `sw.js` to "make the
 * install work" should know that neither iOS nor a modern Chrome requires one:
 * a manifest over HTTPS is enough, and the cache is the part that would cost
 * something real.
 *
 * Two browsers, two completely different routes:
 *
 *  - Chrome/Edge/Android fire `beforeinstallprompt`. The event is the install:
 *    it is captured, its own mini-infobar suppressed, and replayed from the
 *    button below.
 *  - iOS Safari fires nothing and exposes no API at all. The only route is the
 *    share sheet, so all this can do is name the two rows to tap.
 *
 * Everything a browser might be that is neither of those gets NOTHING. A wrong
 * guess here is not a missing button, it is an instruction sending the
 * operator into a menu that does not contain what it promises, so the iOS test
 * below excludes anything it cannot positively identify.
 *
 * Hydration: nothing here can be answered on the server — not the display
 * mode, not the user agent, not the dismissal in storage — so every one of
 * those reads goes through `useSyncExternalStore` with a server snapshot, or
 * behind the same `mounted` gate AdminCalendar uses for the viewer's timezone.
 * The component renders `null` until it is mounted, which is exactly what the
 * server rendered.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import type { AdminDictionary } from "@/i18n/admin";

/** Namespaced like the calendar's own keys in calendar/contract.ts. */
const DISMISS_STORAGE_KEY = "ba_admin_install_dismissed";

const STANDALONE_MQ = "(display-mode: standalone)";

/**
 * `beforeinstallprompt` is not in lib.dom, so the shape is declared here rather
 * than asserted away. Intersecting with `Event` is what keeps the cast in the
 * listener below a narrowing one instead of a lie.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* ── the captured install event, as an external store ── */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function announcePrompt(): void {
  for (const notify of promptListeners) notify();
}

/**
 * Armed when this MODULE is imported, not when the component mounts.
 *
 * `beforeinstallprompt` fires once and early — routinely before React has
 * hydrated this tree — and a listener added in an effect would simply never
 * hear it, leaving the install button permanently absent on the one family of
 * browsers that can actually install. Module scope is the earliest hook the
 * component's own file gets. The import is confined to the admin bundle, so
 * the public marketing site never installs this listener and stays
 * uninstallable.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    // Preventing the event is what suppresses Chrome's own mini-infobar. That
    // banner cannot be dismissed for good, which is the single thing this
    // feature has to get right.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    announcePrompt();
  });
  window.addEventListener("appinstalled", () => {
    // The event is spent the moment the install lands; an offer that can no
    // longer be replayed must not stay on screen.
    deferredPrompt = null;
    announcePrompt();
  });
}

function subscribePrompt(onChange: () => void): () => void {
  promptListeners.add(onChange);
  return () => {
    promptListeners.delete(onChange);
  };
}

const readPrompt = (): BeforeInstallPromptEvent | null => deferredPrompt;
const readPromptOnServer = (): BeforeInstallPromptEvent | null => null;

/** A `beforeinstallprompt` event can only be replayed once. */
function clearPrompt(): void {
  deferredPrompt = null;
  announcePrompt();
}

/* ── already installed? ── */

/**
 * The display mode genuinely changes — a tab can be handed to the installed
 * window — so it is subscribed to rather than read once.
 */
function subscribeInstalled(onChange: () => void): () => void {
  const mq = window.matchMedia(STANDALONE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function readInstalled(): boolean {
  if (window.matchMedia(STANDALONE_MQ).matches) return true;
  // iOS only started answering `display-mode` in 16.4. Every phone older than
  // that reports an installed web app through this non-standard flag and
  // through nothing else, so both have to be asked.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

const readInstalledOnServer = (): boolean => false;

/* ── the iOS share-sheet route ── */

/**
 * Deliberately narrow, and false whenever it is unsure.
 *
 * All this gates is a sentence naming two rows in Safari's share sheet. A
 * false positive sends the operator looking for a menu item his browser does
 * not have, which is worse than showing him nothing at all — so anything that
 * is not plainly Safari on iOS is treated as "no affordance".
 */
function readIosSafari(): boolean {
  const nav = window.navigator;
  const ua = nav.userAgent;
  // iPadOS 13+ reports itself as a Mac. A Mac with a touchscreen is the only
  // tell left, and there is no such Mac.
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && nav.maxTouchPoints > 1);
  if (!ios) return false;
  // Every iOS browser is WebKit, so "is this Safari" cannot be asked of the
  // engine, only of the shell. These put Add to Home Screen somewhere else or
  // nowhere at all, so they are excluded rather than mis-instructed.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram/.test(ua);
}

/* ── the mounted gate, the same pair AdminCalendar uses ── */

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Read in a lazy initialiser rather than an effect — this repo lints
 * setState-inside-useEffect as an error — and defended on the read as well as
 * the write, because private mode throws on both. A throw is answered with
 * "not dismissed": a bar that comes back is a far smaller failure than an
 * admin screen that will not render.
 */
function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallPrompt({ dict }: { dict: AdminDictionary }) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const installed = useSyncExternalStore(
    subscribeInstalled,
    readInstalled,
    readInstalledOnServer,
  );
  const prompt = useSyncExternalStore(
    subscribePrompt,
    readPrompt,
    readPromptOnServer,
  );
  const [dismissed, setDismissed] = useState(readDismissed);

  const onDismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      // Private mode. The bar stays gone for this session, which is the whole
      // of what this click promised for the next few minutes.
    }
  }, []);

  const onInstall = useCallback(() => {
    if (!prompt) return;
    // The async body runs synchronously as far as the first await, so
    // `prompt.prompt()` is still inside the click — browsers refuse it
    // otherwise.
    void (async () => {
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch (err) {
        // A replay the browser refuses (already installed elsewhere, event
        // gone stale) is not worth an error strip over the calendar.
        console.error("admin/install: the browser refused the prompt", err);
      } finally {
        clearPrompt();
      }
    })();
  }, [prompt]);

  // Short-circuited on `mounted` so the user-agent sniff never runs during SSR
  // or the hydrating render, and only consulted when there is no real prompt
  // to replay — an event beats an instruction wherever both could apply.
  const iosSafari = mounted && prompt === null && readIosSafari();

  if (!mounted || installed || dismissed) return null;
  if (prompt === null && !iosSafari) return null;

  return (
    /*
      `mb-24` clears AgendaList's fixed create bar, which floats over the very
      bottom of the document. Without it this bar is the one thing on the page
      that is permanently hidden behind another.
    */
    <aside className="mb-24 border border-line px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {dict.install.title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {prompt !== null ? (
          <button
            type="button"
            onClick={onInstall}
            className="border border-fg px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-fg hover:text-bg transition-colors cursor-pointer"
          >
            {dict.install.action}
          </button>
        ) : (
          // Sentence case, not the 10px uppercase micro-label the rest of the
          // bar wears: this one is read as a sentence and followed, not
          // glanced at.
          <p className="text-xs text-fg/80">{dict.install.ios}</p>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-fg cursor-pointer"
        >
          {dict.install.dismiss}
        </button>
      </div>
    </aside>
  );
}
