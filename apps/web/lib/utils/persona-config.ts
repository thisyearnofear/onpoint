/**
 * Centralized persona configuration.
 * Single source of truth for all persona-related data across the app.
 */

import { Crown, Zap, Leaf, Sparkles, Star, MessageCircle } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";

export interface PersonaConfig {
  // Identity
  key: StylistPersona;
  label: string;
  characterName: string;
  description: string;
  mode: 'honest' | 'roast' | 'hype'; // Maps to critique style
  tier: 'free' | 'premium'; // Unlock status

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
    label: "Tan France",
    characterName: "Tan France",
    description: "You're gorgeous, let's make you shine. Supportive, confidence-building.",
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

export function isPersonaUnlocked(persona: StylistPersona, hasPremium: boolean): boolean {
  const config = getPersonaConfig(persona);
  return config.tier === 'free' || hasPremium;
}
