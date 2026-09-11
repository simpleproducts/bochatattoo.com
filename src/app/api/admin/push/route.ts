/**
 * POST / DELETE /api/admin/push — the admin's devices opting in and out.
 *
 * Both handlers are behind assertAdminApi(), which also enforces the same-origin
 * check on every mutating verb. That guard is the whole access model here: a
 * subscription endpoint is a capability to wake Bocha's phone, and the only
 * person who may add one is the person already holding an admin session.
 *
 * WHAT THE BODY IS. The browser's own `PushSubscription.toJSON()`, passed
 * through untouched by the client:
 *
 *     { endpoint: "https://web.push.apple.com/…",
 *       expirationTime: null,
 *       keys: { p256dh: "…", auth: "…" } }
 *
 * ONLY `endpoint` IS READ, AND ONLY `endpoint` IS STORED. `keys` is the RFC 8291
 * payload-encryption material and this deployment sends no payload, so it is
 * dropped on the floor here rather than written to the private bucket — see the
 * header of src/lib/push-types.ts. `expirationTime` is ignored too: it is null
 * in every browser that matters, and a push service answering 410 is the only
 * expiry signal anything here trusts.
 *
 * POST IS IDEMPOTENT because the endpoint is the identity, which is what lets
 * the admin UI re-POST a subscription it already holds on every load — the only
 * way this server ever learns that a device it has a row for is still real.
 *
 * DELETE IS NOT GATED ON pushConfigured(). POST is: storing a subscription this
 * deploy could never send to is a row that exists to do nothing. But removing
 * one must keep working after the VAPID keys are pulled, which is exactly the
 * moment the stale rows want cleaning up.
 */
import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin-auth";
import { pushConfigured } from "@/lib/push";
import {
  addPushSubscription,
  PushStoreConflictError,
  removePushSubscription,
} from "@/lib/push-store";
import { PUSH_ENDPOINT_MAX } from "@/lib/push-types";
import { BookingsNotConfiguredError } from "@/lib/r2-private";

export const runtime = "nodejs";

/** Token-scoped admin data behind a CDN — never cached, on any response. */
const NO_STORE = { "cache-control": "no-store" };

function ok(body: Record<string, unknown>, status = 200): Response {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function fail(error: string, status: number, message?: string): Response {
  return NextResponse.json(
    message ? { error, message } : { error },
    { status, headers: NO_STORE },
  );
}

/**
 * One catch for both handlers, mapping the same three failures the bookings and
 * trips routes do: missing env is a 503, a lost compare-and-swap race is a 409
 * the device can simply retry, and anything else is R2 misbehaving. The message
 * rides along, which is safe here in a way it would not be on a public route —
 * these handlers are behind assertAdminApi().
 */
function storeFailure(err: unknown, where: string): Response {
  if (err instanceof BookingsNotConfiguredError) {
    return fail("bookings-not-configured", 503, err.message);
  }
  if (err instanceof PushStoreConflictError) return fail("conflict", 409, err.message);
  console.error(`push: ${where} failed`, err);
  return fail("store-failed", 500, (err as Error).message);
}

type EndpointResult =
  | { ok: true; endpoint: string }
  | { ok: false; response: Response };

/**
 * Validated BEFORE it is stored and long before anything fetches it. This value
 * becomes the URL of an outbound POST from our server, so it is checked for
 * being an absolute https URL rather than merely a non-empty string: a relative
 * or `file:` value would otherwise sit in the bucket and turn every later
 * fan-out into a thrown TypeError inside the confirmation path.
 *
 * The rejected value is never echoed back. It is an arbitrary-length string
 * from the wire and the admin cannot read it off the screen anyway — the
 * browser minted it.
 */
function readEndpoint(raw: unknown): EndpointResult {
  if (typeof raw !== "string") {
    return {
      ok: false,
      response: fail("invalid-body", 400, "`endpoint` must be a string."),
    };
  }
  const endpoint = raw.trim();
  if (!endpoint) {
    return {
      ok: false,
      response: fail("invalid-body", 400, "`endpoint` is empty."),
    };
  }
  if (endpoint.length > PUSH_ENDPOINT_MAX) {
    return {
      ok: false,
      response: fail(
        "invalid-body",
        400,
        `An endpoint longer than ${PUSH_ENDPOINT_MAX} characters is not a push endpoint.`,
      ),
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return {
      ok: false,
      response: fail("invalid-body", 400, "`endpoint` is not an absolute URL."),
    };
  }
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      response: fail("invalid-body", 400, "A push endpoint must be https."),
    };
  }
  return { ok: true, endpoint };
}

function readJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Kept for the admin's own benefit, so two devices are tellable apart. Never parsed. */
function readUserAgent(req: Request): string | undefined {
  const ua = req.headers.get("user-agent")?.trim().slice(0, 200);
  return ua || undefined;
}

export async function POST(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  if (!pushConfigured()) {
    return fail(
      "push-not-configured",
      503,
      "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must all be set.",
    );
  }

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  const endpoint = readEndpoint(body.endpoint);
  if (!endpoint.ok) return endpoint.response;

  try {
    await addPushSubscription({
      endpoint: endpoint.endpoint,
      userAgent: readUserAgent(req),
    });
    // No body worth returning: the browser already holds the subscription this
    // describes, and echoing the endpoint back would put a capability URL into
    // a response for no reader.
    return ok({ ok: true });
  } catch (err) {
    return storeFailure(err, "POST /api/admin/push");
  }
}

export async function DELETE(req: Request) {
  const guard = await assertAdminApi(req);
  if (guard) return guard;

  const body = readJsonObject(await req.json().catch(() => null));
  if (!body) return fail("invalid-body", 400, "Request body must be a JSON object.");

  const endpoint = readEndpoint(body.endpoint);
  if (!endpoint.ok) return endpoint.response;

  try {
    // Idempotent in the store: an endpoint that is already gone answers 200,
    // because a browser that unsubscribed locally and then lost its connection
    // must be able to retry without being told it is wrong.
    await removePushSubscription(endpoint.endpoint);
    return ok({ ok: true });
  } catch (err) {
    return storeFailure(err, "DELETE /api/admin/push");
  }
}
