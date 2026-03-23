"use client";

import React from "react";
import type { StylistPersona } from "@repo/ai-client";
import { getPersonaConfig } from "../../lib/utils/persona-config";

interface PersonalityCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
}

export function PersonalityCard({
  persona,
  isSelected,
  onSelect,
  disabled,
}: PersonalityCardProps) {
  const config = getPersonaConfig(persona);
  const Icon = config.icon;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Select ${config.label} (${config.characterName})`}
      aria-pressed={isSelected}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? `border-primary ${config.lightBg} shadow-md`
          : "border-border hover:border-primary/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !disabled && onSelect(persona)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(persona);
        }
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className={`h-6 w-6 ${config.lightColor}`} />
        <div className="text-sm font-medium text-center">
          {config.characterName}
        </div>
      </div>
    </div>
  );
}
