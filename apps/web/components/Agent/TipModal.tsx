"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, Loader2, CheckCircle2, X } from "lucide-react";
import { useAccount } from "wagmi";

interface TipSheetProps {
  isOpen: boolean;
  onClose: () => void;
  agentAddress?: string;
  /** Session score (0-10) gates available tip amounts */
  score?: number;
}

/**
 * Score-gated tip configuration.
 * Single source of truth for all tip amounts and labels.
 */
const TIP_CONFIG = {
  /** Score < 5: No tip prompt should be shown */
  low: {
    amounts: [],
    headline: "Thanks for trying!",
    subtext: "Better luck next session",
  },
  /** Score 5-7: Standard thank you */
  standard: {
    amounts: [
      { amount: "0.1", label: "Thanks!", icon: "🙏" },
      { amount: "0.25", label: "Great!", icon: "👏" },
      { amount: "0.5", label: "Amazing!", icon: "🔥" },
    ],
    headline: "Say Thanks",
    subtext: "Great session with your stylist",
  },
  /** Score 8+: Premium celebration */
  premium: {
    amounts: [
      { amount: "0.5", label: "Great!", icon: "👏" },
      { amount: "1.0", label: "Amazing!", icon: "🔥" },
      { amount: "2.0", label: "Superstar!", icon: "⭐" },
    ],
    headline: "Elite Style Session!",
    subtext: "Your stylist nailed it — celebrate!",
  },
} as const;

const AGENT_RESPONSES = [
  "Thank you! Your support keeps me styling. Keep being fabulous!",
  "You're too kind! I'll keep finding you the perfect looks.",
  "This means the world! Your style journey is my priority.",
  "With supporters like you, I'll become the best stylist ever!",
];

/**
 * Get tip configuration based on session score.
 */
function getTipConfig(score?: number) {
  if (!score) return TIP_CONFIG.standard;
  if (score >= 8) return TIP_CONFIG.premium;
  if (score >= 5) return TIP_CONFIG.standard;
  return TIP_CONFIG.low;
}

/**
 * TipSheet - Bottom sheet for post-session tipping
 *
 * Design:
 * - Progressive disclosure: single CTA → expands to amounts
 * - Score-gated: amounts adapt to session quality
 * - Inline feedback: success shown in-place, no state transition
 */
export function TipSheet({
  isOpen,
  onClose,
  agentAddress,
  score,
}: TipSheetProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sentAmount, setSentAmount] = useState<string | null>(null);

  const config = useMemo(() => getTipConfig(score), [score]);
  const showTipPrompt = config.amounts.length > 0;

  const handleQuickTip = async (amount: string) => {
    if (!isConnected || !connectedAddress) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/agent/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          chain: "celo",
          token: "cUSD",
          fromAddress: connectedAddress,
          toAddress: agentAddress,
        }),
      });

      if (!response.ok) throw new Error("Tip failed");

      setSentAmount(amount);
    } catch (err) {
      console.error("Tip failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setSentAmount(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Bottom Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-slate-800 to-slate-900 rounded-t-3xl border-t border-white/10 shadow-2xl"
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="px-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold">{config.headline}</h2>
                <p className="text-slate-400 text-xs">{config.subtext}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-8">
            {/* Wallet status */}
            {!isConnected && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center mb-4">
                <p className="text-amber-200 text-sm">
                  Connect your wallet to send tips
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {sentAmount ? (
                /* Inline success feedback */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Thanks sent!</p>
                    <p className="text-slate-400 text-xs">
                      {sentAmount} cUSD on Celo
                    </p>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </motion.div>
              ) : !showTipPrompt ? (
                /* No tip prompt for low scores */
                <motion.div
                  key="no-tip"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4"
                >
                  <p className="text-slate-400 text-sm">
                    Keep practicing — your stylist will get you there!
                  </p>
                </motion.div>
              ) : isExpanded ? (
                /* Expanded: amount selection */
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-3 gap-3">
                    {config.amounts.map((tip) => (
                      <button
                        key={tip.amount}
                        onClick={() => handleQuickTip(tip.amount)}
                        disabled={!isConnected || isProcessing}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                        ) : (
                          <span className="text-2xl">{tip.icon}</span>
                        )}
                        <span className="text-white font-bold">
                          {tip.amount} cUSD
                        </span>
                        <span className="text-slate-400 text-xs">
                          {tip.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-slate-500 text-xs">
                    Tips go directly to the stylist's wallet on Celo
                  </p>
                </motion.div>
              ) : (
                /* Collapsed: single CTA (progressive disclosure) */
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    onClick={() => setIsExpanded(true)}
                    disabled={!isConnected}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Heart className="w-5 h-5" />
                    Say Thanks
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * @deprecated Use TipSheet instead - kept for backward compatibility
 */
export const TipModal = TipSheet;
