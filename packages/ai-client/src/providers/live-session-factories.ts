/**
 * live-session-factories — Provider-agnostic session factory registry
 *
 * Each factory knows how to provision a backend session and create a
 * LiveSession for its provider. Adding a new provider requires:
 *   1. One factory entry here
 *   2. One backend branch in /api/ai/live-session
 * No new hooks or UI changes needed.
 *
 * Fallback ladder convention (Wave 1, 0G Bridge Buildathon):
 *   The three free polling providers (venice, replicate, azure) cascade
 *   through each other and through `0g` (the 0G Compute Router) before
 *   falling through to `gemini` (the premium WebSocket terminal).
 *   `0g` is a TEE-attested HTTP provider — same wire shape as the others
 *   — so it slots in cleanly. `gemini` remains the terminal because
 *   0G is HTTP-only and cannot replace the live WebSocket experience.
 */

import type {
  LiveSessionFactory,
  SessionConfig,
  ProvisionedSessionConfig,
} from "../use-live-provider";
import { VeniceLiveProvider } from "./venice-live-provider";
import { GeminiLiveProvider } from "./gemini-live-provider";
import { ReplicateLiveProvider } from "./replicate-live-provider";
import { AzureLiveProvider } from "./azure-live-provider";
import { ZeroGLiveProvider } from "./zero-g-live-provider";
import { QwenCloudLiveProvider } from "./qwen-cloud-live-provider";

const VENICE_FREE_SESSION_SECONDS = 60;

// ── Venice AI (free tier, polling-based via backend proxy) ──

const veniceFactory: LiveSessionFactory = {
  name: "venice",
  displayName: "Venice AI",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [
    {
      goal: "daily",
      title: "Quick Outfit Check",
      description: "Framing, fit, color read, and one clear next move.",
      icon: "zap",
      color: "emerald",
      badgeLabel: "Fast",
    },
    {
      goal: "event",
      title: "Event Prep",
      description: "Check polish, silhouette, and event fit before you leave.",
      icon: "star",
      color: "amber",
      badgeLabel: "Occasion",
    },
    {
      goal: "critique",
      title: "Honest Critique",
      description: "Find what is not working and what to change first.",
      icon: "eye",
      color: "rose",
      badgeLabel: "Direct",
    },
  ],

  fallbackChain: ["qwen-cloud", "replicate", "azure", "0g", "gemini"],

  realTimeFrames: false,
  supportsAudio: () => false,

  frameIntervalMs: () => 3000,

  sendFramePixels: () => true,

  hasSessionTimer: () => true,

  maxSessionDurationMs: () => VENICE_FREE_SESSION_SECONDS * 1000,

  maxCaptures: () => 3,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "venice",
        goal: config.goal || "daily",
        persona: config.persona,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to connect to Venice AI");
    }

    const data = await response.json();
    return {
      pollingInterval: data.config?.pollingInterval ?? 3000,
      model: data.config?.model ?? "qwen3-vl-235b-a22b",
    };
  },

  createSession: (provisionedConfig: ProvisionedSessionConfig, goal: string) => {
    const provider = new VeniceLiveProvider({
      pollingIntervalMs:
        (provisionedConfig.pollingInterval as number) ?? 3000,
    });
    return provider.createSession(goal);
  },
};

// ── Replicate AI Vision (free-mium, GPT-4o-mini via Replicate) ──

const replicateFactory: LiveSessionFactory = {
  name: "replicate",
  displayName: "Replicate AI",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [
    {
      goal: "daily",
      title: "Fashion Vision",
      description: "Advanced AI analysis using GPT-4o vision — fit, palette, and styling insights.",
      icon: "sparkles",
      color: "violet",
      badgeLabel: "AI Vision",
    },
    {
      goal: "critique",
      title: "Deep Critique",
      description: "Detailed, actionable critique powered by GPT-4o — no sugarcoating.",
      icon: "eye",
      color: "fuchsia",
      badgeLabel: "Deep",
    },
  ],

  fallbackChain: ["azure", "venice", "0g", "gemini"],

  realTimeFrames: false,
  supportsAudio: () => false,

  frameIntervalMs: () => 2500,

  sendFramePixels: () => false,

  hasSessionTimer: () => false,

  maxSessionDurationMs: () => 300_000, // 5 min

  maxCaptures: () => 10,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "replicate",
        goal: config.goal || "daily",
        persona: config.persona,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to connect to Replicate AI");
    }

    const data = await response.json();
    return {
      pollingInterval: data.config?.pollingInterval ?? 2500,
      model: data.config?.model ?? "gpt-4o-mini",
    };
  },

  createSession: (provisionedConfig: ProvisionedSessionConfig, goal: string) => {
    const provider = new ReplicateLiveProvider({
      pollingIntervalMs:
        (provisionedConfig.pollingInterval as number) ?? 2500,
    });
    return provider.createSession(goal);
  },
};

// ── Azure Computer Vision (free-mium, object detection + tagging via Azure CV) ──

const azureFactory: LiveSessionFactory = {
  name: "azure",
  displayName: "Azure CV",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [
    {
      goal: "daily",
      title: "Visual Analysis",
      description: "Object detection, garment tagging, and color analysis powered by Azure Computer Vision.",
      icon: "sparkles",
      color: "sky",
      badgeLabel: "AI Vision",
    },
  ],

  fallbackChain: ["replicate", "venice", "0g", "gemini"],

  realTimeFrames: false,
  supportsAudio: () => false,

  frameIntervalMs: () => 3000,

  sendFramePixels: () => false,

  hasSessionTimer: () => false,

  maxSessionDurationMs: () => 300_000, // 5 min

  maxCaptures: () => 10,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "azure",
        goal: config.goal || "daily",
        persona: config.persona,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to connect to Azure CV");
    }

    const data = await response.json();
    return {
      pollingInterval: data.config?.pollingInterval ?? 3000,
      model: data.config?.model ?? "azure-cv-4.0",
    };
  },

  createSession: (provisionedConfig: ProvisionedSessionConfig, goal: string) => {
    const provider = new AzureLiveProvider({
      pollingIntervalMs:
        (provisionedConfig.pollingInterval as number) ?? 3000,
    });
    return provider.createSession(goal);
  },
};

// ── Gemini Live (premium, WebSocket-based with optional BYOK) ──

const geminiFactory: LiveSessionFactory = {
  name: "gemini",
  displayName: "Gemini",
  isPremium: true,
  requiresPayment: true,
  supportsByok: true,
  // Gemini is the terminal of the fallback chain. Other free-tier
  // providers (venice, replicate, azure, 0g) MUST NOT silently fall
  // back to gemini — it would 402 immediately when no BYOK key is
  // configured on the server. Users reach gemini explicitly via the
  // comparison screen or premium upgrade flow.
  disableFallback: true,
  cards: [
    {
      goal: "daily",
      title: "Voice Stylist",
      description: "Longer live session with voice-led styling and richer context.",
      icon: "crown",
      color: "indigo",
      badgeLabel: "Premium",
    },
  ],

  realTimeFrames: true,
  supportsAudio: () => true,

  frameIntervalMs: () => 1000,

  sendFramePixels: () => false,

  hasSessionTimer: () => false,

  maxSessionDurationMs: () => 1_800_000, // 30 min

  maxCaptures: () => Infinity,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "gemini",
        goal: config.goal || "daily",
        persona: config.persona,
        byok: config.apiKey?.trim() || undefined,
      }),
    });

    const { config: provConfig, error: provError } = await response
      .json()
      .catch(() => ({}));

    if (!response.ok || provError || !provConfig) {
      throw new Error(provError || "Failed to provision Gemini session");
    }

    return {
      apiKey: provConfig.apiKey,
      baseURL: provConfig.baseURL,
      model: provConfig.model ?? "models/gemini-2.0-flash-live-001",
      systemInstruction: provConfig.systemInstruction,
    };
  },

  createSession: async (
    provisionedConfig: ProvisionedSessionConfig,
    _goal: string,
  ) => {
    const provider = new GeminiLiveProvider({
      apiKey: provisionedConfig.apiKey as string | undefined,
      httpOptions: {
        baseUrl: provisionedConfig.baseURL as string | undefined,
        systemInstruction:
          provisionedConfig.systemInstruction as string | undefined,
      },
    });
    return provider.connectLiveSession!();
  },
};

// ── 0G Compute (Wave 1, 0G Bridge Buildathon) ───────────────────────────────
//
// 0G Router is OpenAI Chat Completions compatible over HTTP, so we
// reuse the same polling-loop shape as Venice / Replicate / Azure.
// The provider carries a default vision model (qwen3-vl-30b) verified
// against the live catalog at https://router-api.0g.ai/v1/models, with
// a TEE-attested fallback to dstack / TDX. There is intentionally no
// `connectLiveSession` — 0G is HTTP-only and the chain still terminates
// at Gemini for the WebSocket premium experience.

const zerogFactory: LiveSessionFactory = {
  name: "0g",
  displayName: "0G Compute",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [
    {
      goal: "daily",
      title: "TEE-Verified Stylist",
      description:
        "0G Compute Router — verifiable AI with TEE attestation. Cheapest vision-capable model in the catalog.",
      icon: "shield",
      color: "emerald",
      badgeLabel: "Verified",
    },
    {
      goal: "critique",
      title: "African Fashion Insight",
      description:
        "Multi-vertical fashion critique routed through 0G's decentralized GPU marketplace.",
      icon: "globe",
      color: "lime",
      badgeLabel: "0G",
    },
  ],

  // 0G itself doesn't fall back to a different 0G model — once the
  // Router errors, the chain goes to the Gemini premium terminal.
  fallbackChain: ["gemini"],

  realTimeFrames: false,
  supportsAudio: () => false,

  frameIntervalMs: () => 2500,

  sendFramePixels: () => false,

  hasSessionTimer: () => false,

  maxSessionDurationMs: () => 300_000, // 5 min

  maxCaptures: () => 10,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "0g",
        goal: config.goal || "daily",
        persona: config.persona,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || "Failed to connect to 0G Compute",
      );
    }

    const data = await response.json();
    return {
      pollingInterval: data.config?.pollingInterval ?? 2500,
      // The backend /api/ai/live-session resolves the default model from
      // ZERO_G_MODEL, defaulting to qwen3-vl-30b on the verified catalog.
      model: data.config?.model ?? "qwen3-vl-30b",
    };
  },

  createSession: (provisionedConfig, goal) => {
    const provider = new ZeroGLiveProvider({
      pollingIntervalMs:
        (provisionedConfig.pollingInterval as number) ?? 2500,
      model: (provisionedConfig.model as string) ?? "qwen3-vl-30b",
    });
    return provider.createSession(goal);
  },
};

// ── Qwen Cloud (DashScope) — Qwen Cloud Hackathon, Track 4 ─────────────────
//
// First-party Qwen Cloud integration. The API is OpenAI Chat Completions
// compatible over HTTP, so we reuse the same polling-loop shape as
// Venice / Replicate / Azure / 0G. The default vision model
// (qwen3-vl-flash) is the cheapest vision-capable entry on the Qwen Cloud
// catalog ($0.05/$0.40 per 1M tokens). Spend controls (kill switch, daily
// budget, max_tokens caps, enable_thinking: false) are enforced on the
// Hetzner backend route. There is intentionally no `connectLiveSession` —
// Qwen Cloud is HTTP-only and the chain still terminates at Gemini for
// the WebSocket premium experience.

const qwenCloudFactory: LiveSessionFactory = {
  name: "qwen-cloud",
  displayName: "Qwen Cloud",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [
    {
      goal: "daily",
      title: "Qwen Cloud Stylist",
      description:
        "Direct Qwen Cloud (DashScope) vision analysis. Cheapest vision model with African textile awareness.",
      icon: "zap",
      color: "violet",
      badgeLabel: "Qwen",
    },
    {
      goal: "african",
      title: "African Fashion Insight",
      description:
        "Qwen3-VL identifies Ankara, Kente, Adire, Bogolan, Shweshwe patterns with cultural context.",
      icon: "globe",
      color: "amber",
      badgeLabel: "African",
    },
    {
      goal: "critique",
      title: "Honest Critique",
      description:
        "Direct, blunt fashion feedback from Qwen Cloud. No sugarcoating.",
      icon: "eye",
      color: "rose",
      badgeLabel: "Direct",
    },
  ],

  // Qwen Cloud is the primary provider; fall through to the existing
  // chain if it is unavailable.
  fallbackChain: ["venice", "replicate", "azure", "0g", "gemini"],

  realTimeFrames: false,
  supportsAudio: () => false,

  frameIntervalMs: () => 2500,

  sendFramePixels: () => false,

  hasSessionTimer: () => false,

  maxSessionDurationMs: () => 300_000, // 5 min

  maxCaptures: () => 10,

  provisionSession: async (config: SessionConfig) => {
    const response = await fetch("/api/ai/live-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "qwen-cloud",
        goal: config.goal || "daily",
        persona: config.persona,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || "Failed to connect to Qwen Cloud",
      );
    }

    const data = await response.json();
    return {
      pollingInterval: data.config?.pollingInterval ?? 2500,
      model: data.config?.model ?? "qwen3-vl-flash",
    };
  },

  createSession: (provisionedConfig, goal) => {
    const provider = new QwenCloudLiveProvider({
      pollingIntervalMs:
        (provisionedConfig.pollingInterval as number) ?? 2500,
      model: (provisionedConfig.model as string) ?? "qwen3-vl-flash",
    });
    return provider.createSession(goal);
  },
};

// ── Registry ──

export const SESSION_FACTORIES: Record<string, LiveSessionFactory> = {
  "qwen-cloud": qwenCloudFactory,
  venice: veniceFactory,
  replicate: replicateFactory,
  azure: azureFactory,
  "0g": zerogFactory,
  gemini: geminiFactory,
};

// Find the first premium provider in the registry (for "Switch to Premium" flows)
export function findPremiumProvider(): LiveSessionFactory | null {
  for (const factory of Object.values(SESSION_FACTORIES)) {
    if (factory.isPremium) return factory;
  }
  return null;
}

export type SupportedProvider = keyof typeof SESSION_FACTORIES;
