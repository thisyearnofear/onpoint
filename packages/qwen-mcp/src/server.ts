/**
 * Qwen Cloud MCP server — exposes OnPoint agent commerce tools.
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent.
 *
 * This MCP server lets any Qwen-powered agent (or any MCP-compatible
 * client) drive OnPoint's agent commerce flow:
 *   1. browse_curator_directory — discover curators with agent-purchasable inventory
 *   2. browse_storefront — see a curator's live listings + agent commerce offers
 *   3. analyze_outfit — Qwen3-VL vision analysis of an outfit photo
 *   4. analyze_african_textile — specialized African pattern identification
 *   5. try_on — x402-paid try-on (handles 402 → payment → re-POST)
 *   6. buy_item — x402-paid checkout (handles 402 → payment → re-POST)
 *   7. check_earnings — public reconciled ledger per curator
 *   8. list_looks — browse curated style boards
 *
 * Tools 3 and 4 call Qwen Cloud directly (via the @repo/qwen-cloud client).
 * Tools 5 and 6 demonstrate the x402 payment protocol — the agent gets a
 * 402 challenge, pays cUSD on Celo, and re-POSTs with the tx hash.
 *
 * Transports:
 *   - stdio (default) — for local agent runtimes and the MCP inspector
 *   - HTTP (optional) — set MCP_HTTP_PORT to enable
 *
 * Docs: https://modelcontextprotocol.io
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { callTool } from "./tools.js";

const server = new Server(
  {
    name: "onpoint-qwen-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ── List tools ─────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "browse_curator_directory",
      description:
        "Discover OnPoint curators with agent-purchasable inventory. Returns curators with payout wallets and live physical SKUs. Free, no auth.",
      inputSchema: {
        type: "object",
        properties: {
          agentPurchasable: {
            type: "boolean",
            description: "If true, only return curators with agent commerce enabled (wallet + live SKUs). Default true.",
            default: true,
          },
        },
      },
    },
    {
      name: "browse_storefront",
      description:
        "Browse a curator's storefront — profile + live listings with agent commerce offers (size, stock, priceCusd). Free, no auth.",
      inputSchema: {
        type: "object",
        properties: {
          curatorSlug: {
            type: "string",
            description: "The curator's slug, e.g. 'nia', 'wanja', 'mo'.",
          },
        },
        required: ["curatorSlug"],
      },
    },
    {
      name: "analyze_outfit",
      description:
        "Analyze an outfit photo with Qwen3-VL on Qwen Cloud. Returns styling feedback as JSON. This is the 'perceive' step of the autopilot loop. Cost: ~$0.0001 per call.",
      inputSchema: {
        type: "object",
        properties: {
          imageDataUrl: {
            type: "string",
            description: "The outfit photo as a data URL: data:image/jpeg;base64,...",
          },
          goal: {
            type: "string",
            enum: ["daily", "event", "critique", "african"],
            description: "The analysis goal. 'african' focuses on African textile patterns.",
            default: "daily",
          },
        },
        required: ["imageDataUrl"],
      },
    },
    {
      name: "analyze_african_textile",
      description:
        "Specialized Qwen3-VL analysis to identify African textile patterns (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print) with cultural context and occasion-appropriateness. This is OnPoint's differentiated capability for the Qwen Cloud Hackathon. Cost: ~$0.0001 per call.",
      inputSchema: {
        type: "object",
        properties: {
          imageDataUrl: {
            type: "string",
            description: "The outfit photo as a data URL: data:image/jpeg;base64,...",
          },
        },
        required: ["imageDataUrl"],
      },
    },
    {
      name: "try_on",
      description:
        "x402-paid virtual try-on. POST the photo + listing; the server returns HTTP 402 with a payment challenge. The agent pays cUSD on Celo, then re-POSTs with the tx hash to get the try-on render, fit signal, and polaroid. Cost: $0.03 (digital) or $0.05 (physical) cUSD.",
      inputSchema: {
        type: "object",
        properties: {
          curatorSlug: { type: "string", description: "The curator's slug." },
          listingId: { type: "string", description: "The listing ID to try on." },
          photoData: { type: "string", description: "The user's photo as a data URL: data:image/jpeg;base64,..." },
          paymentTxHash: {
            type: "string",
            description: "Optional. The Celo tx hash of the cUSD payment. If omitted, the tool returns the 402 challenge (payTo, amountCusd, dataSuffix, quoteId). If provided, the tool completes the try-on.",
          },
        },
        required: ["curatorSlug", "listingId", "photoData"],
      },
    },
    {
      name: "buy_item",
      description:
        "x402-paid checkout for a physical item. POST the order; the server returns HTTP 402 with a payment challenge. The agent pays cUSD to the curator's wallet (with the attribution dataSuffix), then re-POSTs with the tx hash to confirm the order. Cost: listing price in cUSD.",
      inputSchema: {
        type: "object",
        properties: {
          curatorSlug: { type: "string", description: "The curator's slug." },
          listingId: { type: "string", description: "The listing ID to buy." },
          size: { type: "string", description: "The size, e.g. 'M'." },
          quantity: { type: "number", description: "Quantity to buy.", default: 1 },
          paymentTxHash: {
            type: "string",
            description: "Optional. The Celo tx hash of the cUSD payment. If omitted, the tool returns the 402 challenge. If provided, the tool confirms the order.",
          },
          quoteId: {
            type: "string",
            description: "The quoteId from the 402 challenge. Required when paymentTxHash is provided.",
          },
          referralCode: {
            type: "string",
            description: "Optional referral code for 2.5% commission attribution.",
          },
        },
        required: ["curatorSlug", "listingId", "size"],
      },
    },
    {
      name: "check_earnings",
      description:
        "Public reconciled earnings ledger for a curator — try-on fees, order payouts, attribution tags. Free, no auth.",
      inputSchema: {
        type: "object",
        properties: {
          curatorSlug: { type: "string", description: "The curator's slug." },
        },
        required: ["curatorSlug"],
      },
    },
    {
      name: "list_looks",
      description:
        "Browse curated style boards (looks) composed from OnPoint listings. Filter by curator, tag, or agent. Free, no auth.",
      inputSchema: {
        type: "object",
        properties: {
          curator: { type: "string", description: "Filter by curator slug." },
          tag: { type: "string", description: "Filter by tag, e.g. 'streetwear', 'ankara'." },
          agent: { type: "string", description: "Filter by agent wallet address." },
        },
      },
    },
  ],
}));

// ── Call tool ──────────────────────────────────────────────────
// Cast the handler to avoid TS2589 (excessive type instantiation)
// from the MCP SDK's zod schema inference. The runtime behavior is
// unchanged — this is purely a TypeScript type-depth workaround.
server.setRequestHandler(
  CallToolRequestSchema,
  (async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await callTool(name, args ?? {});
      return {
        content: [
          {
            type: "text" as const,
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }) as never,
);

// ── Start ──────────────────────────────────────────────────────
export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[onpoint-mcp] Server started on stdio");
  console.error("[onpoint-mcp] ONPOINT_API_BASE =", process.env.ONPOINT_API_BASE || "https://api.onpoint.famile.xyz");
  console.error("[onpoint-mcp] DASHSCOPE_API_KEY configured:", !!process.env.DASHSCOPE_API_KEY);
}
