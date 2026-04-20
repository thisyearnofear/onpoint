"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShoppingBag,
  Check,
  X,
  Clock,
  ChevronRight,
  Search,
  Globe,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { fetchAgentApi } from "../../lib/utils/agent-api";
import type { ActionType } from "../../lib/middleware/agent-controls";

interface Suggestion {
  id: string;
  actionType: ActionType;
  amount: string;
  description: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "executed";
  createdAt: number;
  reasoning?: string;
  source?: string;
}

const ICONS: Record<string, React.ElementType> = {
  purchase: ShoppingBag,
  mint: Sparkles,
  external_search: Search,
  external_purchase: Globe,
};

const STATUS: Record<string, { icon: React.ElementType; color: string }> = {
  accepted: { icon: Check, color: "text-emerald-500" },
  executed: { icon: Check, color: "text-indigo-500" },
  rejected: { icon: X, color: "text-rose-500" },
  expired: { icon: Clock, color: "text-slate-500" },
  pending: { icon: Clock, color: "text-amber-500" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function AgentActivityFeed({ onShop }: { onShop?: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentApi("/api/agent/suggestion?agentId=onpoint-stylist")
      .then((res) => (res.ok ? res.json() : { suggestions: [] }))
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Only show non-pending items (completed actions)
  const history = suggestions
    .filter((s) => s.status !== "pending")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  if (loading || history.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Your AI Stylist Activity
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {history.map((s) => {
          const Icon = ICONS[s.actionType] || Sparkles;
          const status = STATUS[s.status] ?? STATUS.pending!;
          const StatusIcon = status!.icon;

          return (
            <div
              key={s.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.description}</p>
                {s.reasoning && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    💡 {s.reasoning}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-primary">
                    {s.amount}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(s.createdAt)}
                  </span>
                </div>
              </div>
              <StatusIcon className={`w-3.5 h-3.5 shrink-0 mt-1 ${status!.color}`} />
            </div>
          );
        })}

        {/* Shop CTA if there are purchase suggestions */}
        {onShop && history.some((s) => s.actionType === "purchase" && s.status === "accepted") && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShop}
            className="w-full rounded-full text-xs mt-1"
          >
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
            View in Shop
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </Button>
        )}
      </div>
    </div>
  );
}
