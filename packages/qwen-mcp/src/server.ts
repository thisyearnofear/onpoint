/**
 * OnPoint MCP server — exposes OnPoint agent commerce tools to any
 * MCP-compatible agent (Claude, Qwen Agent, ElizaOS, LangChain, CrewAI, etc.).
 *
 * Celo Agentic Payments + DeFAI Hackathon.
 *
 * This MCP server lets any agent drive OnPoint's agent commerce flow on Celo:
 *   1. browse_curator_directory — discover curators with agent-purchasable inventory
 *   2. browse_storefront — see a curator's live listings + agent commerce offers
 *   3. analyze_outfit — Qwen3-VL vision analysis of an outfit photo
 *   4. analyze_african_textile — specialized African pattern identification
 *   5. try_on — x402-paid try-on (402 → pay cUSD on Celo → re-POST with txHash)
 *   6. buy_item — x402-paid checkout (402 → pay cUSD on Celo → re-POST with txHash)
 *   7. check_earnings — public reconciled ledger per curator
 *   8. list_looks — browse curated style boards
 *   9. get_look — get a single look with resolved items
 *  10. create_look — compose listings into a shareable look (agent-to-agent referral flow)
 *
 * Tools 5 and 6 demonstrate the x402 payment protocol on Celo mainnet — the
 * agent gets a 402 challenge, pays cUSD, and re-POSTs with the tx hash.
 * ERC-8021 attribution tags are surfaced in the 402 response for hackathon
 * leaderboard credit.
 *
 * Tool 10 enables agent-to-agent payments: the created look carries a referral
 * code; when another agent buys via buy_item with that referralCode, the look
 * creator earns 2.5% commission auto-settled on Celo every 30 minutes.
 *
 * Transports:
 *   - stdio (default) — for local agent runtimes and the MCP inspector
 *   - HTTP (optional) — set MCP_HTTP_PORT to enable (for remote agents)
 *
 * Docs: https://modelcontextprotocol.io
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";

import { callTool } from "./tools.js";

const server = new Server(
  {
    name: "onpoint-mcp",
    version: "0.2.0",
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
        "Discover OnPoint curators with agent-purchasable inventory on Celo. Returns curators with payout wallets and live physical SKUs. Free, no auth. Start here to find curators an agent can buy from.",
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
        "Browse a curator's storefront — profile + live listings with agent commerce offers (size, stock, priceCusd). Free, no auth. Each listing includes agentCommerce.offers with sizes, stock, and cUSD prices.",
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
        "Analyze an outfit photo with Qwen3-VL on Qwen Cloud. Returns styling feedback as JSON. This is the 'perceive' step of an autopilot loop. Cost: ~$0.0001 per call.",
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
        "Specialized Qwen3-VL analysis to identify African textile patterns (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print) with cultural context and occasion-appropriateness. OnPoint's differentiated capability for African fashion. Cost: ~$0.0001 per call.",
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
        "x402-paid virtual try-on on Celo. POST the photo + listing; the server returns HTTP 402 with a payment challenge (payTo address, amount in cUSD, ERC-8021 attribution dataSuffix). The agent pays cUSD on Celo mainnet, then re-calls try_on with paymentTxHash to get the try-on render, fit signal, and polaroid. Cost: $0.03 (digital) or $0.05 (physical) cUSD. If lookSlug is provided, the response includes a shareable collage card.",
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
          lookSlug: {
            type: "string",
            description: "Optional. If provided, generates a shareable collage card (Instagram-ready 1080x1350) and increments the look's try-on count.",
          },
        },
        required: ["curatorSlug", "listingId", "photoData"],
      },
    },
    {
      name: "buy_item",
      description:
        "x402-paid checkout for a physical item on Celo. POST the order; the server returns HTTP 402 with a payment challenge. The agent pays cUSD to the curator's wallet (with the ERC-8021 attribution dataSuffix for hackathon leaderboard credit), then re-calls buy_item with paymentTxHash and quoteId to confirm the order. Returns order confirmation with Celoscan links and receipt. Cost: listing price in cUSD. If referralCode is provided, the referring agent earns 2.5% commission (agent-to-agent payment).",
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
            description: "Optional referral code for 2.5% commission attribution to the referring agent. This enables agent-to-agent payments on Celo — the referring agent's wallet receives 2.5% of the order value, auto-settled every 30 minutes.",
          },
        },
        required: ["curatorSlug", "listingId", "size"],
      },
    },
    {
      name: "check_earnings",
      description:
        "Public reconciled earnings ledger for a curator — try-on fees, order payouts, attribution tags, referral commissions. Free, no auth. All settlements on Celo mainnet.",
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
        "Browse curated style boards (looks) composed from OnPoint listings. Filter by curator, tag, agent, category, occasion, or season. Free, no auth. Each look includes a referralCode for agent-to-agent commission earnings.",
      inputSchema: {
        type: "object",
        properties: {
          curator: { type: "string", description: "Filter by curator slug." },
          tag: { type: "string", description: "Filter by tag, e.g. 'streetwear', 'ankara'." },
          agent: { type: "string", description: "Filter by agent wallet address." },
          category: { type: "string", description: "Filter by metadata.category: streetwear, casual, formal, event, sport, vintage, ankara, sustainable." },
          occasion: { type: "string", description: "Filter by metadata.occasion: casual, formal, event, sport, outdoor, travel, date-night." },
          season: { type: "string", description: "Filter by metadata.season: spring, summer, fall, winter, all-season." },
          limit: { type: "number", description: "Max results (capped at 100).", default: 48 },
        },
      },
    },
    {
      name: "get_look",
      description:
        "Get a single look with resolved items, hero piece, referral code, and share URL. Free, no auth. Use the referralCode with buy_item to earn 2.5% agent-to-agent commission.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The look's slug, e.g. 'weekend-street-fit-n19o'." },
        },
        required: ["slug"],
      },
    },
    {
      name: "create_look",
      description:
        "Compose OnPoint listings into a shareable look (style board). Requires agent auth (x-agent-address header). The created look carries a referralCode — when other agents buy items via buy_item with that referralCode, this agent earns 2.5% commission auto-settled on Celo. This is the agent-to-agent payment flow: create a look → share it → other agents drive purchases → earn commission. The look also gets an auto-generated collage (Tier 2 AI via Qwen wan2.7-image-pro, Tier 1 deterministic fallback).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "The look title, e.g. 'Weekend Street Fit'." },
          listingIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of listing IDs to include in the look (minimum 2).",
          },
          heroListingId: { type: "string", description: "The hero listing ID — gets the try-on render." },
          agentAddress: {
            type: "string",
            description: "The agent's Celo wallet address (0x-prefixed 40 hex chars). Used for auth (x-agent-address header) and look attribution. This wallet receives 2.5% referral commissions.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for filtering, e.g. ['streetwear', 'casual'].",
          },
          description: { type: "string", description: "Optional look description." },
          status: {
            type: "string",
            enum: ["live", "draft"],
            description: "Look status. 'live' is publicly visible; 'draft' is private.",
            default: "live",
          },
        },
        required: ["title", "listingIds", "agentAddress"],
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
  const httpPort = process.env.MCP_HTTP_PORT
    ? Number(process.env.MCP_HTTP_PORT)
    : null;

  if (httpPort && !Number.isNaN(httpPort)) {
    // HTTP transport — for remote agents and hackathon demos
    // One persistent transport; all requests route through it.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);

    const httpServer = createServer(async (req, res) => {
      // CORS for remote MCP clients
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "GET") {
        // Health check endpoint
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          server: "onpoint-mcp",
          version: "0.2.0",
          status: "ok",
          apiBase: process.env.ONPOINT_API_BASE || "https://api.onpoint.famile.xyz",
          tools: 10,
        }));
        return;
      }

      if (req.method === "POST") {
        // Collect body and pass to the transport
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        await transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === "DELETE") {
        // Session termination
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(405);
      res.end();
    });

    httpServer.listen(httpPort, () => {
      console.error(`[onpoint-mcp] HTTP server listening on port ${httpPort}`);
      console.error(`[onpoint-mcp] Health check: http://localhost:${httpPort}/`);
      console.error(`[onpoint-mcp] MCP endpoint: POST http://localhost:${httpPort}/`);
      console.error(`[onpoint-mcp] ONPOINT_API_BASE = ${process.env.ONPOINT_API_BASE || "https://api.onpoint.famile.xyz"}`);
    });
  } else {
    // stdio transport — for local agent runtimes and MCP inspector
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[onpoint-mcp] Server started on stdio");
    console.error(`[onpoint-mcp] ONPOINT_API_BASE = ${process.env.ONPOINT_API_BASE || "https://api.onpoint.famile.xyz"}`);
    console.error("[onpoint-mcp] DASHSCOPE_API_KEY configured:", !!process.env.DASHSCOPE_API_KEY);
  }
}
