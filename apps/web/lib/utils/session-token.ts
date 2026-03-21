/**
 * Session token utilities for Gemini Live access
 *
 * Tokens are issued after successful CELO payment verification
 * and validated when requesting Gemini Live sessions.
 */

import { createHmac } from "crypto";

// HMAC secret for signing tokens (should be in environment variables)
const TOKEN_SECRET =
  process.env.TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "dev-secret-change-in-production";

export interface SessionTokenPayload {
  sub: string; // wallet address
  iat: number; // issued at
  exp: number; // expires at
  provider: "gemini";
  txHash: string;
  amount: string;
}

/**
 * Create a signed session token using HMAC
 */
export function createSessionToken(payload: SessionTokenPayload): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", TOKEN_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest("base64url");
  return `${header}.${payloadStr}.${signature}`;
}

/**
 * Verify a session token (for internal use)
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts as [string, string, string];

    // Verify signature
    const expectedSig = createHmac("sha256", TOKEN_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    // Decode payload
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as SessionTokenPayload;

    // Check expiry
    if (decoded.exp < Date.now()) return null;

    return decoded;
  } catch {
    return null;
  }
}
