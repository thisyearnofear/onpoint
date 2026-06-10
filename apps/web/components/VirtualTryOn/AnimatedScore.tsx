"use client";

import React from "react";
import { getScoreConfig } from "../../lib/utils/score-utils";
import { AnimatedCounter } from "@repo/shared-ui";

interface AnimatedScoreProps {
  score: number;
  delay?: number;
  size?: "sm" | "md" | "lg";
  showMax?: boolean;
  tier?: string;
}

export function AnimatedScore({
  score,
  delay = 0.3,
  size = "lg",
  showMax = true,
  tier,
}: AnimatedScoreProps) {
  const sizeClasses = {
    sm: "text-4xl sm:text-5xl",
    md: "text-5xl sm:text-6xl",
    lg: "text-[5rem] sm:text-[6rem]",
  };

  const maxClasses = {
    sm: "text-sm -right-3 bottom-0",
    md: "text-base -right-4 bottom-1",
    lg: "text-lg -right-4 bottom-2",
  };

  const config = getScoreConfig(score);
  const displayTier = tier ?? config.tier;
  const isElite = score >= 8;

  const tierBgClass = isElite
    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30"
    : "bg-white/20 border-white/30";
  const tierTextClass = isElite ? "text-amber-300" : "text-white";

  return (
    <div className="flex flex-col items-center">
      <div
        className="animate-count-up relative mb-3"
        style={{ animationDelay: `${delay}s` }}
      >
        <AnimatedCounter
          value={score}
          delay={delay}
          duration={1500}
          decimals={1}
          className={`${sizeClasses[size]} font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-lg`}
        />
        {showMax && (
          <span className={`absolute ${maxClasses[size]} font-bold text-white/50`}>
            /10
          </span>
        )}
      </div>

      {displayTier && (
        <div
          className={`animate-fade-in px-4 py-1 rounded-full ${tierBgClass} border backdrop-blur-sm`}
          style={{ animationDelay: `${delay + 0.4}s` }}
        >
          <span className={`text-[10px] font-bold ${tierTextClass} uppercase tracking-[0.15em]`}>
            {displayTier}
          </span>
        </div>
      )}
    </div>
  );
}
