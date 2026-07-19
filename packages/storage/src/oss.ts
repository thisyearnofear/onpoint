/**
 * Alibaba Cloud OSS adapter — try-on artifact mirror.
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent.
 *
 * This file is the **Proof of Alibaba Cloud Deployment** required by the
 * hackathon rules. It uses the official Alibaba Cloud OSS SDK for Node.js
 * (`ali-oss`) to mirror try-on input/output images to an Alibaba Cloud
 * OSS bucket. The mirror is best-effort (fail-open) so production is not
 * blocked if OSS is unavailable.
 *
 * Why mirror to OSS in addition to R2:
 *   1. Satisfies the hackathon's Alibaba Cloud deployment requirement.
 *   2. Provides a second-region backup of try-on artifacts.
 *   3. Demonstrates multi-cloud storage architecture (R2 primary,
 *      OSS secondary) — a production pattern for durability.
 *
 * Required env vars (loaded on Hetzner):
 *   ALIBABA_OSS_ACCESS_KEY_ID     — Alibaba Cloud AccessKey ID
 *   ALIBABA_OSS_ACCESS_KEY_SECRET — Alibaba Cloud AccessKey Secret
 *   ALIBABA_OSS_BUCKET            — OSS bucket name (e.g. "onpoint-tryon")
 *   ALIBABA_OSS_REGION            — OSS region (e.g. "oss-us-west-1")
 *
 * Recommended region: oss-us-west-1 (international) to avoid China
 * real-name verification requirements.
 *
 * Docs: https://www.alibabacloud.com/help/en/oss/developer-reference/node-js
 * SDK:  https://www.npmjs.com/package/ali-oss
 */

import OSS from "ali-oss";

const OSS_ACCESS_KEY_ID = process.env.ALIBABA_OSS_ACCESS_KEY_ID || "";
const OSS_ACCESS_KEY_SECRET = process.env.ALIBABA_OSS_ACCESS_KEY_SECRET || "";
const OSS_BUCKET = process.env.ALIBABA_OSS_BUCKET || "";
const OSS_REGION = process.env.ALIBABA_OSS_REGION || "oss-us-west-1";
// Optional: override the endpoint (e.g. for a custom domain or internal endpoint)
const OSS_ENDPOINT = process.env.ALIBABA_OSS_ENDPOINT || undefined;
// Optional: public-facing CDN URL for reads
const OSS_PUBLIC_URL = process.env.ALIBABA_OSS_PUBLIC_URL || undefined;

/** True when Alibaba Cloud OSS credentials + bucket are configured. */
export function isOssConfigured(): boolean {
  return Boolean(
    OSS_ACCESS_KEY_ID && OSS_ACCESS_KEY_SECRET && OSS_BUCKET,
  );
}

// Lazy singleton — only constructed when first used.
let _client: OSS | null = null;
let _initFailed = false;

function getClient(): OSS | null {
  if (_client || _initFailed) return _client;
  if (!isOssConfigured()) {
    _initFailed = true;
    return null;
  }
  try {
    _client = new OSS({
      region: OSS_REGION,
      accessKeyId: OSS_ACCESS_KEY_ID,
      accessKeySecret: OSS_ACCESS_KEY_SECRET,
      bucket: OSS_BUCKET,
      ...(OSS_ENDPOINT ? { endpoint: OSS_ENDPOINT } : {}),
      // Secure transport (HTTPS) — required for production.
      secure: true,
      // Reasonable timeouts so a slow OSS doesn't block the request path.
      timeout: 10_000,
    });
  } catch (err) {
    _initFailed = true;
    console.warn(
      "[oss] Failed to construct Alibaba Cloud OSS client — mirror disabled:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
  return _client;
}

/**
 * Put an object to Alibaba Cloud OSS.
 *
 * Best-effort: returns null on failure (never throws) so the calling
 * request path is not blocked. The R2 upload is the primary; OSS is
 * the secondary mirror.
 *
 * @param key          OSS key, e.g. "tryon/{receiptId}/input.jpg"
 * @param body         Buffer of bytes
 * @param contentType  MIME type
 * @returns            { key, url } on success, null on failure
 */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string } | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const buffer = body instanceof Uint8Array ? Buffer.from(body) : body;
    const result = await client.put(key, buffer, {
      mime: contentType,
      headers: {
        "Content-Type": contentType,
        // Cache try-on artifacts for 7 days — they're immutable.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });

    const url =
      OSS_PUBLIC_URL
        ? `${OSS_PUBLIC_URL.replace(/\/$/, "")}/${key}`
        : (result.url as string);

    return { key, url };
  } catch (err) {
    console.warn(
      "[oss] putObject failed (best-effort, continuing):",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Get an object from Alibaba Cloud OSS.
 *
 * @param key  OSS key
 * @returns    Buffer on success, null on failure or not-found
 */
export async function getObject(key: string): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.get(key);
    if (result.content) {
      return Buffer.isBuffer(result.content)
        ? result.content
        : Buffer.from(result.content);
    }
    return null;
  } catch (err) {
    console.warn(
      "[oss] getObject failed (best-effort):",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Generate a signed URL for temporary read access to a private object.
 *
 * @param key      OSS key
 * @param ttlSec   URL validity in seconds (default 3600 = 1 hour)
 * @returns        Signed URL string, or null on failure
 */
export async function signedUrl(
  key: string,
  ttlSec: number = 3600,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const url = client.signatureUrl(key, {
      expires: ttlSec,
      // Optionally override response content type for downloads
    });
    return url as string;
  } catch (err) {
    console.warn(
      "[oss] signedUrl failed (best-effort):",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Delete an object from Alibaba Cloud OSS.
 *
 * Best-effort: returns false on failure (never throws).
 *
 * @param key  OSS key
 * @returns    true on success, false on failure
 */
export async function deleteObject(key: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    await client.delete(key);
    return true;
  } catch (err) {
    console.warn(
      "[oss] deleteObject failed (best-effort):",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Health check — verify OSS connectivity by attempting a HEAD on the bucket.
 * Used by the /health endpoint to report OSS status.
 *
 * @returns    true if OSS is configured and reachable, false otherwise
 */
export async function isOssAvailable(): Promise<boolean> {
  if (!isOssConfigured()) return false;
  const client = getClient();
  if (!client) return false;
  try {
    // A list with max-keys=0 is the cheapest bucket reachability check.
    // The ali-oss types require a second argument; pass an empty options object.
    await client.list({ "max-keys": 0 }, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Construct the public URL for an OSS key (without signing).
 * Only meaningful if the bucket is public or fronted by a CDN.
 */
export function publicUrlForKey(key: string): string | null {
  if (!isOssConfigured()) return null;
  if (OSS_PUBLIC_URL) {
    return `${OSS_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  // Default OSS public URL shape
  return `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${key}`;
}

/**
 * Mirror a try-on artifact to OSS. This is the high-level helper called
 * by apps/api/routes/agent-tryon.js after the R2 upload succeeds.
 *
 * The key is namespaced under "tryon/" so all mirrored artifacts are
 * grouped and easy to audit. Returns the OSS URL on success, null on
 * failure (best-effort — never blocks the request).
 *
 * @param receiptId   Try-on receipt ID (used in the key path)
 * @param role        "input" | "output" | "polaroid" | "sharecard"
 * @param body        Buffer of image bytes
 * @param contentType MIME type (e.g. "image/jpeg")
 * @returns           { key, url } on success, null on failure
 */
export async function mirrorTryOnArtifact(
  receiptId: string,
  role: "input" | "output" | "polaroid" | "sharecard",
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string } | null> {
  const ext = contentType.includes("png") ? "png" : "jpg";
  const key = `tryon/${receiptId}/${role}.${ext}`;
  return putObject(key, body, contentType);
}
