"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  Sparkles,
  Wallet,
  ArrowRight,
  BadgeCheck,
  Shield,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { TipModal } from "./TipModal";

interface AgentActionCardProps {
  variant?: "default" | "compact" | "banner";
  score?: number;
  onMintClick?: () => void;
  onPremiumClick?: () => void;
}

/**
 * AgentActionCard - Prominent CTA for agent interactions
 *
 * This component makes tipping and agent interactions highly discoverable.
 * It's designed to be shown:
 * - After a successful style session
 * - On the dashboard as a featured action
 * - During the live session as a floating action
 */
export function AgentActionCard({
  variant = "default",
  score,
  onMintClick,
}: AgentActionCardProps) {
  const [showTipModal, setShowTipModal] = useState(false);

  if (variant === "compact") {
    return (
      <>
        <button
          onClick={() => setShowTipModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 rounded-full border border-amber-500/30 transition-all group"
        >
          <Coins className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="text-amber-300 text-sm font-medium">
            Tip Stylist
          </span>
        </button>
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
        />
      </>
    );
  }

  if (variant === "banner") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-amber-600/20 border border-amber-500/30 p-6"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/10 blur-3xl rounded-full -ml-12 -mb-12" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-bold">
                  Support Your AI Stylist
                </h3>
              </div>
              <p className="text-slate-300 text-sm">
                Tips help improve the AI and keep the service free for everyone.
                The agent has its own self-custodial wallet on Celo.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowTipModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold"
              >
                <Coins className="w-4 h-4 mr-2" />
                Tip Agent
              </Button>
              {score && score >= 8 && onMintClick && (
                <Button
                  variant="outline"
                  onClick={onMintClick}
                  className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Mint Look
                </Button>
              )}
            </div>
          </div>
        </motion.div>
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
        />
      </>
    );
  }

  // Default variant - card style
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-white/10 overflow-hidden"
      >
        {/* Header with gradient */}
        <div className="relative px-6 py-8 bg-gradient-to-r from-amber-600/20 to-orange-600/20">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">
                  AI Agent Wallet
                </h3>
                <div className="flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-xs">
                    Multi-Chain via Tether WDK
                  </span>
                </div>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Our AI Stylist has a self-custodial wallet on Celo, Base,
              Ethereum, and Polygon. It can receive tips, make payments, and
              mint NFTs autonomously.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-3">
          <button
            onClick={() => setShowTipModal(true)}
            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Send a Tip</p>
                <p className="text-slate-400 text-xs">
                  Support your AI stylist
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={() => {}}
            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Buy Premium Access</p>
                <p className="text-slate-400 text-xs">
                  0.5 CELO for Gemini Live
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
          </button>

          {score && score >= 8 && onMintClick && (
            <button
              onClick={onMintClick}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 rounded-2xl border border-indigo-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Mint Your Look</p>
                  <p className="text-slate-400 text-xs">
                    Score {score}/10 - Eligible!
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-xs">
              Secured by Tether WDK - Your tips go directly to the agent&apos;s
              self-custodial wallet
            </p>
          </div>
        </div>
      </motion.div>

      <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} />
    </>
  );
}
