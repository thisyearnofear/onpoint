import lighthouse from "@lighthouse-web3/sdk";

export interface IPFSUploadResult {
  uri: string;
  cid: string;
  url: string;
}

/**
 * Uploads data to IPFS using Lighthouse (primary) with Grove/Lens fallback.
 *
 * Lighthouse: Filecoin-backed, requires LIGHTHOUSE_API_KEY.
 * Grove (Lens): Keyless, immutable uploads on Lens chain — no API key needed.
 *
 * Eligible for Protocol Labs Genesis Hackathon (Lighthouse)
 * and Lens Storage integration.
 */
export async function uploadToIPFS(
  data: Buffer | string | Blob,
  fileName: string = "onpoint-capture.jpg",
): Promise<IPFSUploadResult> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;

  if (apiKey) {
    try {
      return await uploadViaLighthouse(data, apiKey);
    } catch (err) {
      console.warn(
        "[IPFS] Lighthouse upload failed, falling back to Grove:",
        err,
      );
    }
  } else {
    console.warn("[IPFS] LIGHTHOUSE_API_KEY not set, using Grove fallback");
  }

  return uploadViaGrove(data, fileName);
}

/**
 * Upload via Lighthouse (Filecoin-backed).
 */
async function uploadViaLighthouse(
  data: Buffer | string | Blob,
  apiKey: string,
): Promise<IPFSUploadResult> {
  let uploadResponse;

  if (Buffer.isBuffer(data)) {
    uploadResponse = await lighthouse.uploadBuffer(data, apiKey);
  } else if (typeof data === "string") {
    uploadResponse = await lighthouse.uploadBuffer(Buffer.from(data), apiKey);
  } else {
    const arrayBuffer = await (data as Blob).arrayBuffer();
    uploadResponse = await lighthouse.uploadBuffer(
      Buffer.from(arrayBuffer),
      apiKey,
    );
  }

  const cid = uploadResponse.data.Hash;
  return {
    uri: `ipfs://${cid}`,
    cid,
    url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
  };
}

/**
 * Upload via Grove (Lens Storage) — keyless immutable uploads.
 * Uses Lens testnet chain ID (37111). For production, switch to mainnet chain ID.
 * @see https://lens.xyz/docs/storage/usage/upload
 */
async function uploadViaGrove(
  data: Buffer | string | Blob,
  fileName: string,
): Promise<IPFSUploadResult> {
  const GROVE_ENDPOINT = "https://api.grove.storage";
  const CHAIN_ID = 37111; // Lens testnet

  // Determine content type from filename
  const contentType = guessContentType(fileName);

  // Convert input to a format fetch can handle
  let body: Blob;
  if (Buffer.isBuffer(data)) {
    body = new Blob([new Uint8Array(data)], { type: contentType });
  } else if (typeof data === "string") {
    body = new Blob([data], { type: contentType });
  } else {
    body = data as Blob;
  }

  const response = await fetch(`${GROVE_ENDPOINT}/?chain_id=${CHAIN_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grove upload failed (${response.status}): ${text}`);
  }

  const result = await response.json();

  return {
    uri: result.uri || `lens://${result.storage_key}`,
    cid: result.storage_key,
    url: result.gateway_url,
  };
}

function guessContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    json: "application/json",
    mp4: "video/mp4",
  };
  return map[ext || ""] || "application/octet-stream";
}
