"use client";

import React from "react";
import { Sparkles, Crown, Zap, Leaf, Star, MessageCircle } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { getPersonaConfig } from "../../lib/utils/persona-config";

// ── Types ──

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type AnimationState = "idle" | "speaking" | "thinking" | "wave";

interface PersonaAvatarProps {
  persona: StylistPersona;
  size?: AvatarSize;
  animate?: AnimationState;
  showRing?: boolean;
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

// ── Size Map ──

const SIZE_MAP: Record<AvatarSize, { container: string; icon: string; label: string }> = {
  xs: { container: "w-6 h-6", icon: "w-3 h-3", label: "text-[8px]" },
  sm: { container: "w-8 h-8", icon: "w-4 h-4", label: "text-[9px]" },
  md: { container: "w-10 h-10", icon: "w-5 h-5", label: "text-[10px]" },
  lg: { container: "w-14 h-14", icon: "w-7 h-7", label: "text-xs" },
  xl: { container: "w-20 h-20", icon: "w-10 h-10", label: "text-sm" },
  "2xl": { container: "w-28 h-28", icon: "w-14 h-14", label: "text-base" },
};

// ── Animation Keyframes ──

const ANIMATIONS: Record<AnimationState, string> = {
  idle: "",
  speaking: "animate-persona-speaking",
  thinking: "animate-persona-thinking",
  wave: "animate-persona-wave",
};

// ── Greeting Lines ──

const GREETING_LINES: Record<string, string> = {
  miranda: "The truth, elegantly delivered.",
  edina: "Absolutely fabulous, darling!",
  shaft: "Right on. Let's find your style.",
  luxury: "Refinement is everything.",
  streetwear: "Stay fresh. Stay you.",
  sustainable: "Fashion with a conscience.",
};

// ── Component ──

export function PersonaAvatar({
  persona,
  size = "md",
  animate = "idle",
  showRing = false,
  showBadge = false,
  className = "",
  onClick,
}: PersonaAvatarProps) {
  const config = getPersonaConfig(persona);
  const Icon = config.icon;
  const sizeClass = SIZE_MAP[size];
  const animClass = ANIMATIONS[animate];

  return (
    <div
      className={`relative inline-flex flex-col items-center gap-1 ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Avatar Circle */}
      <div
        className={`
          relative ${sizeClass.container} rounded-full flex items-center justify-center
          transition-all duration-300
          ${config.bg}
          ${showRing ? `ring-2 ${config.border.replace("border-", "ring-")} ring-offset-2 ring-offset-background` : ""}
          ${onClick ? "cursor-pointer hover:scale-110 active:scale-95 hover:animate-glow-pulse" : ""}
          ${animClass}
          overflow-hidden
        `}
        title={`${config.characterName} — ${config.description}`}
      >
        <Icon className={`${sizeClass.icon} text-${config.text} relative z-10`} />

        {/* Subtle gradient overlay on hover */}
        <div
          className={`
            absolute inset-0 rounded-full opacity-0 transition-opacity duration-300
            bg-gradient-to-br ${config.gradient}
            ${onClick ? "hover:opacity-20" : ""}
          `}
        />

        {/* Speaking animation bars */}
        {animate === "speaking" && (
          <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
            <span
              className="w-[3px] rounded-full bg-white/80 animate-speech-bar"
              style={{ height: "40%", animationDelay: "0ms" }}
            />
            <span
              className="w-[3px] rounded-full bg-white/80 animate-speech-bar"
              style={{ height: "60%", animationDelay: "150ms" }}
            />
            <span
              className="w-[3px] rounded-full bg-white/80 animate-speech-bar"
              style={{ height: "30%", animationDelay: "300ms" }}
            />
            <span
              className="w-[3px] rounded-full bg-white/80 animate-speech-bar"
              style={{ height: "50%", animationDelay: "100ms" }}
            />
          </div>
        )}

        {/* Thinking dots */}
        {animate === "thinking" && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "200ms" }} />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "400ms" }} />
          </div>
        )}
      </div>

      {/* Badge / Label */}
      {size !== "xs" && (
        <span className={`${sizeClass.label} font-medium text-muted-foreground text-center leading-tight`}>
          {config.characterName}
        </span>
      )}

      {showBadge && size !== "xs" && (
        <span
          className={`
            ${sizeClass.label} px-1.5 py-0.5 rounded-full font-medium              ${config.bg} text-${config.text}
          `}
        >
          {GREETING_LINES[persona] || config.label}
        </span>
      )}
    </div>
  );
}

// ── Preset Components ──

export function MascotWelcome({ persona }: { persona: StylistPersona }) {
  const config = getPersonaConfig(persona);
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <PersonaAvatar persona={persona} size="2xl" animate="wave" showRing />
      <p className="text-sm text-muted-foreground italic text-center max-w-xs leading-relaxed">
        &ldquo;{GREETING_LINES[persona] || config.description}&rdquo;
      </p>
    </div>
  );
}

export function MascotThinking({ persona, message }: { persona: StylistPersona; message?: string }) {
  const config = getPersonaConfig(persona);
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
      <PersonaAvatar persona={persona} size="md" animate="thinking" showRing />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{config.characterName} is thinking...</p>
        {message && <p className="text-xs text-muted-foreground mt-0.5">{message}</p>}
      </div>
    </div>
  );
}

export function MascotSpeaking({ persona }: { persona: StylistPersona }) {
  return (
    <PersonaAvatar persona={persona} size="md" animate="speaking" showRing />
  );
}
