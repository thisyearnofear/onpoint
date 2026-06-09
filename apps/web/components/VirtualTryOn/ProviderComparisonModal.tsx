"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Crown, Sparkles, Camera, Clock, Wifi } from "lucide-react";
import { SESSION_FACTORIES } from "@repo/ai-client";
import type { LiveSessionFactory } from "@repo/ai-client";

interface ProviderComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (providerName: string, goal: string) => void;
}

function formatDuration(ms: number): string {
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`;
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms >= 1_000) return `${Math.round(ms / 1_000)}s`;
  return `${ms}ms`;
}

function formatCaptures(n: number): string {
  if (n === Infinity) return "∞";
  return String(n);
}

function formatInterval(ms: number): string {
  if (ms >= 1_000) return `${Math.round(ms / 1_000)}s`;
  return `${ms}ms`;
}

export function ProviderComparisonModal({
  isOpen,
  onClose,
  onSelect,
}: ProviderComparisonModalProps) {
  const factories = Object.values(SESSION_FACTORIES);

  if (!isOpen) return null;

  const rows: Array<{
    label: string;
    values: Array<{ factory: LiveSessionFactory; value: string }>;
  }> = [
    {
      label: "Pricing",
      values: factories.map((f) => ({
        factory: f,
        value: f.isPremium
          ? f.supportsByok
            ? "Premium / BYOK"
            : "Premium"
          : "Free",
      })),
    },
    {
      label: "Speed",
      values: factories.map((f) => ({
        factory: f,
        value: f.supportsAudio()
          ? `${formatInterval(f.frameIntervalMs())} (real-time)`
          : `~${formatInterval(f.frameIntervalMs())} per frame`,
      })),
    },
    {
      label: "Max captures",
      values: factories.map((f) => ({
        factory: f,
        value: formatCaptures(f.maxCaptures()),
      })),
    },
    {
      label: "Session duration",
      values: factories.map((f) => ({
        factory: f,
        value: f.hasSessionTimer()
          ? formatDuration(f.maxSessionDurationMs())
          : formatDuration(f.maxSessionDurationMs()),
      })),
    },
    {
      label: "Audio support",
      values: factories.map((f) => ({
        factory: f,
        value: f.supportsAudio() ? "Yes" : "No",
      })),
    },
    {
      label: "Connection",
      values: factories.map((f) => ({
        factory: f,
        value: f.supportsAudio() ? "WebSocket (live)" : "Polling (frames)",
      })),
    },
    {
      label: "Camera pixels sent",
      values: factories.map((f) => ({
        factory: f,
        value: f.sendFramePixels() ? "Yes" : "No",
      })),
    },
    {
      label: "Use cases",
      values: factories.map((f) => ({
        factory: f,
        value: f.cards.map((c) => c.title).join(", "),
      })),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-card z-10 flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Compare providers
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Side-by-side breakdown of speed, limits, and features
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Comparison table */}
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground pb-3 pr-4 sticky left-0 bg-card">
                      Feature
                    </th>
                    {factories.map((f) => {
                      const providerBadgeColor = f.isPremium
                        ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
                      return (
                        <th
                          key={f.name}
                          className="text-left pb-3 px-3 min-w-[140px]"
                        >
                          <div className="flex items-center gap-2">
                            {f.isPremium ? (
                              <Crown className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Zap className="w-4 h-4 text-emerald-400" />
                            )}
                            <span className="font-bold text-foreground text-sm">
                              {f.displayName}
                            </span>
                          </div>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider ${providerBadgeColor}`}
                          >
                            {f.isPremium ? "Premium" : "Free"}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-border/50">
                      <td className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground py-3 pr-4 sticky left-0 bg-card whitespace-nowrap">
                        {row.label}
                      </td>
                      {row.values.map(({ factory, value }) => (
                        <td
                          key={factory.name}
                          className="py-3 px-3 text-sm text-foreground"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick-select footer */}
            <div className="border-t border-border px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Quick select
              </p>
              <div className="flex flex-wrap gap-2">
                {factories.flatMap((f) =>
                  f.cards.map((card) => (
                    <button
                      key={`${f.name}-${card.goal}`}
                      onClick={() => {
                        onSelect(f.name, card.goal);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                        f.isPremium
                          ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                          : "border-border bg-muted/50 text-foreground hover:bg-muted"
                      }`}
                    >
                      {f.displayName}: {card.title}
                    </button>
                  )),
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
