"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Lock, Volume2, Square } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { speakAsPersona, stopSpeaking } from "../../lib/utils/persona-voice";

interface PersonalityCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
  isLocked?: boolean;
}

const SHORT_GREETINGS: Record<string, string> = {
  miranda: "I am Miranda Priestly. Let's see what we're working with.",
  edina: "Darling! It's Edina. Let's make you look fabulous!",
  shaft: "Right on. John Shaft here. Let's find your style.",
  luxury: "Greetings. Anna Wintour here. Let's refine your look.",
  streetwear: "Virgil here. Let's talk street style and fresh drops.",
  sustainable: "Stella McCartney here. Let's find something sustainable.",
};

export function PersonalityCard({
  persona,
  isSelected,
  onSelect,
  disabled,
  isLocked = false,
}: PersonalityCardProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const mountedRef = useRef(true);
  const config = getPersonaConfig(persona);
  const Icon = config.icon;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSpeaking();
    };
  }, []);

  const toggleVoice = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const greeting = SHORT_GREETINGS[persona] || `Hi, I'm ${config.characterName}. Let's find your style.`;
      speakAsPersona(greeting, persona).finally(() => {
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
    }
  }, [isPlaying, persona, config.characterName]);

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
        {!isLocked && (
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
              isPlaying
                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title={isPlaying ? "Stop" : "Hear their voice"}
          >
            {isPlaying ? (
              <>
                <Square className="h-2.5 w-2.5 fill-current" />
                <span className="flex items-center gap-[2px] ml-0.5">
                  <span className="w-[2px] h-3 bg-current rounded-full animate-pulse" />
                  <span className="w-[2px] h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-[2px] h-3.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
              </>
            ) : (
              <Volume2 className="h-2.5 w-2.5" />
            )}
          </button>
        )}
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
