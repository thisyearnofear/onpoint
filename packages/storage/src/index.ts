/**
 * @repo/storage — Cloudflare R2 helpers for OnPoint (ADR 0003).
 *
 * Uses the S3-compatible API. R2 keys (not full URLs) are stored in Neon.
 * URL construction lives in one place — here.
 *
 * Required env vars (loaded on Hetzner):
 *   R2_ACCOUNT_ID     — Cloudflare account ID (part of the endpoint)
 *   R2_ACCESS_KEY_ID  — S3-compatible access key
 *   R2_SECRET_ACCESS_KEY — S3-compatible secret key
 *   R2_BUCKET_NAME    — e.g. "onpoint-store"
 *   R2_PUBLIC_URL     — optional CDN URL for public reads
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
}

/**
 * upload — put bytes to R2 at the given key.
 *
 * @param key   R2 key, e.g. "curators/wanja/listings/abc-123/1.jpg"
 * @param body  Buffer or Blob of image data
 * @param contentType  MIME type for the object
 */
export async function upload(
  key: string,
  body: Buffer | Blob | Uint8Array,
  contentType: string,
): Promise<{ key: string; etag?: string }> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  const result = await client.send(command);
  return { key, etag: result.ETag };
}

/**
 * signedReadUrl — generate a time-limited signed URL for a private object.
 *
 * @param key       R2 key
 * @param expiresIn Seconds until the URL expires (default 3600 = 1 hour)
 */
export async function signedReadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * publicUrl — construct a public CDN URL for an R2 key.
 *
 * Falls back to signedReadUrl if R2_PUBLIC_URL is not configured.
 */
export function publicUrl(key: string): string {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${key}`;
  }
  // Fallback — will throw at runtime if the bucket is private
  return `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

/**
 * remove — delete an object from R2 by key.
 */
export async function remove(key: string): Promise<void> {
  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await client.send(command);
}

/**
 * keyFor — construct R2 key paths following the ADR 0003 layout.
 *
 * Layout:
 *   /kits/{sku-id}.jpg                         ← PL reference images
 *   /kits/{sku-id}/crest.png
 *   /curators/{slug}/listings/{listing-id}/{n}.jpg  ← Curator photos
 *   /curators/{slug}/polaroids/{session-id}.jpg     ← Customer shares
 *   /curators/{slug}/avatars/main.jpg               ← Brand asset
 */
export const keyFor = {
  kit: (skuId: string) => `kits/${skuId}.jpg`,
  crest: (skuId: string) => `kits/${skuId}/crest.png`,
  listingPhoto: (slug: string, listingId: string, n: number) =>
    `curators/${slug}/listings/${listingId}/${n}.jpg`,
  polaroid: (slug: string, sessionId: string) =>
    `curators/${slug}/polaroids/${sessionId}.jpg`,
  avatar: (slug: string) => `curators/${slug}/avatars/main.jpg`,
} as const;
