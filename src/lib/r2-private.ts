/**
 * R2 primitives for the PRIVATE bookings bucket.
 *
 * Sibling of src/lib/r2.ts, not a replacement: it reuses that module's
 * r2Client() (same account, same credentials) and only ever swaps the bucket.
 * Everything here lives in R2_PRIVATE_BUCKET — a SECOND bucket, created with
 * its r2.dev public URL disabled and no custom domain bound.
 *
 * The operator error this module exists to catch is pasting the public images
 * bucket name into R2_PRIVATE_BUCKET. R2_BUCKET is served anonymously at
 * NEXT_PUBLIC_IMAGES_BASE_URL and that public readability is load-bearing
 * elsewhere, so if the two names are equal then every appointment record —
 * name, email, phone, deposit, admin notes — and every bank transfer receipt
 * becomes anonymously fetchable by key at that public base URL, while the
 * feature works perfectly and shows no symptom whatsoever. privateBucket()
 * therefore refuses a value equal to R2_BUCKET exactly as loudly as it refuses
 * an unset one.
 *
 * Two further constraints a reader should not have to guess:
 *   - every object written here is `no-store, max-age=0`; these are
 *     token-scoped bodies and bank data and must never sit in a CDN or a
 *     browser cache, so there is deliberately no cacheControl parameter;
 *   - a refused conditional write (IfMatch / IfNoneMatch) throws
 *     PreconditionFailed and nothing else does, so the CAS loop in
 *     bookings-store.ts can tell "someone wrote first" from "R2 is down".
 */
import "server-only";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { r2Client } from "./r2";

/** Thrown when the bookings feature is missing env it cannot safely fake. */
export class BookingsNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingsNotConfiguredError";
  }
}

/** Thrown when R2 refused an IfMatch / IfNoneMatch write. Never anything else. */
export class PreconditionFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreconditionFailed";
  }
}

/**
 * The private bucket name. Throws when unset AND when it equals R2_BUCKET —
 * see the header block for why the second check is the important one.
 */
export function privateBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!bucket) {
    throw new BookingsNotConfiguredError(
      "R2_PRIVATE_BUCKET is not set on the server.",
    );
  }
  if (bucket === process.env.R2_BUCKET) {
    throw new BookingsNotConfiguredError(
      "R2_PRIVATE_BUCKET must not be the same bucket as R2_BUCKET: R2_BUCKET is " +
        "served publicly at NEXT_PUBLIC_IMAGES_BASE_URL, so booking records and " +
        "receipts written there would be readable by anyone with the key.",
    );
  }
  return bucket;
}

/**
 * Cheap, never-throwing config probe — the calendar page calls it to decide
 * whether to render a config panel instead of blowing up on first render.
 */
export function bookingsConfigured(): boolean {
  const bucket = process.env.R2_PRIVATE_BUCKET;
  return Boolean(
    bucket &&
      process.env.BOOKING_TOKEN_SECRET &&
      bucket !== process.env.R2_BUCKET,
  );
}

/** Genuine "object was never written" — the only failure a read may swallow. */
function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === "NoSuchKey" ||
    e?.name === "NotFound" ||
    e?.$metadata?.httpStatusCode === 404
  );
}

/** R2 may surface a refused conditional write as either 412 or 409. */
function isPreconditionFailure(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = e?.$metadata?.httpStatusCode;
  return e?.name === "PreconditionFailed" || status === 412 || status === 409;
}

/**
 * Read a JSON object plus its ETag. `null` means 404 and nothing else; the
 * ETag is what makes the caller's next write a compare-and-swap.
 */
export async function getPrivateJson<T>(
  key: string,
): Promise<{ data: T; etag: string } | null> {
  const bucket = privateBucket();
  try {
    const out = await r2Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const text = await out.Body!.transformToString();
    // R2 always returns an ETag on a successful GET; the fallback only satisfies
    // the optional type, and an empty one fails the next conditional write
    // rather than silently overwriting a record.
    return { data: JSON.parse(text) as T, etag: out.ETag ?? "" };
  } catch (err) {
    // Genuine "file not yet created" → the caller decides what missing means.
    if (isNotFound(err)) return null;
    // Anything else (credentials wrong, R2 unreachable, malformed JSON,
    // permissions) is a real error — bubble it so the route can surface it.
    throw err;
  }
}

/**
 * Write a JSON object. Pass `ifNoneMatch: "*"` to create-or-fail, or
 * `ifMatch: <etag>` to update-if-unchanged; both throw PreconditionFailed when
 * refused. Pretty-printed like r2.ts so a record stays readable in the R2
 * console during an incident.
 */
export async function putPrivateJson(
  key: string,
  data: unknown,
  opts?: { ifMatch?: string; ifNoneMatch?: "*" },
): Promise<{ etag: string | null }> {
  const bucket = privateBucket();
  try {
    const out = await r2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: "application/json",
        CacheControl: "no-store, max-age=0",
        IfMatch: opts?.ifMatch,
        IfNoneMatch: opts?.ifNoneMatch,
      }),
    );
    return { etag: out.ETag ?? null };
  } catch (err) {
    if (isPreconditionFailure(err)) {
      throw new PreconditionFailed(
        `Conditional write refused for ${key} — the object changed underneath us.`,
      );
    }
    throw err;
  }
}

/** Unconditional write of raw bytes (receipts). Always uncacheable. */
export async function putPrivateBytes(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "no-store, max-age=0",
    }),
  );
}

/**
 * Stream an object out for the admin receipt proxy route: the bytes reach the
 * browser through our own handler, so no presigned GET or public URL is ever
 * minted for a receipt. `null` means 404.
 */
export async function getPrivateStream(
  key: string,
): Promise<{ body: ReadableStream; contentLength: number } | null> {
  const bucket = privateBucket();
  try {
    const out = await r2Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      body: out.Body!.transformToWebStream(),
      contentLength: out.ContentLength ?? 0,
    };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function deletePrivate(key: string): Promise<void> {
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }),
  );
}

/**
 * List every key under a prefix, following ContinuationToken until R2 runs out
 * or `max` is reached. The default ceiling keeps the reindex route inside its
 * serverless time budget; raise it only if the studio ever passes it.
 */
export async function listPrivate(
  prefix: string,
  max = 10_000,
): Promise<string[]> {
  const bucket = privateBucket();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const remaining = max - keys.length;
    if (remaining <= 0) break;
    const out = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: Math.min(1000, remaining),
      }),
    );
    for (const obj of out.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
      if (keys.length >= max) return keys;
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
