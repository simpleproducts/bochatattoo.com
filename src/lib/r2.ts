import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidateTag } from "next/cache";
import type {
  CategoriesData,
  ImagesManifest,
  ImageEntry,
} from "./images-types";
import { ADMIN_STATE_KEY, invalidateAdminEpochCache } from "./admin-epoch";

/** Single place to invalidate the images data cache after a write. */
export function bustImagesCache(): void {
  revalidateTag("images", "default");
}

const EMPTY_MANIFEST: ImagesManifest = {
  version: 1,
  images: {},
  featuredSlugs: [],
};

const EMPTY_CATEGORIES: CategoriesData = { version: 1, categories: [] };

export const MANIFEST_KEY = "manifest.json";
export const CATEGORIES_KEY = "categories.json";

function getEnv() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
  } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Missing R2 credentials in env");
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET };
}

let _client: S3Client | null = null;
export function r2Client(): S3Client {
  if (_client) return _client;
  const env = getEnv();
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Bucket(): string {
  return getEnv().R2_BUCKET;
}

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const out = await r2Client().send(
      new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
    );
    const text = await out.Body!.transformToString();
    return JSON.parse(text) as T;
  } catch (err) {
    // Genuine "file not yet created" → use the empty fallback.
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (
      e?.name === "NoSuchKey" ||
      e?.name === "NotFound" ||
      e?.$metadata?.httpStatusCode === 404
    ) {
      return fallback;
    }
    // Anything else (credentials wrong, R2 unreachable, malformed JSON,
    // permissions) is a real error — bubble it so the route can surface it.
    throw err;
  }
}

async function putJson(key: string, data: unknown): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
      // Public manifest — short cache so revalidations propagate fast.
      CacheControl: "public, max-age=30, must-revalidate",
    }),
  );
}

export async function loadManifest(): Promise<ImagesManifest> {
  return getJson<ImagesManifest>(MANIFEST_KEY, EMPTY_MANIFEST);
}

export async function saveManifest(manifest: ImagesManifest): Promise<void> {
  await putJson(MANIFEST_KEY, manifest);
}

export async function loadCategories(): Promise<CategoriesData> {
  return getJson<CategoriesData>(CATEGORIES_KEY, EMPTY_CATEGORIES);
}

export async function saveCategories(data: CategoriesData): Promise<void> {
  await putJson(CATEGORIES_KEY, data);
}

export async function putBytes(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function getBytes(key: string): Promise<Uint8Array> {
  const out = await r2Client().send(
    new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
  );
  const buf = await out.Body!.transformToByteArray();
  return buf;
}

export async function deleteKey(key: string): Promise<void> {
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2Client().send(
      new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

/** HEAD an object — used to check uploaded file size before processing. */
export async function headObject(
  key: string,
): Promise<{ contentLength: number; contentType?: string } | null> {
  try {
    const out = await r2Client().send(
      new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }),
    );
    return {
      contentLength: out.ContentLength ?? 0,
      contentType: out.ContentType,
    };
  } catch {
    return null;
  }
}

/** Increment the admin session epoch — invalidates every outstanding cookie. */
export async function bumpAdminEpoch(): Promise<number> {
  let current = 0;
  try {
    const out = await r2Client().send(
      new GetObjectCommand({ Bucket: r2Bucket(), Key: ADMIN_STATE_KEY }),
    );
    const text = await out.Body!.transformToString();
    const data = JSON.parse(text) as { epoch?: number };
    current = typeof data.epoch === "number" ? data.epoch : 0;
  } catch {
    current = 0;
  }
  const next = current + 1;
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: ADMIN_STATE_KEY,
      Body: JSON.stringify({ epoch: next }),
      ContentType: "application/json",
      // No cache — must always reflect latest after logout.
      CacheControl: "no-store, max-age=0",
    }),
  );
  invalidateAdminEpochCache();
  return next;
}

export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

/**
 * Slug helpers — match the local processing script so admin uploads land in
 * the same shape as bulk-imported images.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function shortId(): string {
  // 6 random base36 chars, lowercase, no padding.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 6);
}

/** Variant key on R2: e.g. `anatom-skull-640.avif`. */
export function variantKey(
  slug: string,
  width: number,
  format: string,
): string {
  return `${slug}-${width}.${format}`;
}

/** Keep the original under originals/ so we can re-derive variants later. */
export function originalKey(slug: string, ext: string): string {
  return `originals/${slug}.${ext}`;
}

export type { ImageEntry };
