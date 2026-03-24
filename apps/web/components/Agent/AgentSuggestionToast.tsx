"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Check,
  X,
  Clock,
  Zap,
  Coins,
  ShoppingBag,
  AlertCircle,
  Globe,
  Search,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import type { ActionType } from "../../lib/middleware/agent-controls";

export interface AgentSuggestion {
  id: string;
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "executed";
  createdAt: number;
  expiresAt: number;
  autoApprovable: boolean;
  // Enhanced fields for personalized recommendations
  reasoning?: string;
  observedFeatures?: {
    colors?: string[];
    fit?: "relaxed" | "fitted" | "loose" | "regular";
    style?: string[];
  };
  // Web agent extensions
  isSearching?: boolean;
  externalUrl?: string;
  source?: string;
  liveUrl?: string;
}

interface AgentSuggestionToastProps {
  suggestion: AgentSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: () => void;
}

const ACTION_LABELS: Record<ActionType, string> = {
  purchase: "Buy Now",
  mint: "Mint NFT",
  tip: "Send Tip",
  premium: "Go Premium",
  agent_to_agent: "Transfer",
  external_search: "Exploring Web",
  external_purchase: "External Shop",
};

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  purchase: ShoppingBag,
  mint: Sparkles,
  tip: Coins,
  premium: Zap,
  agent_to_agent: Coins,
  external_search: Search,
  external_purchase: Globe,
};

export function AgentSuggestionToast({
  suggestion,
  onAccept,
  onReject,
  onDismiss,
}: AgentSuggestionToastProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const Icon = ACTION_ICONS[suggestion.actionType] || Sparkles;
  const actionLabel = ACTION_LABELS[suggestion.actionType] || "Execute";

  // Calculate time remaining
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, suggestion.expiresAt - Date.now());
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [suggestion.expiresAt]);

  // Auto-dismiss when expired
  useEffect(() => {
    if (timeLeft === 0 && suggestion.status === "pending") {
      onDismiss();
    }
  }, [timeLeft, suggestion.status, onDismiss]);

  const secondsLeft = Math.floor(timeLeft / 1000);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(suggestion.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    onReject(suggestion.id);
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm"
    >
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">
                AI Stylist Suggests
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{secondsLeft}s</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Observed features - what the AI noticed */}
          {suggestion.observedFeatures && (
            <div className="mb-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                I noticed you're wearing
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.observedFeatures.colors?.map((color, i) => (
                  <span
                    key={`color-${i}`}
                    className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-medium"
                  >
                    {color}
                  </span>
                ))}
                {suggestion.observedFeatures.fit && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium">
                    {suggestion.observedFeatures.fit} fit
                  </span>
                )}
                {suggestion.observedFeatures.style?.map((style, i) => (
                  <span
                    key={`style-${i}`}
                    className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium"
                  >
                    {style}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {suggestion.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-amber-400 font-bold uppercase tracking-tighter">
                  {suggestion.amount}
                </p>
                {suggestion.source && (
                  <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                    at {suggestion.source}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Web Search Progress */}
          {suggestion.isSearching && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Globe className="w-3.5 h-3.5 text-indigo-400 absolute inset-0 m-auto" />
                </div>
                <div className="flex flex-col">
                  <p className="text-xs text-indigo-300 font-medium animate-pulse">
                    {suggestion.liveUrl ? "Diving into live marketplaces..." : "Searching global fashion networks..."}
                  </p>
                  <p className="text-[9px] text-indigo-400/50 uppercase tracking-tighter">
                    {suggestion.liveUrl ? "Tier 3: Autonomous Browser Active" : "Tier 2: Querying Purch Aggregate"}
                  </p>
                </div>
              </div>
              
              {suggestion.liveUrl && (
                <button
                  onClick={() => window.open(suggestion.liveUrl, "_blank")}
                  className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg flex items-center justify-center gap-2 text-[10px] text-indigo-400 font-bold border border-indigo-500/20 transition-all uppercase tracking-wider shadow-lg shadow-indigo-500/5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Watch Agent Live
                </button>
              )}
            </div>
          )}

          {/* Reasoning - why the AI recommends this */}
          {suggestion.reasoning && (
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <p>{suggestion.reasoning}</p>
            </div>
          )}

          {/* Auto-approve badge */}
          {suggestion.autoApprovable && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
              <Zap className="w-3 h-3" />
              <span>Quick action - auto-executes in 5s</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1 h-10 border-white/10 text-slate-300 hover:bg-white/10 text-sm"
          >
            <X className="w-4 h-4 mr-1" />
            {suggestion.actionType === "external_search" ? "Cancel Search" : "Skip"}
          </Button>
          <Button
            onClick={() => {
              if (suggestion.externalUrl) {
                window.open(suggestion.externalUrl, "_blank");
              }
              handleAccept();
            }}
            disabled={isProcessing || suggestion.isSearching}
            className="flex-1 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-sm"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            {actionLabel}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Hook for managing suggestions
// ============================================

export function useAgentSuggestions(agentId: string = "onpoint-stylist") {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [currentSuggestion, setCurrentSuggestion] =
    useState<AgentSuggestion | null>(null);
  const dismissedIds = React.useRef<Set<string>>(new Set());

  // Poll for new suggestions
  useEffect(() => {
    const pollSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/agent/suggestion?agentId=${agentId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);

          // Show first pending suggestion that hasn't been dismissed
          const pending = data.suggestions?.find(
            (s: AgentSuggestion) =>
              (s.status === "pending" || s.status === "accepted") &&
              !dismissedIds.current.has(s.id),
          );
          if (
            pending &&
            (!currentSuggestion || currentSuggestion.id !== pending.id)
          ) {
            setCurrentSuggestion(pending);
          }
        }
      } catch (error) {
        console.error("Failed to poll suggestions:", error);
      }
    };

    pollSuggestions();
    const interval = setInterval(pollSuggestions, 5000);
    return () => clearInterval(interval);
  }, [agentId, currentSuggestion]);

  const acceptSuggestion = async (id: string) => {
    const response = await fetch("/api/agent/suggestion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "accept" }),
    });

    if (response.ok) {
      setCurrentSuggestion(null);
    }
  };

  const rejectSuggestion = async (id: string) => {
    const response = await fetch("/api/agent/suggestion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject" }),
    });

    if (response.ok) {
      setCurrentSuggestion(null);
    }
  };

  const createSuggestion = async (params: {
    actionType: ActionType;
    amount: string;
    description: string;
    recipient?: string;
  }) => {
    const response = await fetch("/api/agent/suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, agentId }),
    });

    if (response.ok) {
      const data = await response.json();
      setCurrentSuggestion(data.suggestion);
      return data;
    }

    throw new Error("Failed to create suggestion");
  };

  return {
    suggestions,
    currentSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    createSuggestion,
    dismissSuggestion: () => {
      if (currentSuggestion) {
        dismissedIds.current.add(currentSuggestion.id);
      }
      setCurrentSuggestion(null);
    },
  };
}
