"use client";

import React from "react";
import { Flame, Heart, Scale } from "lucide-react";
import type { CritiqueMode } from "@repo/ai-client";

interface CritiqueModeCardProps {
  mode: CritiqueMode;
  isSelected: boolean;
  onSelect: (mode: CritiqueMode) => void;
  disabled?: boolean;
}

export function CritiqueModeCard({ mode, isSelected, onSelect, disabled }: CritiqueModeCardProps) {
  const getModeConfig = (mode: CritiqueMode) => {
    const configs = {
      roast: {
        icon: Flame,
        label: "🔥 Roast Mode",
        description: "Brutally honest, no mercy",
        color: "text-red-600",
        bg: "bg-red-50"
      },
      flatter: {
        icon: Heart,
        label: "💖 Flatter Mode",
        description: "Confidence-boosting vibes",
        color: "text-pink-600",
        bg: "bg-pink-50"
      },
      real: {
        icon: Scale,
        label: "💯 Real Mode",
        description: "Honest balanced feedback",
        color: "text-blue-600",
        bg: "bg-blue-50"
      }
    };
    return configs[mode];
  };

  const config = getModeConfig(mode);
  const Icon = config.icon;

  return (
    <div
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected
        ? `border-primary ${config.bg} shadow-md`
        : 'border-border hover:border-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onSelect(mode)}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon className={`h-6 w-6 ${config.color}`} />
        <div className="text-sm font-medium">{config.label}</div>
        <div className="text-xs text-muted-foreground">{config.description}</div>
      </div>
    </div>
  );
}