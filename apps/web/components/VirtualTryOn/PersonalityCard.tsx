"use client";

import React from "react";
import { Crown, Zap, Leaf, Sparkles, Star, MessageCircle } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";

interface PersonalityCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
}

export function PersonalityCard({ persona, isSelected, onSelect, disabled }: PersonalityCardProps) {
  const getPersonaConfig = (persona: StylistPersona) => {
    const configs = {
      luxury: { icon: Crown, label: "Luxury Expert", color: "text-yellow-600", bg: "bg-yellow-50" },
      streetwear: { icon: Zap, label: "Streetwear Guru", color: "text-blue-600", bg: "bg-blue-50" },
      sustainable: { icon: Leaf, label: "Eco Stylist", color: "text-green-600", bg: "bg-green-50" },
      edina: { icon: Sparkles, label: "Edina Monsoon", color: "text-purple-600", bg: "bg-purple-50" },
      miranda: { icon: Star, label: "Miranda Priestly", color: "text-red-600", bg: "bg-red-50" },
      shaft: { icon: MessageCircle, label: "Shaft", color: "text-orange-600", bg: "bg-orange-50" }
    };
    return configs[persona] || configs.luxury;
  };

  const config = getPersonaConfig(persona);
  const Icon = config.icon;

  return (
    <div
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected
        ? `border-primary ${config.bg} shadow-md`
        : 'border-border hover:border-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onSelect(persona)}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className={`h-6 w-6 ${config.color}`} />
        <div className="text-sm font-medium text-center">{config.label}</div>
      </div>
    </div>
  );
}