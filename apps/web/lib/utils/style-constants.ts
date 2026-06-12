/**
 * Single source of truth for style-related constants used across the app.
 * Consolidates occasions, vibes, body types, display labels, and synergy data.
 *
 * Following DRY & CONSOLIDATION principles:
 * - LookCrafter (page.tsx) imports from here
 * - ContextCollector (AIStylist/ContextCollector.tsx) shares the same occasion data
 * - No inline duplication of occasion/vibe/body-type data
 */

// ============================================
// Body Types
// ============================================

export type BodyType = "slim" | "athletic" | "average" | "plus" | "petite" | "tall";

export const BODY_TYPES: { id: BodyType; label: string; emoji: string; description: string }[] = [
  { id: "slim", label: "Slim", emoji: "🧘", description: "Lean, narrow frame" },
  { id: "athletic", label: "Athletic", emoji: "💪", description: "Muscular, broad shoulders" },
  { id: "average", label: "Average", emoji: "🧍", description: "Balanced, proportional" },
  { id: "plus", label: "Curvy/Plus", emoji: "✨", description: "Fuller figure, curves" },
  { id: "petite", label: "Petite", emoji: "🌿", description: "Small, compact frame" },
  { id: "tall", label: "Tall", emoji: "🦒", description: "Long, statuesque" },
];

// ============================================
// Occasions
// ============================================

export interface Occasion {
  id: string;
  label: string;
  emoji: string;
}

export const OCCASIONS: Occasion[] = [
  { id: "date", label: "Date Night", emoji: "🌙" },
  { id: "office", label: "Office", emoji: "💼" },
  { id: "festival", label: "Festival", emoji: "🎪" },
  { id: "street", label: "Street", emoji: "🏙️" },
  { id: "casual", label: "Casual", emoji: "☀️" },
  { id: "wedding", label: "Wedding", emoji: "💍" },
  { id: "night-out", label: "Night Out", emoji: "🌃" },
  { id: "interview", label: "Interview", emoji: "🎯" },
];

/** Display-friendly labels for occasion IDs (used in share text, etc.) */
export const OCCASION_DISPLAY_LABELS: Record<string, string> = {
  date: "Date Night",
  office: "Office",
  festival: "Festival",
  street: "Street",
  casual: "Casual Weekend",
  wedding: "Wedding",
  "night-out": "Night Out",
  interview: "Interview",
};

// ============================================
// Vibes
// ============================================

export interface Vibe {
  id: string;
  label: string;
}

export const VIBES: Vibe[] = [
  { id: "minimalist", label: "Minimalist" },
  { id: "bold", label: "Bold" },
  { id: "vintage", label: "Vintage" },
  { id: "streetwear", label: "Streetwear" },
];

// ============================================
// Vibe-based asset selection
// ============================================

/** Maps vibe → asset image path (used when no body-type-specific assets exist yet) */
export const VIBE_IMAGES: Record<string, string> = {
  minimalist: "/assets/1Model.png",
  bold: "/assets/2Model.png",
  vintage: "/assets/3Model.png",
  streetwear: "/assets/1Model.png",
};

/** Vibe-based colour palettes (fallback when no occasion-specific override) */
export const VIBE_PALETTES: Record<string, string[]> = {
  minimalist: ["#2C2C2C", "#F5F0E8", "#C4A882"],
  bold: ["#FF0000", "#000000", "#FFFFFF"],
  vintage: ["#8B4513", "#DEB887", "#556B2F"],
  streetwear: ["#FF6347", "#4169E1", "#000000"],
};

// ============================================
// Occasion + Vibe Synergy (score ranges)
// ============================================

export const OCCASION_VIBE_SYNERGY: Record<string, Record<string, [number, number]>> = {
  date: { minimalist: [7, 9], bold: [7, 9], vintage: [7, 8], streetwear: [6, 8] },
  office: { minimalist: [8, 9], bold: [6, 8], vintage: [7, 9], streetwear: [5, 7] },
  festival: { minimalist: [6, 8], bold: [8, 9], vintage: [7, 8], streetwear: [8, 9] },
  street: { minimalist: [7, 8], bold: [8, 9], vintage: [7, 8], streetwear: [8, 9] },
  casual: { minimalist: [7, 8], bold: [6, 8], vintage: [7, 8], streetwear: [7, 8] },
  wedding: { minimalist: [8, 9], bold: [6, 8], vintage: [8, 9], streetwear: [5, 7] },
  "night-out": { minimalist: [6, 8], bold: [8, 9], vintage: [7, 9], streetwear: [8, 9] },
  interview: { minimalist: [8, 10], bold: [5, 7], vintage: [7, 8], streetwear: [4, 6] },
};

/** Occasion-specific palette overrides per vibe */
export const OCCASION_PALETTES: Record<string, Record<string, string[]>> = {
  date: {
    minimalist: ["#2C2C2C", "#F5F0E8", "#C4A882"],
    bold: ["#8B0000", "#FFD700", "#1A1A2E"],
    vintage: ["#D4A574", "#8B6914", "#F5F5DC"],
    streetwear: ["#FF6B35", "#000000", "#F7F7F7"],
  },
  office: {
    minimalist: ["#1B1B1B", "#FFFFFF", "#4A6FA5"],
    bold: ["#003366", "#CC0000", "#F5F5F5"],
    vintage: ["#8B7355", "#2F4F4F", "#FFFFF0"],
    streetwear: ["#36454F", "#000080", "#E8E8E8"],
  },
  festival: {
    minimalist: ["#FF69B4", "#FFFFFF", "#FFD700"],
    bold: ["#FF1493", "#00CED1", "#FFD700"],
    vintage: ["#CD853F", "#800080", "#F0E68C"],
    streetwear: ["#FF4500", "#1E90FF", "#32CD32"],
  },
  street: {
    minimalist: ["#000000", "#808080", "#FFFFFF"],
    bold: ["#FF0000", "#000000", "#FFFFFF"],
    vintage: ["#8B4513", "#DEB887", "#556B2F"],
    streetwear: ["#FF6347", "#4169E1", "#000000"],
  },
  casual: {
    minimalist: ["#D4D4D4", "#F5F5F5", "#9CA3AF"],
    bold: ["#FF5722", "#2196F3", "#FFFFFF"],
    vintage: ["#A1887F", "#6D4C41", "#EFEBE9"],
    streetwear: ["#4CAF50", "#FF9800", "#212121"],
  },
  wedding: {
    minimalist: ["#F8F8FF", "#C9A96E", "#2C3E50"],
    bold: ["#800020", "#D4AF37", "#191970"],
    vintage: ["#F5DEB3", "#8B6914", "#FFF8DC"],
    streetwear: ["#E91E63", "#FFC107", "#111111"],
  },
  "night-out": {
    minimalist: ["#1A1A2E", "#E94560", "#0F3460"],
    bold: ["#FF0055", "#00FFAA", "#000000"],
    vintage: ["#311B32", "#A239CA", "#820263"],
    streetwear: ["#FFD700", "#FF4500", "#0D0D0D"],
  },
  interview: {
    minimalist: ["#1B1B1B", "#FFFFFF", "#4A6FA5"],
    bold: ["#2F3E46", "#84A98C", "#CAD2C5"],
    vintage: ["#5C4033", "#F5F5DC", "#8B7355"],
    streetwear: ["#354F52", "#A3B18A", "#344E41"],
  },
};

// ============================================
// Budget Tiers
// ============================================

export type BudgetTier = "budget-friendly" | "moderate" | "premium" | "luxury";

export const BUDGET_TIERS: { id: BudgetTier; label: string; description: string; emoji: string }[] = [
  { id: "budget-friendly", label: "Budget", description: "Smart, affordable finds", emoji: "💰" },
  { id: "moderate", label: "Moderate", description: "Best value for quality", emoji: "⭐" },
  { id: "premium", label: "Premium", description: "Investment pieces", emoji: "💎" },
  { id: "luxury", label: "Luxury", description: "Designer & high-end", emoji: "👑" },
];
