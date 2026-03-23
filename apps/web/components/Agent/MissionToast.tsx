/**
 * Mission Toast — Completion notification
 * 
 * Shows XP earned and badge unlocked when a mission is completed.
 * Reuses the AgentSuggestionToast pattern.
 */

"use client";

import React, { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Zap, Gift, CheckCircle } from "lucide-react";

// ── Types ──

interface MissionToastProps {
  missionId: string;
  missionTitle: string;
  rewardType: "xp" | "badge" | "unlock";
  rewardValue: number | string;
  onClose: () => void;
  autoCloseMs?: number;
}

// ── Component ──

export function MissionToast({
  missionId,
  missionTitle,
  rewardType,
  rewardValue,
  onClose,
  autoCloseMs = 5000,
}: MissionToastProps) {
  // Auto-close after delay
  useEffect(() => {
    if (autoCloseMs > 0) {
      const timer = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [autoCloseMs, onClose]);

  const getRewardIcon = () => {
    switch (rewardType) {
      case "xp":
        return <Zap className="w-5 h-5 text-amber-400" />;
      case "badge":
        return <Star className="w-5 h-5 text-purple-400" />;
      case "unlock":
        return <Gift className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getRewardText = () => {
    switch (rewardType) {
      case "xp":
        return `+${rewardValue} XP`;
      case "badge":
        return `${rewardValue} Badge`;
      case "unlock":
        return `Unlocked: ${rewardValue}`;
      default:
        return String(rewardValue);
    }
  };

  const getRewardColor = () => {
    switch (rewardType) {
      case "xp":
        return "from-amber-500/20 to-orange-500/20 border-amber-500/30";
      case "badge":
        return "from-purple-500/20 to-pink-500/20 border-purple-500/30";
      case "unlock":
        return "from-emerald-500/20 to-green-500/20 border-emerald-500/30";
      default:
        return "from-indigo-500/20 to-purple-500/20 border-indigo-500/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
    >
      <div
        className={`bg-gradient-to-r ${getRewardColor()} backdrop-blur-xl border rounded-2xl p-4 shadow-2xl`}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            {getRewardIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Mission Complete!
              </span>
            </div>
            <h4 className="text-white font-bold text-sm truncate">
              {missionTitle}
            </h4>
            <p className="text-white/60 text-xs mt-0.5">
              {getRewardText()}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <span className="text-white/40">×</span>
          </button>
        </div>

        {/* Sparkle effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -top-2 -right-2"
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Hook for managing mission toasts ──

interface MissionToastState {
  id: string;
  missionId: string;
  missionTitle: string;
  rewardType: "xp" | "badge" | "unlock";
  rewardValue: number | string;
}

export function useMissionToasts() {
  const [toasts, setToasts] = React.useState<MissionToastState[]>([]);

  const addToast = useCallback(
    (toast: Omit<MissionToastState, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showMissionComplete = useCallback(
    (
      missionId: string,
      missionTitle: string,
      rewardType: "xp" | "badge" | "unlock",
      rewardValue: number | string,
    ) => {
      addToast({ missionId, missionTitle, rewardType, rewardValue });
    },
    [addToast],
  );

  return {
    toasts,
    addToast,
    removeToast,
    showMissionComplete,
  };
}