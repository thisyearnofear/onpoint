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
  luxury: {
    key: "luxury",
    label: "Luxury Expert",
    characterName: "Anna Karenina",
    description: "Refined, brand-focused advice for elevated occasions",
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
    characterName: "Artful Dodger",
    description: "Fresh drops, sneaker culture, and urban style",
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
    characterName: "Mowgli",
    description: "Ethical fashion, thrift finds, and wardrobe longevity",
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
  edina: {
    key: "edina",
    label: "Edina Monsoon",
    characterName: "Edina Monsoon",
    description: "Dramatic, bold, and unapologetically fabulous, darling",
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
  miranda: {
    key: "miranda",
    label: "Miranda Priestly",
    characterName: "Miranda Priestly",
    description: "Ice-cold editorial standards and devastating precision",
    icon: Star,
    gradient: "from-rose-500 to-red-600",
    color: "rose-500",
    accent: "rose-400",
    text: "rose-400",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10",
    lightColor: "text-red-600",
    lightBg: "bg-red-50",
    layoutStyle: "cold",
  },
  shaft: {
    key: "shaft",
    label: "John Shaft",
    characterName: "John Shaft",
    description: "Classic cool, sharp tailoring, and effortless swagger",
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
};

export function getPersonaConfig(
  persona: string | null | undefined,
): PersonaConfig {
  return PERSONA_CONFIGS[persona as StylistPersona] || PERSONA_CONFIGS.luxury;
}

export const ALL_PERSONAS = Object.keys(PERSONA_CONFIGS) as StylistPersona[];
