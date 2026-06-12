/**
 * live-session-factories — Provider-agnostic session factory registry
 *
 * Each factory knows how to provision a backend session and create a
 * LiveSession for its provider. Adding a new provider requires:
 *   1. One factory entry here
 *   2. One backend branch in /api/ai/live-session
 * No new hooks or UI changes needed.
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

  fallbackChain: ["replicate", "azure", "gemini"],

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

  fallbackChain: ["azure", "venice", "gemini"],

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

  fallbackChain: ["replicate", "venice", "gemini"],

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

// ── Registry ──

export const SESSION_FACTORIES: Record<string, LiveSessionFactory> = {
  venice: veniceFactory,
  replicate: replicateFactory,
  azure: azureFactory,
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
