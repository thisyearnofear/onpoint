"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getScoreConfig } from "../../lib/utils/score-utils";

interface AnimatedScoreProps {
  /** Final score value (0-10) */
  score: number;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the /10 suffix */
  showMax?: boolean;
  /** Tier label to display below score (uses score-utils if not provided) */
  tier?: string;
}

/**
 * AnimatedScore - Dramatic score reveal animation
 *
 * Features:
 * - Number roll animation from 0 to final score
 * - Spring-based entrance animation
 * - Configurable size and styling
 * - Uses score-utils for tier styling (DRY)
 */
export function AnimatedScore({
  score,
  delay = 0.3,
  size = "lg",
  showMax = true,
  tier,
}: AnimatedScoreProps) {
  const [displayScore, setDisplayScore] = useState(0);

  // Size configurations
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

  // Number roll animation
  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1500;
      const steps = 30;
      const stepDuration = duration / steps;
      const increment = score / steps;
      let current = 0;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        current = Math.min(Math.round(increment * step * 10) / 10, score);
        setDisplayScore(current);

        if (step >= steps) {
          clearInterval(interval);
          setDisplayScore(score);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [score, delay]);

  // Get config from score-utils (single source of truth)
  const config = getScoreConfig(score);
  const displayTier = tier ?? config.tier;
  const isElite = score >= 8;

  const tierBgClass = isElite
    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30"
    : "bg-white/20 border-white/30";
  const tierTextClass = isElite ? "text-amber-300" : "text-white";

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          damping: 12,
          stiffness: 120,
          delay,
        }}
        className="relative mb-3"
      >
        <span
          className={`${sizeClasses[size]} font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-lg`}
        >
          {Number.isInteger(displayScore)
            ? displayScore
            : displayScore.toFixed(1)}
        </span>
        {showMax && (
          <span
            className={`absolute ${maxClasses[size]} font-bold text-white/50`}
          >
            /10
          </span>
        )}
      </motion.div>

      {displayTier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.4 }}
          className={`px-4 py-1 rounded-full ${tierBgClass} border backdrop-blur-sm`}
        >
          <span
            className={`text-[10px] font-bold ${tierTextClass} uppercase tracking-[0.15em]`}
          >
            {displayTier}
          </span>
        </motion.div>
      )}
    </div>
  );
}
