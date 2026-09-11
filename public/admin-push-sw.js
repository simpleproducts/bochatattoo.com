/**
 * The admin's push worker. Plain JavaScript, served as a static file, no build
 * step — nothing here is imported by the app bundle and nothing here imports
 * from it.
 *
 * ─── THERE IS NO FETCH HANDLER, AND THERE MUST NOT BE ───
 *
 * This worker handles exactly two events: `push` and `notificationclick`.
 *
 * The admin reads every booking live from R2. A cached calendar showing an
 * appointment that was deleted — or hiding one that was just made — is worse
 * than a screen that says it could not load, which is the reason this project
 * shipped an installable admin with no service worker at all for as long as it
 * did (see the long note at the top of InstallPrompt.tsx). Adding a worker for
 * push does not reintroduce that risk for one reason only: a worker with no
 * `fetch` listener never intercepts a request, so it has no cache, no stale
 * responses, and no opinion about what the calendar shows. A later hand adding
 * `caches.open(...)` or a `fetch` handler here — to "make it work offline", to
 * "speed it up" — would be undoing that decision without knowing it was made.
 *
 * ─── SCOPE ───
 *
 * Served from the site root as /admin-push-sw.js and registered at the default
 * root scope. Under /admin/ it would sit behind middleware's `/admin/:path*`
 * matcher, take a 302 to the login page, and fail to register with an error
 * nobody would connect to the cause — the same trap the manifest had to dodge.
 * It is registered ONLY from PushToggle, only after Bocha opts in, so it never
 * reaches a public visitor's browser.
 *
 * ─── THE PUSH CARRIES NO PAYLOAD ───
 *
 * The server sends a contentless wake-up: no client name, no amount, nothing
 * about a booking ever traverses Apple's or Google's infrastructure, and there
 * is no RFC 8291 payload encryption to get subtly wrong. The cost is this
 * round trip — the worker fetches the current state from our own API with the
 * admin's own session cookie and builds the notification from the answer.
 *
 * ─── showNotification IS UNCONDITIONAL ───
 *
 * iOS revokes notification permission from a web app that receives a push and
 * shows nothing, and once revoked the browser never re-prompts. So every path
 * out of the `push` handler ends in a `showNotification` inside
 * `event.waitUntil`, including the one where the fetch failed. A generic
 * "movimiento en el calendario" is a small disappointment; a silently revoked
 * permission is the feature gone for good with no way back from inside the app.
 *
 * ─── THE ONLY STRINGS IN THE ADMIN NOT DRIVEN BY src/i18n/admin.ts ───
 *
 * FALLBACK_TITLE and FALLBACK_BODY below are inline, and they are the single
 * exception to the rule that every admin string comes from the dictionary. A
 * service worker is not part of the React tree: it has no bundle, no imports,
 * and no access to the `ba_admin_locale` cookie that decides the language — it
 * runs when no page of ours is open at all. They are Spanish because Spanish is
 * DEFAULT_ADMIN_LOCALE and the language of the one person who reads them, and
 * they are short because a lock-screen banner truncates. When the summary fetch
 * succeeds the copy comes from the API, which CAN read the locale cookie, so
 * these two are only ever seen on a failure.
 *
 * ─── NO install/activate HANDLERS ───
 *
 * No `skipWaiting`, no `clients.claim()`. With no fetch handler there is
 * nothing for a new worker to take over and nothing a stale one can serve
 * wrong, so an update simply activates the next time every admin window is
 * closed. The push subscription belongs to the registration, not to the worker
 * script, and survives that swap untouched.
 */

/** Built by the API from live state; it can read the admin's locale, we cannot. */
const SUMMARY_URL = "/api/admin/push/summary";

/** Where a tap lands when no admin window is already open. */
const FALLBACK_TARGET = "/admin/calendar";

const FALLBACK_TITLE = "Bocha Tattoo";
const FALLBACK_BODY = "Movimiento en el calendario.";

const ICON_URL = "/icons/admin-icon-192.png";

/**
 * One tag for every booking notification, so a second confirmation replaces the
 * first rather than stacking. The body comes from a summary of the CURRENT
 * state, so the newest banner is always the complete picture — two stacked
 * banners would be the same information twice, the older half of it wrong.
 * `renotify` is what makes the replacement still buzz.
 */
const NOTIFICATION_TAG = "bocha-admin-booking";

/**
 * Only a same-origin, absolute path is allowed through to `openWindow`. The URL
 * comes from our own API, so this is not a trust boundary so much as a cheap
 * guarantee that a future summary field can never turn a notification tap into
 * navigation off the site. The `//` test rejects protocol-relative URLs, which
 * start with a slash and are not local at all.
 */
function safeTarget(value) {
  if (typeof value !== "string") return FALLBACK_TARGET;
  if (!value.startsWith("/") || value.startsWith("//")) return FALLBACK_TARGET;
  return value;
}

/**
 * Ask our own API what happened. Never throws: every failure — offline, a
 * session cookie that expired while the phone was in a pocket, an HTML error
 * page where JSON was expected — resolves to `null` and the caller shows the
 * generic copy.
 */
async function readSummary() {
  try {
    const res = await fetch(SUMMARY_URL, {
      // The admin session cookie is the whole of the authentication here. A
      // service worker fetch is same-origin, so `include` simply sends it; the
      // route answers 401 for anyone else and we fall back.
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function showBookingNotification() {
  const summary = await readSummary();
  const title =
    summary && typeof summary.title === "string" && summary.title.trim() !== ""
      ? summary.title
      : FALLBACK_TITLE;
  const body =
    summary && typeof summary.body === "string" && summary.body.trim() !== ""
      ? summary.body
      : FALLBACK_BODY;
  const url = safeTarget(summary ? summary.url : undefined);

  return self.registration.showNotification(title, {
    body,
    icon: ICON_URL,
    // Android draws this monochrome in the status bar; iOS ignores it.
    badge: ICON_URL,
    tag: NOTIFICATION_TAG,
    renotify: true,
    data: { url },
  });
}

self.addEventListener("push", (event) => {
  // Inside waitUntil, and with no branch that can skip it — see the header.
  event.waitUntil(showBookingNotification());
});

/**
 * Focus an admin window if one is open, otherwise open one.
 *
 * `includeUncontrolled: true` is not optional. This worker never calls
 * `clients.claim()` and has no fetch handler, so it controls NOTHING: every
 * admin tab and the installed app itself are uncontrolled clients, and the
 * default `matchAll()` would return an empty list and open a duplicate window
 * every single time.
 *
 * The window is focused where it stands rather than navigated. `navigate()` is
 * specified to reject for a client this worker does not control, which is all
 * of them, so calling it here would be dead code that always throws.
 */
async function openAdmin(url) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windows) {
    let path;
    try {
      const parsed = new URL(client.url);
      if (parsed.origin !== self.location.origin) continue;
      path = parsed.pathname;
    } catch {
      continue;
    }
    if (!path.startsWith("/admin")) continue;
    return client.focus();
  }
  return self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  // Closed first: on Android the banner otherwise survives the tap and sits in
  // the shade advertising a booking Bocha is already looking at.
  event.notification.close();
  const data = event.notification.data;
  const url = safeTarget(data ? data.url : undefined);
  event.waitUntil(openAdmin(url));
});
