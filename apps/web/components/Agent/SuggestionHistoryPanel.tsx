"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Sparkles,
  Coins,
  Zap,
  Search,
  Globe,
} from "lucide-react";
import type { ActionType } from "../../lib/middleware/agent-controls";
import type { AgentSuggestion } from "./AgentSuggestionToast";

interface SuggestionHistoryPanelProps {
  suggestions: AgentSuggestion[];
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  purchase: ShoppingBag,
  mint: Sparkles,
  tip: Coins,
  premium: Zap,
  agent_to_agent: Coins,
  external_search: Search,
  external_purchase: Globe,
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  accepted: { icon: Check, color: "text-emerald-400", label: "Accepted" },
  rejected: { icon: X, color: "text-rose-400", label: "Rejected" },
  expired: { icon: AlertCircle, color: "text-slate-500", label: "Expired" },
  executed: { icon: Check, color: "text-indigo-400", label: "Executed" },
  pending: { icon: Clock, color: "text-amber-400", label: "Pending" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SuggestionHistoryPanel({
  suggestions,
}: SuggestionHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (suggestions.length === 0) return null;

  const sorted = [...suggestions].sort((a, b) => b.createdAt - a.createdAt);
  const displayed = expanded ? sorted : sorted.slice(0, 3);

  return (
    <div className="bg-slate-900/80 border border-indigo-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Agent Suggestions
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
            {suggestions.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {displayed.map((suggestion) => {
                const Icon = ACTION_ICONS[suggestion.actionType] || Sparkles;
                const status = STATUS_CONFIG[suggestion.status] ?? {
                  icon: Clock,
                  color: "text-slate-500",
                  label: suggestion.status,
                };
                const StatusIcon = status.icon;
                return (
                  <div
                    key={suggestion.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-amber-400">
                          {suggestion.amount}
                        </span>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-500">
                          {formatTime(suggestion.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                      <span className={`text-[10px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed preview — show latest 3 */}
      {!expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {displayed.map((suggestion) => {
            const status = STATUS_CONFIG[suggestion.status] ?? {
              icon: Clock,
              color: "text-slate-500",
              label: suggestion.status,
            };
            const StatusIcon = status.icon;

            return (
              <div
                key={suggestion.id}
                className="flex items-center gap-2 text-[11px]"
              >
                <StatusIcon className={`w-3 h-3 shrink-0 ${status.color}`} />
                <span className="text-slate-400 truncate flex-1">
                  {suggestion.description}
                </span>
                <span className="text-slate-600 shrink-0">
                  {formatTime(suggestion.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
