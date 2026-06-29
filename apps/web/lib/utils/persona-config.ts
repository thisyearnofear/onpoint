/**
 * Centralized persona configuration.
 * Single source of truth for all persona-related data across the app.
 */

import { Crown, Zap, Leaf, Sparkles, Star, MessageCircle } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { G_STREAK_BADGES } from "./g-streak-config";

export interface PersonaConfig {
  // Identity
  key: StylistPersona;
  label: string;
  characterName: string;
  description: string;
  mode: 'honest' | 'roast' | 'hype'; // Maps to critique style
  tier: 'free' | 'premium'; // Unlock status

  // Unlock requirements (gamified economy — XP or badge)
  unlockRequirements?: {
    xp?: number;
    badge?: string;
  };

  /**
   * Per-session G$ cost for premium personas (in whole G$ units).
   * When set, a user who hasn't unlocked the persona via XP/badge/Pro
   * can pay this G$ amount per styling session instead. This is the
   * core "G$ has real value" surface — G$ is the free, no-card path to
   * premium styling. See ADR 0009 / goodbuilders-season-4.md.
   */
  gCost?: number;

  // Icons
  icon: React.ElementType;

  // Dark theme tokens (for session views, report card)
  gradient: string;
  color: string;
  accent: string;
  text: string;
  border: string;
  bg: string;

  // Light theme tokens (for persona selection card)
  lightColor: string;
  lightBg: string;

  // Layout hints
  layoutStyle:
    | "editorial"
    | "maximal"
    | "organic"
    | "bold"
    | "cold"
    | "classic";
}

const PERSONA_CONFIGS: Record<StylistPersona, PersonaConfig> = {
  // FREE TIER - Core Personas
  miranda: {
    key: "miranda",
    label: "Miranda Priestly",
    characterName: "Miranda Priestly",
    description: "The truth, elegantly delivered. Professional, direct, constructive.",
    mode: 'honest',
    tier: 'free',
    icon: Star,
    gradient: "from-slate-500 to-gray-600",
    color: "slate-500",
    accent: "slate-400",
    text: "slate-400",
    border: "border-slate-500/20",
    bg: "bg-slate-500/10",
    lightColor: "text-slate-600",
    lightBg: "bg-slate-50",
    layoutStyle: "cold",
  },
  edina: {
    key: "edina",
    label: "Edina Monsoon",
    characterName: "Edina Monsoon",
    description: "Darling, let's be brutally honest. Hilarious, brutal, memorable.",
    mode: 'roast',
    tier: 'free',
    icon: Sparkles,
    gradient: "from-purple-500 to-pink-600",
    color: "purple-500",
    accent: "purple-400",
    text: "purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/10",
    lightColor: "text-purple-600",
    lightBg: "bg-purple-50",
    layoutStyle: "maximal",
  },
  shaft: {
    key: "shaft",
    label: "John Shaft",
    characterName: "John Shaft",
    description: "Cool, confident, no-nonsense. Direct style advice with swagger.",
    mode: 'hype',
    tier: 'free',
    icon: MessageCircle,
    gradient: "from-orange-500 to-amber-600",
    color: "orange-500",
    accent: "orange-400",
    text: "orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/10",
    lightColor: "text-orange-600",
    lightBg: "bg-orange-50",
    layoutStyle: "classic",
  },
  
  // PREMIUM TIER - Unlockable Personas
  luxury: {
    key: "luxury",
    label: "Luxury Expert",
    characterName: "Anna Wintour",
    description: "High-end fashion focus. Refined, brand-focused advice for elevated occasions.",
    mode: 'honest',
    tier: 'premium',
    icon: Crown,
    unlockRequirements: { xp: 300, badge: "style-elite" },
    gCost: 3000, // ~$0.30 per session — the no-card premium path
    gradient: "from-amber-500 to-yellow-600",
    color: "amber-500",
    accent: "amber-400",
    text: "amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    lightColor: "text-yellow-600",
    lightBg: "bg-yellow-50",
    layoutStyle: "editorial",
  },
  streetwear: {
    key: "streetwear",
    label: "Streetwear Guru",
    characterName: "Virgil Abloh",
    description: "Urban, trendy, youth culture. Fresh drops, sneaker culture, and street style.",
    mode: 'hype',
    tier: 'premium',
    icon: Zap,
    unlockRequirements: { xp: 150, badge: "collector" },
    gCost: 1000, // ~$0.10 per session
    gradient: "from-blue-500 to-cyan-600",
    color: "blue-500",
    accent: "blue-400",
    text: "blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
    lightColor: "text-blue-600",
    lightBg: "bg-blue-50",
    layoutStyle: "bold",
  },
  sustainable: {
    key: "sustainable",
    label: "Eco Stylist",
    characterName: "Stella McCartney",
    description: "Eco-conscious, ethical fashion. Sustainable choices and wardrobe longevity.",
    mode: 'honest',
    tier: 'premium',
    icon: Leaf,
    unlockRequirements: { xp: 200, badge: "miranda-approved" },
    gCost: 2000, // ~$0.20 per session
    gradient: "from-emerald-500 to-green-600",
    color: "emerald-500",
    accent: "emerald-400",
    text: "emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    lightColor: "text-green-600",
    lightBg: "bg-green-50",
    layoutStyle: "organic",
  },
};

export function getPersonaConfig(
  persona: string | null | undefined,
): PersonaConfig {
  return PERSONA_CONFIGS[persona as StylistPersona] || PERSONA_CONFIGS.miranda;
}

export const ALL_PERSONAS = Object.keys(PERSONA_CONFIGS) as StylistPersona[];

export const FREE_PERSONAS: StylistPersona[] = ['miranda', 'edina', 'shaft'];
export const PREMIUM_PERSONAS: StylistPersona[] = ['luxury', 'streetwear', 'sustainable'];

export function isPersonaUnlocked(
  persona: StylistPersona,
  hasPremium: boolean,
  userState?: { xp: number; badges: string[] },
): boolean {
  const config = getPersonaConfig(persona);
  if (config.tier === 'free' || hasPremium) return true;
  if (!userState || !config.unlockRequirements) return false;

  const { xp, badge } = config.unlockRequirements;
  const meetsXp = xp === undefined || userState.xp >= xp;
  const meetsBadge = badge === undefined || userState.badges.includes(badge);

  // Streak badges (streak-starter / streak-keeper / streak-master /
  // streak-legend) are an alt-unlock path. They are permanent once earned
  // (positive-only streak design) and grant the corresponding persona
  // without the XP requirement.
  const hasStreakBadge = userState.badges.some((b) =>
    G_STREAK_BADGES.includes(b),
  );

  return (meetsXp && meetsBadge) || hasStreakBadge;
}

/**
 * Whether a premium persona can be accessed via a per-session G$ payment
 * (the no-card premium path). True for premium personas with a gCost.
 */
export function canPayWithG(persona: StylistPersona): boolean {
  const config = getPersonaConfig(persona);
  return config.tier === 'premium' && typeof config.gCost === 'number';
}

/**
 * The per-session G$ cost for a premium persona, or null if not payable.
 */
export function getGSessionCost(persona: StylistPersona): number | null {
  const config = getPersonaConfig(persona);
  return typeof config.gCost === 'number' ? config.gCost : null;
}

export function getPersonaUnlockHint(persona: StylistPersona): string | null {
  const config = getPersonaConfig(persona);
  if (config.tier === 'free' || !config.unlockRequirements) return null;

  const hints: string[] = [];
  const { xp, badge } = config.unlockRequirements;
  if (xp) hints.push(`${xp} XP`);
  if (badge) hints.push(`"${badge}" badge`);
  return hints.length > 0 ? `Reach ${hints.join(' or earn the ')} to unlock ${config.characterName}` : null;
}
