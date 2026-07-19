/**
 * MCP tool implementations — thin wrappers over the OnPoint API.
 *
 * Each tool is a pure function: (args) → JSON result.
 * The server.ts file handles the MCP protocol framing.
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────
const API_BASE =
  process.env.ONPOINT_API_BASE || "https://api.onpoint.famile.xyz";

// Load .env from apps/api if DASHSCOPE_API_KEY isn't already set
// (so the MCP server can run standalone without a separate env file).
function loadEnv() {
  if (process.env.DASHSCOPE_API_KEY) return;
  try {
    // Walk up from packages/qwen-mcp/src/ to repo root
    const repoRoot = resolve(__dirname, "../../..");
    const envPath = resolve(repoRoot, "apps/api/.env");
    const envFile = readFileSync(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && match[1] && match[2] && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // .env not found — env vars must be set externally
  }
}
loadEnv();

// ── Qwen Cloud client (inline minimal version) ────────────────
// We inline a minimal client here so the MCP server is self-contained
// and doesn't need the @repo/qwen-cloud workspace package at runtime.
const QWEN_BASE_URL =
  process.env.QWEN_CLOUD_BASE_URL ||
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const QWEN_VISION_MODEL = process.env.QWEN_CLOUD_VISION_MODEL || "qwen3-vl-flash";

async function qwenVision(
  imageDataUrl: string,
  prompt: string,
  maxTokens = 200,
): Promise<{ analysis: string; model: string; costUsd: number }> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY not configured");

  if (process.env.QWEN_CLOUD_KILL_SWITCH === "1") {
    throw new Error("Qwen Cloud kill switch is active (QWEN_CLOUD_KILL_SWITCH=1)");
  }

  const res = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QWEN_VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a fashion stylist AI. Provide concise, actionable feedback. Keep responses under 100 words.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      enable_thinking: false,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qwen Cloud error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const analysis = data.choices?.[0]?.message?.content || "";
  // Cost estimate
  const pricing = { in: 0.05, out: 0.4 }; // qwen3-vl-flash
  const costUsd =
    Math.round(
      (((data.usage?.prompt_tokens || 0) / 1e6) * pricing.in +
        ((data.usage?.completion_tokens || 0) / 1e6) * pricing.out) * 1e6,
    ) / 1e6;

  return { analysis, model: data.model || QWEN_VISION_MODEL, costUsd };
}

// ── API helpers ────────────────────────────────────────────────
async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Tool dispatcher ────────────────────────────────────────────
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "browse_curator_directory":
      return apiGet("/api/agent/directory");

    case "browse_storefront": {
      const slug = String(args.curatorSlug || "");
      if (!slug) throw new Error("curatorSlug is required");
      return apiGet(`/api/agent/storefront/${slug}`);
    }

    case "analyze_outfit": {
      const imageDataUrl = String(args.imageDataUrl || "");
      if (!imageDataUrl) throw new Error("imageDataUrl is required");
      const goal = String(args.goal || "daily");
      const prompts: Record<string, string> = {
        daily: "Analyze this everyday outfit. Focus on comfort, coordination, and practicality.",
        event: "Analyze this outfit for a formal event. Focus on elegance and appropriateness.",
        critique: "Give an honest, blunt critique of this outfit. No sugarcoating.",
        african: "Identify any African textile patterns in this outfit (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print). Note cultural context and styling.",
      };
      const prompt = prompts[goal] ?? prompts.daily ?? "Analyze this outfit.";
      const result = await qwenVision(imageDataUrl, prompt);
      return {
        provider: "qwen-cloud",
        model: result.model,
        goal,
        analysis: result.analysis,
        estimatedCostUsd: result.costUsd,
      };
    }

    case "analyze_african_textile": {
      const imageDataUrl = String(args.imageDataUrl || "");
      if (!imageDataUrl) throw new Error("imageDataUrl is required");
      const prompt =
        "Identify any African textile patterns in this outfit (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print). " +
        "For each pattern found, note: (1) the pattern name, (2) cultural origin, (3) how it's styled, (4) occasion-appropriateness. " +
        "If no African patterns are present, say so and suggest how African elements could be incorporated.";
      const result = await qwenVision(imageDataUrl, prompt, 300);
      return {
        provider: "qwen-cloud",
        model: result.model,
        analysis: result.analysis,
        estimatedCostUsd: result.costUsd,
        capability: "african-textile-identification",
      };
    }

    case "try_on": {
      const curatorSlug = String(args.curatorSlug || "");
      const listingId = String(args.listingId || "");
      const photoData = String(args.photoData || "");
      const paymentTxHash = args.paymentTxHash ? String(args.paymentTxHash) : undefined;
      if (!curatorSlug || !listingId || !photoData) {
        throw new Error("curatorSlug, listingId, and photoData are required");
      }
      const { status, data } = await apiPost(
        `/api/agent/try-on/${curatorSlug}/${listingId}`,
        { photoData, ...(paymentTxHash ? { paymentTxHash } : {}) },
      );
      // Surface 402 challenges as structured data so the agent can act
      if (status === 402) {
        return {
          status: "payment_required",
          challenge: data,
          nextStep: "Pay cUSD on Celo to the payTo address with the dataSuffix, then call try_on again with paymentTxHash.",
        };
      }
      return { status: "success", result: data };
    }

    case "buy_item": {
      const curatorSlug = String(args.curatorSlug || "");
      const listingId = String(args.listingId || "");
      const size = String(args.size || "");
      const quantity = Number(args.quantity || 1);
      const paymentTxHash = args.paymentTxHash ? String(args.paymentTxHash) : undefined;
      const quoteId = args.quoteId ? String(args.quoteId) : undefined;
      const referralCode = args.referralCode ? String(args.referralCode) : undefined;
      if (!curatorSlug || !listingId || !size) {
        throw new Error("curatorSlug, listingId, and size are required");
      }
      const { status, data } = await apiPost(
        `/api/agent/order/${curatorSlug}/${listingId}`,
        {
          size,
          quantity,
          ...(paymentTxHash ? { paymentTxHash } : {}),
          ...(quoteId ? { quoteId } : {}),
          ...(referralCode ? { referralCode } : {}),
        },
      );
      if (status === 402) {
        return {
          status: "payment_required",
          challenge: data,
          nextStep: "Pay cUSD on Celo to the payTo address with the dataSuffix, then call buy_item again with paymentTxHash and quoteId.",
        };
      }
      return { status: "success", result: data };
    }

    case "check_earnings": {
      const slug = String(args.curatorSlug || "");
      if (!slug) throw new Error("curatorSlug is required");
      return apiGet(`/api/agent/earnings/${slug}`);
    }

    case "list_looks": {
      const params = new URLSearchParams();
      if (args.curator) params.set("curator", String(args.curator));
      if (args.tag) params.set("tag", String(args.tag));
      if (args.agent) params.set("agent", String(args.agent));
      const qs = params.toString();
      return apiGet(`/api/agent/looks${qs ? `?${qs}` : ""}`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
