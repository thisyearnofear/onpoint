import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { createPublicClient, http, formatEther } from "viem";
import { celo, celoAlfajores } from "../../../../config/chains";
import { createHmac, randomBytes } from "crypto";
import {
  rateLimit,
  RateLimits,
  rateLimitHeaders,
  getClientId,
} from "../../../../lib/utils/rate-limit";

// Payment recipient address (OnPoint's wallet)
const RECIPIENT_ADDRESS = "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1";

// Minimum payment amount in CELO (0.4 CELO to account for slight variations)
const MIN_PAYMENT_CELO = 0.4;

// Session token duration (24 hours)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// HMAC secret for signing tokens (should be in environment variables)
const TOKEN_SECRET =
  process.env.TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "dev-secret-change-in-production";

interface VerifyPaymentRequest {
  transactionHash: string;
  chainId?: number;
  expectedAmount?: string;
  walletAddress?: string;
}

interface SessionTokenPayload {
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
function createSessionToken(payload: SessionTokenPayload): string {
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

/**
 * Verify a CELO transaction on-chain
 */
async function verifyTransaction(
  txHash: string,
  chainId: number,
  expectedAmount: string,
): Promise<{
  valid: boolean;
  from: string;
  amount: string;
  blockNumber: bigint;
}> {
  const chain = chainId === celo.id ? celo : celoAlfajores;

  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  // Get transaction
  const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
  if (!tx) {
    throw new Error("Transaction not found");
  }

  // Get transaction receipt
  const receipt = await client.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });
  if (!receipt || receipt.status !== "success") {
    throw new Error("Transaction failed or not yet confirmed");
  }

  // Verify recipient
  if (tx.to?.toLowerCase() !== RECIPIENT_ADDRESS.toLowerCase()) {
    throw new Error("Transaction sent to wrong address");
  }

  // Verify amount (native CELO transfer via value)
  const sentAmount = formatEther(tx.value);
  if (parseFloat(sentAmount) < parseFloat(expectedAmount)) {
    throw new Error(
      `Insufficient amount: ${sentAmount} CELO sent, ${expectedAmount} CELO required`,
    );
  }

  return {
    valid: true,
    from: tx.from,
    amount: sentAmount,
    blockNumber: receipt.blockNumber,
  };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  const clientId = getClientId(request);

  try {
    // Apply rate limiting for payment verification
    const verifyLimit = await rateLimit(clientId, RateLimits.paymentVerify);
    if (!verifyLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many verification attempts. Please wait before trying again.",
          retryAfter: Math.ceil((verifyLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...corsHeaders(origin),
            ...rateLimitHeaders(verifyLimit),
            "Retry-After": Math.ceil(
              (verifyLimit.resetAt - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const body: VerifyPaymentRequest = await request.json();
    const {
      transactionHash,
      chainId = celoAlfajores.id,
      expectedAmount = MIN_PAYMENT_CELO.toString(),
      walletAddress,
    } = body;

    // Validate request
    if (!transactionHash || !transactionHash.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid transaction hash" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    console.log("Verifying CELO payment...", { transactionHash, chainId });

    // Verify the transaction on-chain
    const verification = await verifyTransaction(
      transactionHash,
      chainId,
      expectedAmount,
    );

    if (!verification.valid) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Verify wallet address matches transaction sender
    if (
      walletAddress &&
      walletAddress.toLowerCase() !== verification.from.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Wallet address does not match transaction sender" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Create session token
    const now = Date.now();
    const tokenPayload: SessionTokenPayload = {
      sub: verification.from.toLowerCase(),
      iat: now,
      exp: now + TOKEN_EXPIRY_MS,
      provider: "gemini",
      txHash: transactionHash,
      amount: verification.amount,
    };

    const sessionToken = createSessionToken(tokenPayload);

    console.log("Payment verified successfully!", {
      wallet: verification.from,
      amount: verification.amount,
      tokenExpiry: new Date(tokenPayload.exp).toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        token: sessionToken,
        expiresIn: TOKEN_EXPIRY_MS,
        wallet: verification.from,
        amount: verification.amount,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error: unknown) {
    console.error("Payment verification error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Payment verification failed";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
