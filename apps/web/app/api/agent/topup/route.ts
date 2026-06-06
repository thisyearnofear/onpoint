/**
 * Agent TopUp API (Next.js route) — /api/agent/topup
 *
 * Browser-facing wrapper around the Express `/api/agent/topup` route on
 * the Hetzner API server. Forwards the request and propagates the
 * service-key header. The actual integration logic lives in
 * `@repo/etherfuse` and is shared with the API server.
 *
 * Sub-paths:
 *   POST /api/agent/topup          — { action: "quote" | "order", ... }
 *   GET  /api/agent/topup?orderId — fetch order status
 *   GET  /api/agent/topup?balance=1&userAddress=0x.. — credit ledger
 *
 * Keeping the surface as a single POST/GET handler (no per-action routes)
 * matches the browser fetch style used elsewhere in the app and avoids
 * route explosions for an MVP integration.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";

export { OPTIONS } from "../../ai/_utils/http";

const QuoteActionSchema = z.object({
  action: z.literal("quote"),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fiatAmount: z.string().min(1),
  fiat: z.enum(["MXN", "USD", "EUR"]).default("MXN"),
  chain: z.enum(["celo", "base", "ethereum", "polygon"]).default("base"),
});

const OrderActionSchema = z.object({
  action: z.literal("order"),
  quote: z.object({
    quoteId: z.string().min(1),
    fiat: z.enum(["MXN", "USD", "EUR"]),
    fiatAmount: z.string(),
    cryptoAsset: z.string(),
    cryptoAmount: z.string(),
    rate: z.string(),
    fees: z.string(),
    expiresAt: z.string(),
    paymentInstructions: z.any().optional(),
    chain: z.enum(["celo", "base", "ethereum", "polygon"]),
    recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  idempotencyKey: z.string().optional(),
});

const TopUpRequestSchema = z.discriminatedUnion("action", [
  QuoteActionSchema,
  OrderActionSchema,
]);

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

async function forward(
  pathname: string,
  init: RequestInit,
): Promise<Response> {
  if (!AGENT_API_URL) {
    return new Response(
      JSON.stringify({ success: false, error: "AGENT_API_URL not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  return fetch(`${AGENT_API_URL.replace(/\/$/, "")}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(SERVICE_API_KEY ? { "x-service-key": SERVICE_API_KEY } : {}),
      ...(init.headers ?? {}),
    },
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = TopUpRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    if (parsed.data.action === "quote") {
      const { userAddress, fiatAmount, fiat, chain } = parsed.data;
      const upstream = await forward("/api/agent/topup/quote", {
        method: "POST",
        body: JSON.stringify({ userAddress, fiatAmount, fiat, chain }),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status, headers: corsHeaders(origin) });
    }

    // action === "order"
    const { quote, idempotencyKey } = parsed.data;
    const upstream = await forward("/api/agent/topup/order", {
      method: "POST",
      body: JSON.stringify({ quote, idempotencyKey }),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status, headers: corsHeaders(origin) });
  } catch (error) {
    logger.apiError("/api/agent/topup", "TopUp API error", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    const balance = url.searchParams.get("balance");
    const userAddress = url.searchParams.get("userAddress");

    if (orderId) {
      const upstream = await forward(
        `/api/agent/topup/order/${encodeURIComponent(orderId)}`,
        { method: "GET" },
      );
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status, headers: corsHeaders(origin) });
    }

    if (balance && userAddress) {
      const upstream = await forward(
        `/api/agent/topup/balance?userAddress=${encodeURIComponent(userAddress)}`,
        { method: "GET" },
      );
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status, headers: corsHeaders(origin) });
    }

    return NextResponse.json(
      { success: false, error: "Provide orderId OR balance=1&userAddress=0x.." },
      { status: 400, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.apiError("/api/agent/topup", "TopUp API error", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
