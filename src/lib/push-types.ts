/**
 * The shapes the push feature is made of, and the one file every other push
 * module — server, route and service worker alike — agrees with.
 *
 * No `server-only` import, deliberately: the admin opt-in component reads the
 * limits below while deciding what to show, and the service worker is written
 * against `PushSummary`. Nothing here touches a Node built-in or the S3 SDK.
 *
 * WHY A SUBSCRIPTION RECORD HOLDS NO KEYS. A browser's PushSubscription JSON
 * carries `keys.p256dh` and `keys.auth`, and every push library stores them —
 * they are the ECDH material RFC 8291 payload encryption needs. This deployment
 * sends NO PAYLOAD (see src/lib/push.ts), so they encrypt nothing here, and a
 * secret kept for nothing is still a secret kept: it would sit in the private
 * bucket forever, readable by anything that can read the bucket, buying zero
 * capability. The POST route reads the browser's JSON and throws that half
 * away. If payload encryption is ever wanted, the browser can re-subscribe and
 * hand them over again — they are not recoverable from anything else, and that
 * is the point.
 */

/**
 * One device that has opted in. The ENDPOINT IS THE IDENTITY: the push service
 * mints it, it is unique per (browser, origin, subscription), and re-subscribing
 * the same installed web app returns the same one — which is what makes `add`
 * idempotent without any client-side id to trust.
 */
export type PushSubscriptionRecord = {
  /** Absolute https URL at the browser vendor's push service. The document key. */
  endpoint: string;
  createdAt: string;  // UTC ISO, immutable
  /** Bumped every time the same endpoint subscribes again. Drives the cap eviction. */
  lastSeenAt: string; // UTC ISO
  /**
   * Trimmed User-Agent of the request that subscribed, purely so the admin can
   * tell "my phone" from "the iPad" if a list is ever shown. Never used to
   * decide anything.
   */
  userAgent?: string;
};

/** Every subscription in one object, under the same CAS rules as TripsDoc. */
export type PushSubscriptionsDoc = {
  version: 1;
  subscriptions: PushSubscriptionRecord[];
  updatedAt: string;
};

/**
 * What one POST to a push service came back as. Three outcomes and no throw,
 * because the caller is always a request that has already committed and must
 * not be failed by a notification — see sendPush().
 *
 * `gone` is the only one that means anything durable: the push service has
 * said this subscription no longer exists, so the caller prunes it. Everything
 * else is `failed` and must delete nothing — a 500 from a push service, or a
 * timeout on a bad minute, is not evidence a device is gone.
 */
export type PushSendResult =
  | { status: "delivered"; endpoint: string; httpStatus: number }
  | { status: "gone"; endpoint: string; httpStatus: number }
  | { status: "failed"; endpoint: string; httpStatus?: number; message: string };

/**
 * What GET /api/admin/push/summary answers with — spread alongside the house
 * `ok: true`, so the wire body is `{ ok, title, body, url }`. It is the only
 * thing the service worker is told, and the reason the push itself can be empty.
 *
 * IT IS ALREADY RENDERED TEXT, and that is the decision worth stating. The
 * obvious alternative — ship `{ awaiting, latest }` and let the worker write the
 * sentence — cannot work here: a service worker has no bundle, so it cannot
 * import src/i18n/admin.ts, and it cannot read the `ba_admin_locale` cookie that
 * says which of the two dictionaries to use. It would be stuck with
 * `navigator.language`, which is the PHONE's language and not the one Bocha
 * picked in the admin. This route is fetched with the admin's own cookie, so it
 * knows the real answer; it renders the strings from the dictionary and the
 * worker just displays them. The worker's own two Spanish fallbacks are only
 * ever seen when this fetch fails.
 *
 * It is deliberately tiny. It is fetched by a service worker that iOS gives a
 * few seconds to show a notification, and every field in it is something the
 * notification will put on a lock screen. So: two short lines and a path. No
 * email address, no phone, no amount, no booking id — `url` is a fixed calendar
 * path for exactly that reason, rather than a deep link carrying an id.
 */
export type PushSummary = {
  /** Lock-screen title. Never empty; the worker treats empty as a failure. */
  title: string;
  /** One line: who and when, or the count still waiting. Never empty. */
  body: string;
  /** Same-origin absolute path the tap opens. Validated again in the worker. */
  url: string;
};

/**
 * A push service endpoint is a URL, and it is interpolated into a fetch() and
 * stored as a JSON field, so its length is bounded at the door. FCM endpoints
 * run to ~200 characters and Apple's to ~250; 1000 is generous and still small
 * enough that the cap below bounds the document at a few tens of KB.
 */
export const PUSH_ENDPOINT_MAX = 1000;

/**
 * How many devices may be subscribed at once. There is ONE admin — a phone, a
 * tablet, a desktop browser, and the same phone again after a reinstall (a
 * reinstall mints a NEW endpoint and the old one stays until a send collects a
 * 410). Eight leaves room for years of that. The cap exists because the whole
 * list is rewritten on every write and fanned out over on every confirmation:
 * without it, a loop somewhere turns one booking into an unbounded number of
 * outbound requests.
 */
export const MAX_PUSH_SUBSCRIPTIONS = 8;

/**
 * How long a push service should hold the message for a device that is offline,
 * in seconds. Four hours: the notification is "something moved on the calendar
 * just now", and one delivered the next morning is noise the admin has to read
 * and dismiss to learn nothing. Past the TTL the push service drops it silently,
 * which is the right outcome — the calendar is the source of truth and is one
 * tap away.
 */
export const PUSH_TTL_SECONDS = 4 * 60 * 60;
