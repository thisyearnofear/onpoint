"use client";

import React from "react";
import { Lock } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { getPersonaConfig } from "../../lib/utils/persona-config";

interface PersonalityCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
  isLocked?: boolean;
}

export function PersonalityCard({
  persona,
  isSelected,
  onSelect,
  disabled,
  isLocked = false,
}: PersonalityCardProps) {
  const config = getPersonaConfig(persona);
  const Icon = config.icon;

  return (
    <div
      role="button"
      tabIndex={disabled || isLocked ? -1 : 0}
      aria-label={`Select ${config.label} (${config.characterName})`}
      aria-pressed={isSelected}
      className={`relative p-4 border-2 rounded-lg transition-all duration-200 ${
        isSelected
          ? `border-primary ${config.lightBg} shadow-md`
          : isLocked
          ? "border-gray-200 bg-gray-50 opacity-60"
          : "border-border hover:border-primary/50 cursor-pointer"
      } ${disabled || isLocked ? "cursor-not-allowed" : ""}`}
      onClick={() => !disabled && !isLocked && onSelect(persona)}
      onKeyDown={(e) => {
        if (!disabled && !isLocked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(persona);
        }
      }}
    >
      {isLocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      )}
      
      <div className="flex flex-col items-center gap-2">
        <Icon className={`h-6 w-6 ${isSelected ? config.lightColor : isLocked ? "text-gray-400" : config.lightColor}`} />
        <div className="text-sm font-medium text-center">
          {config.characterName}
        </div>
        {config.tier === 'premium' && !isLocked && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
            PRO
          </span>
        )}
        {!isLocked && (
          <span className={`text-[10px] px-2 py-1 rounded-full ${
            config.mode === 'honest' ? 'bg-blue-100 text-blue-700' :
            config.mode === 'roast' ? 'bg-red-100 text-red-700' :
            'bg-green-100 text-green-700'
          }`}>
            {config.mode === 'honest' ? '💼 Honest' : config.mode === 'roast' ? '🔥 Roast' : '✨ Hype'}
          </span>
        )}
        {isLocked && (
          <span className="text-[10px] text-gray-500">Unlock with Pro</span>
        )}
      </div>
    </div>
  );
}
