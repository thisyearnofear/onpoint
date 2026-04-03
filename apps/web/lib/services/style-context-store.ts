/**
 * Unified Style Context Store
 *
 * Bridges Virtual Try-On and Live AR sessions into a single style memory.
 * When a user gets a "High-End Luxury" analysis in Virtual Try-On, the agent
 * in the Live AR session can reference it: "I see we were looking at that
 * silk blazer earlier—how does the fit feel now that you're moving?"
 *
 * Design: Single source of truth (DRY), composable (MODULAR), Redis-backed
 * with in-memory fallback (PERFORMANT).
 */

import { logger } from "../utils/logger";
import type { StylePreference } from "../middleware/agent-controls";
import {
  getStylePreferences,
  updateStylePreferences,
} from "../middleware/agent-controls";
import {
  persistStylePreferences,
  loadStylePreferences,
} from "../middleware/agent-store";

// ── Types ──

export interface StyleContextEntry {
  id: string;
  source: "virtual-try-on" | "live-ar" | "chat" | "catalog";
  type:
    | "outfit-analysis"
    | "recommendation"
    | "preference-update"
    | "session-goal";
  content: string;
  metadata: {
    category?: string;
    score?: number;
    persona?: string;
    imageUrl?: string;
    productName?: string;
    price?: number;
    timestamp: number;
  };
}

export interface UnifiedStyleContext {
  userId: string;
  preferences: StylePreference;
  recentAnalyses: StyleContextEntry[];
  sessionGoals: Array<{ goal: string; timestamp: number }>;
  lastActiveSource: StyleContextEntry["source"] | null;
  crossFeatureInsights: string[];
}

// ── In-memory store (Redis-backed in production) ──

const contextStore: Map<string, UnifiedStyleContext> = new Map();

// ── Core Functions ──

/**
 * Get unified style context for a user.
 * Merges preferences from agent-controls with recent analyses.
 */
export async function getUnifiedContext(
  userId: string,
): Promise<UnifiedStyleContext> {
  if (contextStore.has(userId)) {
    return contextStore.get(userId)!;
  }

  // Hydrate from Redis
  const prefs = await loadStylePreferences(userId);
  const basePrefs = prefs || getStylePreferences(userId);

  const context: UnifiedStyleContext = {
    userId,
    preferences: basePrefs,
    recentAnalyses: [],
    sessionGoals: [],
    lastActiveSource: null,
    crossFeatureInsights: [],
  };

  contextStore.set(userId, context);
  return context;
}

/**
 * Record a style analysis from any feature.
 * This is the bridge between Virtual Try-On, Live AR, and Chat.
 */
export async function recordStyleAnalysis(
  userId: string,
  entry: Omit<StyleContextEntry, "id">,
): Promise<void> {
  const context = await getUnifiedContext(userId);

  const fullEntry: StyleContextEntry = {
    ...entry,
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  // Add to recent analyses (keep last 20)
  context.recentAnalyses.unshift(fullEntry);
  if (context.recentAnalyses.length > 20) {
    context.recentAnalyses = context.recentAnalyses.slice(0, 20);
  }

  // Update last active source
  context.lastActiveSource = entry.source;

  // Update preferences based on analysis
  if (entry.metadata.category) {
    updateStylePreferences(userId, {
      categories: [entry.metadata.category],
    });
    // Sync preferences back to context
    context.preferences = getStylePreferences(userId);
  }

  // Generate cross-feature insight
  const insight = generateCrossFeatureInsight(context, fullEntry);
  if (insight) {
    context.crossFeatureInsights.unshift(insight);
    if (context.crossFeatureInsights.length > 10) {
      context.crossFeatureInsights = context.crossFeatureInsights.slice(0, 10);
    }
  }

  // Persist
  contextStore.set(userId, context);
  persistStylePreferences(context.preferences).catch((err) =>
    logger.error(
      "Style context persist failed",
      { component: "style-context" },
      err,
    ),
  );
}

/**
 * Record a session goal for cross-feature continuity.
 */
export async function recordSessionGoal(
  userId: string,
  goal: string,
): Promise<void> {
  const context = await getUnifiedContext(userId);
  context.sessionGoals.unshift({ goal, timestamp: Date.now() });
  if (context.sessionGoals.length > 10) {
    context.sessionGoals = context.sessionGoals.slice(0, 10);
  }
  contextStore.set(userId, context);
}

/**
 * Get contextual prompt for Live AR session.
 * Returns a string the AI can use to reference previous style analyses.
 */
export async function getContextualPrompt(userId: string): Promise<string> {
  const context = await getUnifiedContext(userId);

  if (context.recentAnalyses.length === 0) {
    return "";
  }

  const recent = context.recentAnalyses.slice(0, 3);
  const parts: string[] = [];

  for (const entry of recent) {
    if (entry.source === "virtual-try-on" && entry.type === "outfit-analysis") {
      parts.push(
        `Previously analyzed in Virtual Try-On: "${entry.content}" (score: ${entry.metadata.score || "N/A"}/10, category: ${entry.metadata.category || "unknown"})`,
      );
    }
    if (entry.source === "live-ar" && entry.type === "recommendation") {
      parts.push(
        `Live AR session recommended: "${entry.content}" for ${entry.metadata.category || "general styling"}`,
      );
    }
  }

  if (context.crossFeatureInsights.length > 0) {
    parts.push(`Style insight: ${context.crossFeatureInsights[0]}`);
  }

  return parts.join("\n");
}

/**
 * Get recent analyses for display in UI.
 */
export async function getRecentAnalyses(
  userId: string,
  limit = 5,
): Promise<StyleContextEntry[]> {
  const context = await getUnifiedContext(userId);
  return context.recentAnalyses.slice(0, limit);
}

/**
 * Get cross-feature insights for dashboard display.
 */
export async function getCrossFeatureInsights(
  userId: string,
): Promise<string[]> {
  const context = await getUnifiedContext(userId);
  return context.crossFeatureInsights;
}

// ── Helpers ──

function generateCrossFeatureInsight(
  context: UnifiedStyleContext,
  newEntry: StyleContextEntry,
): string | null {
  const recent = context.recentAnalyses.slice(1, 4); // Exclude the one we just added

  // Insight: Pattern across categories
  const categories = recent
    .filter((e) => e.metadata.category)
    .map((e) => e.metadata.category!);
  if (categories.length >= 2) {
    const uniqueCats = [...new Set(categories)];
    if (uniqueCats.length >= 2) {
      return `You're exploring ${uniqueCats.join(" and ")} — these pair well together`;
    }
  }

  // Insight: Score trend
  const scores = recent
    .filter((e) => e.metadata.score != null)
    .map((e) => e.metadata.score!);
  if (scores.length >= 2 && newEntry.metadata.score != null) {
    const avgPrev = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (newEntry.metadata.score > avgPrev) {
      return `Style score trending up: ${newEntry.metadata.score} vs avg ${avgPrev.toFixed(1)}`;
    }
  }

  // Insight: Cross-feature continuity
  if (
    newEntry.source === "live-ar" &&
    recent.some((e) => e.source === "virtual-try-on")
  ) {
    return "Continuing your Virtual Try-On analysis in Live AR — great workflow!";
  }

  return null;
}

// ── Exports ──

export const StyleContextStore = {
  getUnifiedContext,
  recordStyleAnalysis,
  recordSessionGoal,
  getContextualPrompt,
  getRecentAnalyses,
  getCrossFeatureInsights,
};
