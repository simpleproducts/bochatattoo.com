"use client";
/**
 * The admin's opt-in to push notifications, at the foot of the calendar.
 *
 * Bocha already gets an email the first time a booking turns green. On a phone
 * an email is a thing you go and look at; this is the thing that taps you on
 * the shoulder. Everything below exists to make the offer HONEST — to show the
 * enable button only where pressing it can actually work, and to say something
 * true and actionable everywhere else instead.
 *
 * Five outcomes, in the order they are decided:
 *
 *  1. No NEXT_PUBLIC_VAPID_PUBLIC_KEY — the feature is not configured on this
 *     deployment. Nothing renders. A button that cannot be wired to a server
 *     is worse than no button.
 *  2. iOS, not installed to the home screen. Apple ships Web Push since 16.4
 *     but ONLY inside an installed web app, never in a browser tab — no flag,
 *     no workaround. That is a constraint the operator can actually act on, so
 *     it is spelled out rather than hidden.
 *  3. The browser has no Push API at all. Nothing renders.
 *  4. Permission already DENIED. An explanation, and NO button: the browser
 *     will never prompt again, so a control that silently does nothing every
 *     time it is pressed is worse than none. The way back is the browser's own
 *     site settings, which is what the sentence names.
 *  5. Supported. The enable control, or — once a subscription exists — the way
 *     to turn it back off.
 *
 * The service worker is registered HERE and only here, on the first successful
 * opt-in: /admin-push-sw.js at the site root, default root scope. Registering
 * it from the layout would push it into every browser that ever loads the
 * admin, and serving it from under /admin/ would put it behind middleware's
 * `/admin/:path*` matcher, where the request takes a 302 to the login page and
 * registration fails with an error nobody would connect to the cause.
 *
 * Hydration: none of display-mode, user agent, `Notification.permission` or
 * "is there a subscription" can be answered on the server, so every branch is
 * behind the same `mounted` gate AdminCalendar and InstallPrompt use, and the
 * component renders `null` until it is mounted — which is exactly what the
 * server rendered. The store helpers below are deliberate near-duplicates of
 * InstallPrompt's: that file is about installing and this one is about
 * notifying, and neither should have to import the other to answer "am I in
 * the installed app?".
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { readError } from "@/components/admin/read-error";
import type { AdminDictionary } from "@/i18n/admin";

/** Root of the site, not /admin/ — see the note above about the 302 trap. */
const SW_URL = "/admin-push-sw.js";

/**
 * POST registers the subscription, DELETE prunes it. `/api/admin/push` and not
 * `/api/admin/push/subscribe`: the route is src/app/api/admin/push/route.ts, and
 * a wrong path here does not fail loudly — middleware's `/api/admin/:path*`
 * matcher answers an unauthenticated 401 and an authenticated one falls through
 * to Next's 404, both of which arrive as a red error strip that says nothing
 * about a URL.
 */
const SUBSCRIBE_URL = "/api/admin/push";

const STANDALONE_MQ = "(display-mode: standalone)";

/**
 * Inlined at build time by Next, so `""` here means the deployment was built
 * without the key and the whole feature is off. Read at module scope because
 * `process.env.NEXT_PUBLIC_*` must appear as a static member expression for
 * that substitution to happen at all.
 */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/* ── the mounted gate, the same pair AdminCalendar and InstallPrompt use ── */

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/* ── installed to the home screen? ── */

/** The display mode genuinely changes — a tab can be handed to the installed
 *  window — so it is subscribed to rather than read once. */
function subscribeInstalled(onChange: () => void): () => void {
  const mq = window.matchMedia(STANDALONE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function readInstalled(): boolean {
  if (window.matchMedia(STANDALONE_MQ).matches) return true;
  // iOS only started answering `display-mode` in 16.4. Every phone older than
  // that reports an installed web app through this non-standard flag alone —
  // and on those phones there is no Push API anyway, so this read only ever
  // saves us from promising an iOS install that has already happened.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

const readInstalledOnServer = (): boolean => false;

/* ── runtime facts ── */

/**
 * Any iOS device, unlike InstallPrompt's deliberately Safari-only test. That
 * one gates an instruction about Safari's share sheet, so a false positive
 * sends the operator into a menu that does not exist. This one gates a fact
 * about the PLATFORM: every browser on iOS is WebKit underneath, so none of
 * them has Web Push in a tab, and naming the home screen is right in all of
 * them.
 */
function readIos(): boolean {
  const nav = window.navigator;
  const ua = nav.userAgent;
  // iPadOS 13+ reports itself as a Mac. A Mac with a touchscreen is the only
  // tell left, and there is no such Mac.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && nav.maxTouchPoints > 1)
  );
}

/** All three, because a browser can have service workers and no Push API. */
function readSupported(): boolean {
  return (
    "serviceWorker" in window.navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Guarded for the server, where the lazy initialiser below also runs. The
 * value is never read into the output before `mounted`, so "default" here can
 * never reach the HTML.
 */
function readPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

/* ── the VAPID key, as the subscribe call wants it ── */

/**
 * `applicationServerKey` takes the RAW 65-byte uncompressed P-256 point, not
 * the base64url text the environment variable carries. `atob` only decodes
 * standard base64, so the two URL-safe substitutions and the stripped padding
 * both have to be put back before it will read a byte correctly.
 */
function decodeVapidKey(base64url: string): Uint8Array<ArrayBuffer> {
  // The buffer is spelled out in the return type rather than left as the
  // default `ArrayBufferLike`, which includes SharedArrayBuffer and is
  // therefore NOT a `BufferSource` — the exact type `applicationServerKey`
  // takes. Allocating it here proves it is a plain ArrayBuffer; saying so is
  // what lets the subscribe call below stay free of a cast.
  const pad = (4 - (base64url.length % 4)) % 4;
  const binary = window.atob(
    (base64url + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/"),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Whether an existing subscription was minted with the key this build carries.
 *
 * It matters because `subscribe()` REJECTS when a subscription already exists
 * under a different applicationServerKey, so a rotated VAPID pair would leave
 * the enable button permanently broken. Re-using a subscription bound to the
 * old key is just as bad in the other direction: the push service answers 403
 * to the new key, which is not 404 or 410, so the server correctly refuses to
 * prune it and the notification never arrives and never stops being expected.
 *
 * A browser that does not expose `options` cannot be shown to DISAGREE, and
 * throwing away a working subscription on a guess costs more than it saves, so
 * the unknown case answers "same".
 */
function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  if (bytes.length !== key.length) return false;
  return bytes.every((byte, i) => byte === key[i]);
}

/**
 * `pushManager.subscribe()` needs an ACTIVE worker. `register()` hands back a
 * registration that is still INSTALLING on the very first opt-in, and
 * subscribing against it rejects with "no active Service Worker" — a failure
 * that only ever happens on the first press, which is the one press that has
 * to work.
 */
async function waitForActive(
  reg: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return reg;
  await new Promise<void>((resolve) => {
    const onState = () => {
      // "redundant" resolves too: no event is coming after it, and the
      // subscribe below will fail with a real message rather than hang here.
      if (worker.state !== "activated" && worker.state !== "redundant") return;
      worker.removeEventListener("statechange", onState);
      resolve();
    };
    worker.addEventListener("statechange", onState);
    // The worker can have finished activating between the reads above and the
    // listener going on, in which case the event has already been and gone.
    onState();
  });
  return reg;
}

/** Root scope covers this page, so the no-argument form finds our worker. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/* ── the shell every branch renders into ── */

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="border border-line px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {title}
      </p>
      <div className="flex items-center gap-3 flex-wrap">{children}</div>
    </aside>
  );
}

/** "unknown" until the browser has been asked — see the render gate below. */
type Enrolment = "unknown" | "on" | "off";

export function PushToggle({ dict }: { dict: AdminDictionary }) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const installed = useSyncExternalStore(
    subscribeInstalled,
    readInstalled,
    readInstalledOnServer,
  );
  // Lazy initialiser rather than an effect — this repo lints
  // setState-inside-useEffect as an error — and re-read from the API after
  // every prompt, which is the only thing that can change it from in here.
  const [permission, setPermission] = useState<NotificationPermission>(
    readPermission,
  );
  const [enrolment, setEnrolment] = useState<Enrolment>("unknown");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Short-circuited on `mounted` so neither the user-agent sniff nor the
  // feature tests ever run during SSR or the hydrating render.
  const configured = VAPID_PUBLIC_KEY !== "";
  const iosInTab = mounted && readIos() && !installed;
  const supported = mounted && readSupported();
  /** Every state in which asking the browser about a subscription makes sense. */
  const usable = mounted && configured && supported && !iosInTab;

  /**
   * Read out of `dict` here rather than inside the callbacks so the dependency
   * is the string itself, which changes only when the language does.
   *
   * It is the dictionary's sentence and never `e.message`, for the reason
   * AdminCalendar's `errors.invalidSlot` is: what throws in here is the
   * browser's own DOMException — "Registration failed - push service error" —
   * which is a diagnostic for us and untranslated noise on a Spanish screen.
   * The original still reaches the console. A message from OUR api is a
   * different matter and is shown as-is, the way every other admin fetch does.
   */
  const errorText = dict.push.error;

  /* ── is there already a subscription? ── */

  /**
   * The one asynchronous question this component has to ask, and the reason
   * `enrolment` starts as "unknown": the answer lives behind two promises and
   * guessing at it would paint the enable button and then swap it for the
   * disable button a frame later.
   *
   * `getRegistration` rather than `register`: this must never INSTALL the
   * worker. The whole point of registering from a click is that a browser that
   * never opted in never receives it.
   */
  const probed = useRef(false);
  useEffect(() => {
    if (!usable || probed.current) return;
    probed.current = true;
    let alive = true;
    void (async () => {
      try {
        const sub = await currentSubscription();
        if (alive) setEnrolment(sub ? "on" : "off");
      } catch (e) {
        // A browser that refuses to answer is a browser with nothing
        // subscribed as far as anything here can tell; offering the enable
        // button is the recoverable half of the guess.
        console.error("admin/push: could not read the subscription", e);
        if (alive) setEnrolment("off");
      }
    })();
    return () => {
      alive = false;
    };
  }, [usable]);

  /* ── turning it on ── */

  const enable = useCallback(() => {
    // The async body runs synchronously as far as the first await, so
    // `requestPermission()` is still inside the click — Safari refuses a
    // permission prompt that is not.
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await Notification.requestPermission();
        // Re-read rather than trusting the resolved value: older WebKit
        // resolves this promise with `undefined` and reports the real answer
        // only on the static property.
        const state = readPermission();
        setPermission(state);
        // "denied" needs no error strip — the render below turns into the
        // explanation, which is the whole of what there is to say.
        if (state !== "granted") return;

        const reg = await waitForActive(
          await navigator.serviceWorker.register(SW_URL),
        );
        const key = decodeVapidKey(VAPID_PUBLIC_KEY);
        const existing = await reg.pushManager.getSubscription();
        if (existing && !sameKey(existing, key)) await existing.unsubscribe();
        const sub =
          existing && sameKey(existing, key)
            ? existing
            : await reg.pushManager.subscribe({
                // Required by the spec and refused outright by iOS without it.
                // It is also a promise this worker keeps: every push ends in a
                // showNotification, including the ones whose fetch failed.
                userVisibleOnly: true,
                applicationServerKey: key,
              });

        const res = await fetch(SUBSCRIBE_URL, {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          // `toJSON()` AT THE TOP LEVEL, unwrapped — the route reads
          // `body.endpoint`, which is where the browser's own serialisation puts
          // it. It carries `keys.p256dh` and `keys.auth` along with it and the
          // route deliberately drops them: this deployment sends no payload, so
          // they would be ECDH secrets stored in the private bucket to encrypt
          // nothing. Sending the whole object rather than picking the endpoint
          // out here keeps that decision in one place, on the server.
          body: JSON.stringify(sub.toJSON()),
        });
        // Not thrown, so the catch below stays about BROWSER failures and this
        // message — which is ours, in the right language already — survives.
        if (!res.ok) {
          setErr(await readError(res));
          return;
        }
        setEnrolment("on");
      } catch (e) {
        console.error("admin/push: could not subscribe", e);
        setErr(errorText);
      } finally {
        setBusy(false);
      }
    })();
  }, [errorText]);

  /* ── turning it off ── */

  const disable = useCallback(() => {
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        const sub = await currentSubscription();
        if (sub) {
          // The SERVER first. Dropping the endpoint from the bucket is what
          // actually stops the notifications; `unsubscribe()` only stops this
          // browser from accepting them. Unsubscribing first and then failing
          // here would leave a subscription the server still believes in and a
          // screen that says it is off.
          const res = await fetch(SUBSCRIBE_URL, {
            method: "DELETE",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          if (!res.ok) {
            setErr(await readError(res));
            return;
          }
          await sub.unsubscribe();
        }
        setEnrolment("off");
      } catch (e) {
        console.error("admin/push: could not unsubscribe", e);
        setErr(errorText);
      } finally {
        setBusy(false);
      }
    })();
    // The registration itself is deliberately left in place. It caches nothing
    // and intercepts nothing, so an idle worker costs nothing — and turning
    // the notifications back on later is then one press with no install wait.
  }, [errorText]);

  /* ── which of the five ── */

  if (!mounted || !configured) return null;
  if (iosInTab) {
    return (
      <Shell title={dict.push.title}>
        {/* Sentence case, not the 10px micro-label: this one is read as a
            sentence and acted on, not glanced at. */}
        <p className="text-xs text-fg/80">{dict.push.ios}</p>
      </Shell>
    );
  }
  if (!supported) return null;
  if (permission === "denied") {
    return (
      <Shell title={dict.push.title}>
        <p className="text-xs text-fg/80">{dict.push.denied}</p>
      </Shell>
    );
  }
  // The probe is one microtask away, and a button that flips to its opposite
  // the instant it appears is worse than a beat of nothing.
  if (enrolment === "unknown") return null;

  const on = enrolment === "on";

  return (
    <Shell title={dict.push.title}>
      {err ? (
        <p className="font-mono text-[10px] text-red-400 break-words">{err}</p>
      ) : null}
      {on ? <p className="text-xs text-fg/80">{dict.push.enabled}</p> : null}
      {busy ? (
        <span className="font-mono text-xs text-muted">
          {dict.common.working}
        </span>
      ) : null}
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={
          on
            ? "px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-fg disabled:opacity-40 cursor-pointer"
            : "border border-fg px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 cursor-pointer"
        }
      >
        {on ? dict.push.disable : dict.push.enable}
      </button>
    </Shell>
  );
}
