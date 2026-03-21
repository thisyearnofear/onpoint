"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Crown,
  Share2,
  ArrowRight,
  Clock,
  Palette,
  Ruler,
  Eye,
  Zap,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import type { SessionSummary, CaptureOption } from "./hooks/useLiveSession";

interface SessionEndingCardProps {
  summary: SessionSummary;
  captures: CaptureOption[];
  sessionExpired: boolean;
  isVenice: boolean;
  onUpgrade: () => void;
  onMint: () => void;
  onViewSummary: () => void;
}

const TOPIC_ICONS: Record<string, React.ElementType> = {
  "Color Harmony": Palette,
  "Fit & Proportion": Ruler,
  Accessories: Sparkles,
  "Fabric & Texture": Eye,
  "Posture & Pose": Eye,
  "Occasion Match": Clock,
  Layering: Zap,
};

export function SessionEndingCard({
  summary,
  captures,
  sessionExpired,
  isVenice,
  onUpgrade,
  onMint,
  onViewSummary,
}: SessionEndingCardProps) {
  const scoreColor =
    summary.score >= 8
      ? "from-amber-400 to-yellow-500"
      : summary.score >= 5
        ? "from-indigo-400 to-purple-500"
        : "from-slate-400 to-slate-500";

  const scoreLabel =
    summary.score >= 8 ? "Elite" : summary.score >= 5 ? "Strong" : "Developing";

  const shareToWarpcast = () => {
    const topicText = summary.topics.slice(0, 3).join(" · ");
    const takeawayText = summary.takeaways[0] || "Found my perfect look!";
    const text = `${scoreLabel} Style Score: ${summary.score}/10\n\n${topicText}\n\n"${takeawayText}"\n\nStyled by @onpoint AI`;

    const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent("https://onpoint.vercel.app")}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 150, delay: 0.1 }}
        className="w-full max-w-sm mx-4 overflow-hidden rounded-3xl"
      >
        {/* Card top — gradient hero with score */}
        <div
          className={`relative bg-gradient-to-br ${scoreColor} p-8 pb-10 overflow-hidden`}
        >
          {/* Decorative blur circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 blur-2xl rounded-full" />

          <div className="relative z-10">
            {/* Header — BeOnPoint branding */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white/80" />
                <span className="text-sm font-black text-white tracking-tight italic">
                  BeOnPoint
                </span>
              </div>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                {sessionExpired ? "Session Ended" : "Completed"}
              </span>
            </div>

            {/* Score — hero element */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-[0.25em] mb-2">
                Proof of Style
              </span>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 120,
                  delay: 0.3,
                }}
                className="relative mb-3"
              >
                <span className="text-[6rem] font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-lg">
                  {summary.score}
                </span>
                <span className="absolute -right-4 bottom-2 text-lg font-bold text-white/50">
                  /10
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="px-4 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm"
              >
                <span className="text-[10px] font-bold text-white uppercase tracking-[0.15em]">
                  {scoreLabel} Persona
                </span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Card body — dark */}
        <div className="bg-slate-950 p-6 space-y-5">
          {/* Topics analyzed */}
          {summary.topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-2.5 font-bold">
                Analyzed
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.topics.map((topic, i) => {
                  const Icon = TOPIC_ICONS[topic] || Sparkles;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5"
                    >
                      <Icon className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] text-slate-300 font-medium">
                        {topic}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Key insight — top takeaway */}
          {summary.takeaways.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4"
            >
              <p className="text-[9px] text-indigo-400/60 uppercase tracking-widest mb-2 font-bold">
                Key Insight
              </p>
              <p className="text-sm text-slate-200 leading-relaxed">
                &ldquo;{summary.takeaways[0]}&rdquo;
              </p>
            </motion.div>
          )}

          {/* Capture preview */}
          {captures.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-3"
            >
              <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/10">
                <img
                  src={captures[0]!.image}
                  alt="Style capture"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs text-white font-medium">
                  {captures.length} capture{captures.length !== 1 ? "s" : ""}{" "}
                  saved
                </p>
                <p className="text-[10px] text-slate-500">
                  {captures[0]!.comment.slice(0, 50)}…
                </p>
              </div>
            </motion.div>
          )}

          {/* Share button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              onClick={shareToWarpcast}
              className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full py-5 text-sm font-bold gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share on Warpcast
            </Button>
          </motion.div>

          {/* Upsell section — only for Venice */}
          {isVenice && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="space-y-2.5 pt-2 border-t border-white/5"
            >
              <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">
                Unlock More
              </p>

              <Button
                onClick={onUpgrade}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full py-5 text-sm font-bold shadow-lg shadow-indigo-500/20 gap-2"
              >
                <Crown className="w-4 h-4" />
                Gemini Live — Unlimited
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Button>

              {captures.length > 0 && (
                <Button
                  onClick={onMint}
                  variant="ghost"
                  className="w-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-full py-4 text-xs font-bold border border-amber-500/15 gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Mint as Proof of Style NFT
                </Button>
              )}
            </motion.div>
          )}

          {/* View summary — always available */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            <button
              onClick={onViewSummary}
              className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 transition-colors py-1"
            >
              View Full Summary →
            </button>
          </motion.div>

          {/* Branding footer */}
          <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-white/5">
            <Sparkles className="w-3 h-3 text-indigo-500/40" />
            <span className="text-[9px] text-slate-700 font-medium">
              Styled by{" "}
              <span className="text-indigo-500/50 font-bold italic">
                OnPoint
              </span>{" "}
              AI
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
