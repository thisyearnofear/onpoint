import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { createPublicClient, http, formatEther } from "viem";
import { celo, celoSepolia, AGENT_WALLET } from "../../../../config/chains";
import {
  rateLimit,
  RateLimits,
  rateLimitHeaders,
  getClientId,
} from "../../../../lib/utils/rate-limit";
import { logger } from "../../../../lib/utils/logger";
import { createSessionToken } from "../../../../lib/utils/session-token";
import type { SessionTokenPayload } from "../../../../lib/utils/session-token";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../_utils/http";

// Payment recipient address (OnPoint's wallet)
const RECIPIENT_ADDRESS = AGENT_WALLET;

// Minimum payment amount in CELO (0.4 CELO to account for slight variations)
const MIN_PAYMENT_CELO = 0.4;

// Session token duration (24 hours)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface VerifyPaymentRequest {
  transactionHash: string;
  chainId?: number;
  expectedAmount?: string;
  walletAddress?: string;
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
  const chain = chainId === celo.id ? celo : celoSepolia;

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
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") || "*";
    const clientId = getClientId(req);

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

      const body: VerifyPaymentRequest = await req.json();
      const {
        transactionHash,
        chainId = celoSepolia.id,
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

      logger.info("Verifying CELO payment...", { component: "verify-payment", ...{ transactionHash, chainId } });

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

      logger.info("Payment verified successfully!", { component: "verify-payment", ...{
        wallet: verification.from,
        amount: verification.amount,
        tokenExpiry: new Date(tokenPayload.exp).toISOString(),
      } });

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
      logger.error("Payment verification error", { component: "verify-payment" }, error);

      const errorMessage =
        error instanceof Error ? error.message : "Payment verification failed";

      return NextResponse.json(
        { error: errorMessage },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

