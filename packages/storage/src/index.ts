/**
 * @repo/storage — Cloudflare R2 helpers for OnPoint (ADR 0003).
 *
 * Supports two authentication paths:
 *   1. Cloudflare API token (CF_API_TOKEN) — simpler, no S3 keys needed.
 *   2. S3-compatible SigV4 (R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY) — legacy.
 *
 * If CF_API_TOKEN is set, uses the Cloudflare R2 REST API for uploads/deletes.
 * Otherwise, falls back to S3 SigV4 signing (no AWS SDK dependency).
 *
 * R2 keys (not full URLs) are stored in Neon. URL construction lives here.
 *
 * Required env vars (loaded on Hetzner):
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_BUCKET_NAME      — e.g. "onpointstore"
 *   R2_PUBLIC_URL       — optional CDN URL for public reads
 *   CF_API_TOKEN        — Cloudflare API token with R2 edit permission (preferred)
 *   R2_ACCESS_KEY_ID    — S3-compatible access key (alternative)
 *   R2_SECRET_ACCESS_KEY — S3-compatible secret key (alternative)
 */

import { createHash, createHmac } from "node:crypto";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET_NAME || "";
const PUBLIC_URL = process.env.R2_PUBLIC_URL;
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const REGION = "auto";

/** True when Cloudflare REST API auth is available. */
function hasCfToken(): boolean {
  return Boolean(CF_API_TOKEN && ACCOUNT_ID && BUCKET);
}

/** True when S3 SigV4 auth is available. */
function hasS3Credentials(): boolean {
  return Boolean(ACCESS_KEY_ID && SECRET_ACCESS_KEY && ACCOUNT_ID && BUCKET);
}

// Lazily computed on first use, cached for the lifetime of the process.
let _endpoint: string | null = null;
function endpoint(): string {
  if (!_endpoint) {
    _endpoint = `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  return _endpoint;
}

// ---------------------------------------------------------------------------
// AWS Signature V4 helpers (S3-compatible, no AWS SDK needed)
// ---------------------------------------------------------------------------

function sha256(payload: string | Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function iso8601Date(date: Date): string {
  return date.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
}

function iso8601DateShort(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Derive the AWS SigV4 signing key.
 * kSecret → kDate → kRegion → kService → kSigning
 */
function signingKey(secret: string, dateShort: string): Buffer {
  const kSecret = hmacSha256(`AWS4${secret}`, dateShort);
  const kDate = hmacSha256(kSecret, REGION);
  const kRegion = hmacSha256(kDate, "s3");
  return hmacSha256(kRegion, "aws4_request");
}

/**
 * Build the canonical request and return the components needed for signing.
 */
function buildCanonicalParts(
  method: string,
  key: string,
  queryString: string,
  headers: Record<string, string>,
  hashedPayload: string,
): { canonicalRequest: string; signedHeaders: string } {
  // Sort header keys for deterministic ordering
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys
    .map((k) => `${k.toLowerCase()}:${headers[k]}\n`)
    .join("");
  const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).join(";");

  const canonicalRequest = [
    method,
    `/${key}`,
    queryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  return { canonicalRequest, signedHeaders };
}

/**
 * Build the Authorization header for an S3 request.
 */
function buildAuthHeader(
  method: string,
  key: string,
  headers: Record<string, string>,
  body: string | Buffer,
): Record<string, string> {
  const now = new Date();
  const dateShort = iso8601DateShort(now);
  const dateFull = iso8601Date(now);
  const hashedPayload = sha256(Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"));

  const allHeaders: Record<string, string> = {
    host: `${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    "x-amz-content-sha256": hashedPayload,
    "x-amz-date": dateFull,
    ...headers,
  };

  const { canonicalRequest, signedHeaders } = buildCanonicalParts(
    method,
    key,
    "",
    allHeaders,
    hashedPayload,
  );

  const credentialScope = `${dateShort}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateFull,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kSigning = signingKey(SECRET_ACCESS_KEY, dateShort);
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...allHeaders,
    authorization: authHeader,
    "content-type": headers["content-type"] || "",
  };
}

/**
 * Build signed query parameters for a presigned GET URL.
 */
function buildPresignedQueryParams(
  key: string,
  expiresIn: number,
): URLSearchParams {
  const now = new Date();
  const dateShort = iso8601DateShort(now);
  const dateFull = iso8601Date(now);
  // For presigned URLs, use UNSIGNED-PAYLOAD per AWS SigV4 spec
  // (the body isn't known at signing time for GET requests)
  const hashedPayload = "UNSIGNED-PAYLOAD";
  const signedHeaders = "host";

  // Canonical request for presigned URLs
  const canonicalRequest = [
    "GET",
    `/${key}`,
    `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(`${ACCESS_KEY_ID}/${dateShort}/${REGION}/s3/aws4_request`)}&X-Amz-Date=${dateFull}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${signedHeaders}`,
    `host:${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com\n`,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  const credentialScope = `${dateShort}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateFull,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kSigning = signingKey(SECRET_ACCESS_KEY, dateShort);
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${ACCESS_KEY_ID}/${credentialScope}`,
    "X-Amz-Date": dateFull,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
    "X-Amz-Signature": signature,
  });

  return params;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * upload — put bytes to R2 at the given key.
 *
 * Uses Cloudflare REST API if CF_API_TOKEN is set, otherwise S3 SigV4.
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
  const buffer = body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(await new Response(body).arrayBuffer());

  // Path 1: Cloudflare REST API (preferred when CF_API_TOKEN is set)
  if (hasCfToken()) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${CF_API_TOKEN}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`R2 upload failed (${res.status}): ${text}`);
    }
    return { key, etag: res.headers.get("etag") ?? undefined };
  }

  // Path 2: S3 SigV4 (legacy)
  if (!hasS3Credentials()) {
    throw new Error("R2 upload requires either CF_API_TOKEN or R2_ACCESS_KEY_ID+R2_SECRET_ACCESS_KEY");
  }
  const url = `${endpoint()}/${key}`;
  const headers = buildAuthHeader(
    "PUT",
    key,
    { "content-type": contentType },
    buffer,
  );

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "content-type": contentType,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }

  return { key, etag: res.headers.get("etag") ?? undefined };
}

/**
 * signedReadUrl — generate a time-limited signed URL for a private object.
 *
 * Uses AWS SigV4 query parameter authentication.
 *
 * @param key       R2 key
 * @param expiresIn Seconds until the URL expires (default 3600 = 1 hour)
 */
export async function signedReadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const params = buildPresignedQueryParams(key, expiresIn);
  return `${endpoint()}/${key}?${params.toString()}`;
}

/**
 * publicUrl — construct a public CDN URL for an R2 key.
 *
 * Falls back to a presigned URL if R2_PUBLIC_URL is not configured.
 */
export function publicUrl(key: string): string {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  // Fallback — will be computed lazily
  return `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

/**
 * remove — delete an object from R2 by key.
 *
 * Uses Cloudflare REST API if CF_API_TOKEN is set, otherwise S3 SigV4.
 */
export async function remove(key: string): Promise<void> {
  // Path 1: Cloudflare REST API
  if (hasCfToken()) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${CF_API_TOKEN}` },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`R2 delete failed (${res.status}): ${text}`);
    }
    return;
  }

  // Path 2: S3 SigV4
  if (!hasS3Credentials()) {
    throw new Error("R2 remove requires either CF_API_TOKEN or R2_ACCESS_KEY_ID+R2_SECRET_ACCESS_KEY");
  }
  const url = `${endpoint()}/${key}`;
  const headers = buildAuthHeader("DELETE", key, {}, "");

  const res = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`R2 delete failed (${res.status}): ${text}`);
  }
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
  /** Agent try-on polaroid — keyed by payment ID (globally unique). */
  agentPolaroid: (paymentId: string) => `polaroids/${paymentId}.jpg`,
  /** Agent try-on polaroid metadata (JSON) — paired with agentPolaroid image. */
  agentPolaroidMeta: (paymentId: string) => `polaroids/${paymentId}.json`,
} as const;

// ── Alibaba Cloud OSS adapter ──────────────────────────────────
// Qwen Cloud Hackathon, Track 4: Autopilot Agent.
// Re-exported here so callers can import from "@repo/storage" directly.
// See ./oss.ts for the full implementation.
export {
  isOssConfigured,
  isOssAvailable,
  putObject as ossPutObject,
  getObject as ossGetObject,
  signedUrl as ossSignedUrl,
  deleteObject as ossDeleteObject,
  publicUrlForKey as ossPublicUrlForKey,
  mirrorTryOnArtifact,
} from "./oss.js";
