"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface AuditLogEntry {
  suggestionId: string;
  action: string;
  amount: string;
  txHash: string | null;
  decision: "signed" | "rejected" | "failed";
  reason: string | null;
  tokenId: string | null;
  ts: number;
  timestamp: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  mint: "NFT Mint",
  contract_call: "Contract Call",
  tip: "Tip Received",
  purchase: "Purchase",
  external_purchase: "External Buy",
  approve: "Token Approve",
};

const EXPLORER_BASE = "https://celoscan.io/tx/";

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
}

export function AgentAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [redisAvailable, setRedisAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchLog() {
      setLoading(true);
      try {
        const res = await fetch("/api/agent/audit-log?limit=20");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setRedisAvailable(data.redisAvailable !== false);
      } catch {
        // endpoint may not be available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLog();
    return () => { cancelled = true; };
  }, []);

  if (!redisAvailable) return null;

  const visible = expanded ? entries : entries.slice(0, 3);
  const signedCount = entries.filter((e) => e.decision === "signed").length;
  const totalAmount = entries
    .filter((e) => e.decision === "signed")
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="mx-4 mb-3">
      <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <ScrollText className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Transaction Audit Log
              </p>
              <p className="text-[10px] text-muted-foreground">
                {total} onchain actions
                {signedCount > 0 && (
                  <> · <span className="text-emerald-400">{signedCount} signed</span></>
                )}
                {totalAmount > 0 && (
                  <> · {formatAmount(String(totalAmount))} total</>
                )}
              </p>
            </div>
          </div>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 text-violet-300 animate-spin" />
          )}
        </div>

        {/* Entries */}
        {entries.length === 0 && !loading ? (
          <p className="text-[10px] text-muted-foreground text-center py-3">
            No onchain transactions yet. Tip the agent or enable auto-buy to see activity here.
          </p>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {visible.map((entry) => (
                <motion.div
                  key={entry.suggestionId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-background/35 px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    {/* Decision icon */}
                    {entry.decision === "signed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    ) : entry.decision === "rejected" ? (
                      <XCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                    )}

                    {/* Action + amount */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {ACTION_LABELS[entry.action] || entry.action.replace(/_/g, " ")}
                        </span>
                        {entry.amount && parseFloat(entry.amount) > 0 && (
                          <span className="text-[10px] text-violet-300 font-semibold">
                            {formatAmount(entry.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-muted-foreground">
                          {entry.ts ? formatTimeAgo(entry.ts) : ""}
                        </span>
                        {entry.txHash && (
                          <a
                            href={`${EXPLORER_BASE}${entry.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[9px] text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            {entry.txHash.slice(0, 6)}...{entry.txHash.slice(-4)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {entry.reason && (
                          <span className="text-[9px] text-muted-foreground truncate">
                            · {entry.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Decision badge */}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold flex-shrink-0 ${
                        entry.decision === "signed"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : entry.decision === "rejected"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {entry.decision}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {entries.length > 3 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors pt-1.5"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    +{entries.length - 3} more transactions{" "}
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
