/**
 * The push subscription persistence layer — a direct sibling of
 * src/lib/trips-store.ts, and the only module that knows where subscriptions
 * live.
 *
 * One object, in the PRIVATE bucket:
 *   bookings/push-subscriptions.json    every subscribed device, as a PushSubscriptionsDoc
 *
 * It is under bookings/ rather than a prefix of its own because the only thing
 * that ever sends a push is a booking turning green, and the private bucket has
 * exactly one tenant.
 *
 * The four constraints are trips-store's, for the same reasons, so read that
 * file's header first. What is worth restating is why they apply HERE:
 *
 * 1. ONE document, not one per endpoint. There are a handful of devices, ever,
 *    and every consumer wants all of them at once — a fan-out over the whole
 *    list is the only read this store has. A per-endpoint layout would buy a
 *    LIST plus N GETs on the confirmation path, which is a path with a client
 *    waiting on it.
 *
 * 2. Every write is a compare-and-swap. The racing writers here are not two
 *    admin tabs: they are a confirmation pruning a dead endpoint and a device
 *    subscribing, which genuinely happen at once because the first is triggered
 *    by a stranger's upload. The whole list is in the body, so a last-write-wins
 *    PUT would not lose a field — it would lose a whole device, silently, and
 *    the symptom would be a phone that simply stopped buzzing.
 *
 * 3. `IfNoneMatch: "*"` when the document does not exist yet, so the very first
 *    subscription cannot be created twice.
 *
 * 4. Nothing editorial is validated here. Endpoint shape and length are the
 *    route's job — see PUSH_ENDPOINT_MAX. The one rule enforced below is
 *    structural: the list never exceeds MAX_PUSH_SUBSCRIPTIONS, and it is
 *    enforced in the mutator rather than at the door because only the mutator
 *    sees the list that is actually about to be written.
 */
import "server-only";
import {
  MAX_PUSH_SUBSCRIPTIONS,
  type PushSubscriptionRecord,
  type PushSubscriptionsDoc,
} from "./push-types";
import { getPrivateJson, putPrivateJson, PreconditionFailed } from "./r2-private";

const PUSH_KEY = "bookings/push-subscriptions.json";

/** Retry delays for a refused conditional write, in ms. 4 attempts total. */
const RETRY_BACKOFF_MS = [50, 120, 300];

export class PushStoreConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushStoreConflictError";
  }
}

/* ────────────────────────── reads ────────────────────────── */

/**
 * Every subscribed device, most recently seen first. A 404 is an empty list and
 * nothing else — getPrivateJson() swallows only a genuine "never written" and
 * rethrows a credentials or connectivity failure, so "nobody has opted in" can
 * never be the story a broken bucket tells. That distinction matters more here
 * than anywhere else in the codebase: the only caller is a fan-out inside a
 * try/catch, and an empty list read from a broken bucket would look exactly
 * like a working feature with no subscribers.
 */
export async function listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const found = await getPrivateJson<PushSubscriptionsDoc>(PUSH_KEY);
  return sortByLastSeen(found?.data.subscriptions ?? []);
}

/* ────────────────────────── writes ────────────────────────── */

type Mutation<T> = { subscriptions: PushSubscriptionRecord[]; result: T };

/**
 * Conditional read-modify-write of the whole document.
 *
 * `apply` MUST be a pure function of the list it is handed: it is re-run from
 * scratch against a freshly-read list on every retry, so it may not close over
 * a list read earlier, mutate its argument, or depend on how many times it has
 * run — which is why the callers below mint their timestamps ONCE, before the
 * loop. Returning the SAME ARRAY REFERENCE means "no change" and skips the
 * write entirely.
 *
 * After 4 refused attempts this throws PushStoreConflictError. Every caller
 * either surfaces that as a 409 the device can retry, or — on the send path —
 * swallows it, because a subscription that could not be pruned is a wasted
 * request next time and nothing worse.
 */
async function mutateSubscriptions<T>(
  apply: (current: PushSubscriptionRecord[]) => Mutation<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const found = await getPrivateJson<PushSubscriptionsDoc>(PUSH_KEY);
    const current = found?.data.subscriptions ?? [];

    const { subscriptions, result } = apply(current);
    if (subscriptions === current) return result;

    const doc: PushSubscriptionsDoc = {
      version: 1,
      subscriptions,
      updatedAt: new Date().toISOString(),
    };
    try {
      await putPrivateJson(
        PUSH_KEY,
        doc,
        found ? { ifMatch: found.etag } : { ifNoneMatch: "*" },
      );
      return result;
    } catch (err) {
      // Only a refused precondition is retryable; anything else is R2 being
      // down or misconfigured and retrying it just delays the error.
      if (!(err instanceof PreconditionFailed)) throw err;
      if (attempt >= RETRY_BACKOFF_MS.length) {
        throw new PushStoreConflictError(
          `Push subscriptions were modified by someone else ${attempt + 1} times in a row.`,
        );
      }
      await sleep(jittered(RETRY_BACKOFF_MS[attempt]));
    }
  }
}

export type AddPushSubscriptionInput = {
  endpoint: string;
  userAgent?: string;
};

/**
 * Subscribe a device, IDEMPOTENT ON ENDPOINT.
 *
 * The browser calls this on every admin page load where it already holds a
 * subscription — that is the only way the server ever learns that a device it
 * has a row for is still real — so "already there" is the NORMAL case, not the
 * edge case. An endpoint already on file has its `lastSeenAt` refreshed and
 * keeps its original `createdAt`; a duplicate row is never created.
 *
 * Both timestamps are minted BEFORE the CAS loop, not inside the mutator: a
 * retry re-runs `apply`, and a mutator calling `new Date()` would hand back a
 * different record each attempt.
 *
 * Eviction, when the list is at MAX_PUSH_SUBSCRIPTIONS, drops the LEAST
 * RECENTLY SEEN row — which is the one most likely to be a reinstalled app's
 * dead endpoint, since a live device refreshes itself on every admin load. The
 * device subscribing right now is never the one evicted.
 */
export async function addPushSubscription(
  input: AddPushSubscriptionInput,
): Promise<PushSubscriptionRecord> {
  const now = new Date().toISOString();
  return mutateSubscriptions((current) => {
    const at = current.findIndex((s) => s.endpoint === input.endpoint);

    if (at >= 0) {
      const merged: PushSubscriptionRecord = {
        ...current[at],
        lastSeenAt: now,
        userAgent: input.userAgent ?? current[at].userAgent,
      };
      // A re-subscribe that changed nothing observable still costs a write of
      // `lastSeenAt`, and that is on purpose: freshness is exactly what the
      // eviction rule above reads, so skipping the write would make the oldest
      // ACTIVE device look like the stalest one.
      const next = [...current];
      next[at] = merged;
      return { subscriptions: next, result: merged };
    }

    const record: PushSubscriptionRecord = {
      endpoint: input.endpoint,
      createdAt: now,
      lastSeenAt: now,
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    };
    const next = [...current, record];
    // Enforced on the list about to be written, not on the one read: that is
    // the only list whose length is a fact.
    const capped =
      next.length > MAX_PUSH_SUBSCRIPTIONS
        ? sortByLastSeen(next).slice(0, MAX_PUSH_SUBSCRIPTIONS)
        : next;
    return { subscriptions: capped, result: record };
  });
}

/**
 * Unsubscribe one device. Idempotent: an endpoint that is not there means the
 * device is already gone, which is what the caller asked for, and returning the
 * same reference skips the write so a DELETE racing a prune never fights over
 * the ETag.
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await mutateSubscriptions((current) => {
    const next = current.filter((s) => s.endpoint !== endpoint);
    return {
      subscriptions: next.length === current.length ? current : next,
      result: undefined,
    };
  });
}

/**
 * Drop every endpoint a push service answered 404 or 410 for, in ONE write.
 *
 * A 404/410 from a push service is the only authority on a dead subscription,
 * and it is definitive — the browser uninstalled the web app, cleared its site
 * data, or the push service rotated the endpoint. Anything else the send path
 * saw (a 500, a timeout, a network error) must never reach this function: see
 * PushSendResult.
 *
 * One call rather than one per endpoint because a fan-out that finds two dead
 * devices would otherwise run two CAS loops that each invalidate the other's
 * ETag. Returns how many rows actually went, for the log.
 */
export async function prunePushSubscriptions(endpoints: string[]): Promise<number> {
  if (endpoints.length === 0) return 0;
  const dead = new Set(endpoints);
  return mutateSubscriptions((current) => {
    const next = current.filter((s) => !dead.has(s.endpoint));
    const removed = current.length - next.length;
    return {
      subscriptions: removed === 0 ? current : next,
      result: removed,
    };
  });
}

/* ────────────────────────── helpers ────────────────────────── */

/**
 * Most recently seen first. UTC ISO timestamps sort chronologically as plain
 * strings, and `endpoint` breaks the remaining ties so two devices subscribed
 * in the same millisecond cannot order differently between two reads — which
 * would make the eviction rule non-deterministic.
 */
function sortByLastSeen(
  subscriptions: PushSubscriptionRecord[],
): PushSubscriptionRecord[] {
  return [...subscriptions].sort((a, b) => {
    if (a.lastSeenAt !== b.lastSeenAt) return a.lastSeenAt < b.lastSeenAt ? 1 : -1;
    return a.endpoint < b.endpoint ? -1 : a.endpoint > b.endpoint ? 1 : 0;
  });
}

// sleep() and jittered() are four lines each and live privately in
// bookings-store.ts and trips-store.ts too. Copied rather than exported from
// either: importing them would make this module depend on a whole record layer
// to borrow a setTimeout, and no copy has any reason to change.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jitter over [base/2, 1.5 x base) so two racing writers never retry in lockstep. */
function jittered(base: number): number {
  return Math.round(base * (0.5 + Math.random()));
}
