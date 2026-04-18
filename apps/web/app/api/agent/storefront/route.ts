/**
 * Agentic Storefront - Track 1: Agentic Storefronts
 *
 * Provides dynamic pricing, inventory, and purchase flow for agent storefront.
 * The agent acts as an autonomous retailer with policy-controlled spending.
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import {
  checkSpendPolicy,
  enforceSpendPolicy,
} from "../../../../lib/services/spend-policy";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";
import { agentReputation } from "../../../../lib/services/agent-reputation";
export { OPTIONS } from "../../ai/_utils/http";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Base price in USDC
  dynamicPrice: number; // AI-adjusted price
  category: string;
  inStock: boolean;
  imageUrl?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

// Sample product catalog
const CATALOG: Product[] = [
  {
    id: "1",
    name: "Style Consultation",
    description: "1-on-1 AI styling session",
    price: 25,
    dynamicPrice: 25,
    category: "service",
    inStock: true,
  },
  {
    id: "2",
    name: "Virtual Try-On Credits",
    description: "10 AI try-on uses",
    price: 5,
    dynamicPrice: 5,
    category: "credits",
    inStock: true,
  },
  {
    id: "3",
    name: "Style Report",
    description: "Personalized style analysis",
    price: 15,
    dynamicPrice: 15,
    category: "report",
    inStock: true,
  },
  {
    id: "4",
    name: "Premium Month",
    description: "Unlimited AI styling",
    price: 50,
    dynamicPrice: 50,
    category: "subscription",
    inStock: true,
  },
];

// Dynamic pricing based on demand/time
function calculateDynamicPrice(basePrice: number, demand: number = 1): number {
  const hour = new Date().getHours();
  const isPeak = hour >= 18 && hour <= 21; // Evening rush
  const surge = isPeak ? 1.2 : 1;
  return Math.round(basePrice * surge * demand * 100) / 100;
}

// GET - Browse catalog
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders(origin) });
  }
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("q");

  let products = [...CATALOG];

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }

  // Add dynamic pricing
  const productsWithDynamic = products.map((p) => ({
    ...p,
    dynamicPrice: calculateDynamicPrice(p.price),
  }));

  return NextResponse.json(
    {
      products: productsWithDynamic,
      categories: [...new Set(CATALOG.map((p) => p.category))],
      agent: {
        name: "OnPoint Stylist Agent",
        tier: "established",
        policies: {
          maxPurchase: await agentReputation.getSpendLimit("0xAgent"),
          accepts: ["USDC", "cUSD"],
        },
      },
    },
    { headers: corsHeaders(origin) },
  );
}

// POST - Add to cart / checkout
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders(origin) });
  }

  try {
    const body = await request.json();
    const { action, items, walletAddress } = body;

    if (action === "cart") {
      // Add to cart - just validate
      const total = items.reduce((sum: number, item: CartItem) => {
        const product = CATALOG.find((p) => p.id === item.productId);
        return sum + (product?.price || 0) * item.quantity;
      }, 0);

      return NextResponse.json(
        {
          success: true,
          items,
          total,
          currency: "USDC",
        },
        { headers: corsHeaders(origin) },
      );
    }

    if (action === "checkout") {
      if (!walletAddress) {
        return NextResponse.json(
          { error: "walletAddress required" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Calculate total
      const total = items.reduce((sum: number, item: CartItem) => {
        const product = CATALOG.find((p) => p.id === item.productId);
        return sum + (product?.price || 0) * item.quantity;
      }, 0);

      // Check spend policy BEFORE purchase
      const policy = await checkSpendPolicy(walletAddress, total);

      if (!policy.allowed) {
        return NextResponse.json(
          {
            error: "SPEND_LIMIT_EXCEEDED",
            reason: policy.reason,
            maxAmount: policy.maxAmount,
            usedToday: policy.usedToday,
            remaining: policy.remaining,
          },
          { status: 402, headers: corsHeaders(origin) },
        );
      }

      // Process purchase
      await enforceSpendPolicy(walletAddress, total);

      // Create order
      const orderId = `order_${Date.now()}`;

      return NextResponse.json(
        {
          success: true,
          orderId,
          total,
          currency: "USDC",
          status: "paid",
          receipt: {
            items,
            agent: "OnPoint Stylist Agent",
            timestamp: Date.now(),
          },
        },
        { headers: corsHeaders(origin) },
      );
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'cart' or 'checkout'" },
      { status: 400, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Storefront error", { component: "storefront" }, error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

