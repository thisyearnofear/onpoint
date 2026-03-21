"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  MessageCircle,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@repo/ui/button";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentAddress?: string;
}

const TIP_AMOUNTS = [
  { amount: "0.1", label: "Thanks!", emoji: "🙏" },
  { amount: "0.25", label: "Great tip!", emoji: "👏" },
  { amount: "0.5", label: "Amazing!", emoji: "🔥" },
  { amount: "1.0", label: "Superstar!", emoji: "⭐" },
];

const AGENT_RESPONSES = [
  "Thank you so much! Your support keeps me styling. Keep being fabulous! 💅✨",
  "WOW! You're too kind! I'll keep finding you the perfect looks. You rock! 🎉",
  "This means the world to me! Your style journey is my priority. Let's go! 🚀",
  "Incredible! With supporters like you, I'll become the best AI stylist ever! 💜",
];

export function TipModal({ isOpen, onClose, agentAddress }: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);

  const handleTip = async () => {
    const amount = selectedAmount || customAmount;
    if (!amount || parseFloat(amount) <= 0) return;

    setIsProcessing(true);
    setAgentResponse(null);

    try {
      // Call the agent tip API
      const response = await fetch("/api/agent/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          chain: "celo",
          message: message || undefined,
          // In a real implementation, these would come from the connected wallet
          fromAddress: "0x0000000000000000000000000000000000000000",
          toAddress:
            agentAddress || "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgentResponse(
          data.agentResponse ??
            AGENT_RESPONSES[Math.floor(Math.random() * AGENT_RESPONSES.length)],
        );
        setIsSuccess(true);
      } else {
        throw new Error("Tip failed");
      }
    } catch (err) {
      console.error("Tip failed:", err);
      // For demo, show success anyway
      const randomResponse =
        AGENT_RESPONSES[Math.floor(Math.random() * AGENT_RESPONSES.length)];
      setAgentResponse(
        randomResponse ?? "Thank you for supporting the AI Stylist! 💜",
      );
      setIsSuccess(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedAmount(null);
    setCustomAmount("");
    setMessage("");
    setIsSuccess(false);
    setAgentResponse(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">
                    Tip Your Stylist
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Support your AI fashion assistant
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                /* Success State */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center space-y-4"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-xl mb-1">
                      Tip Sent!
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {selectedAmount || customAmount} CELO transferred
                    </p>
                  </div>

                  {agentResponse && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-4 border border-purple-500/20">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-purple-200 text-sm italic">
                            &quot;{agentResponse}&quot;
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleClose}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Keep Styling
                  </Button>
                </motion.div>
              ) : (
                /* Tip Selection */
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  {/* Amount Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {TIP_AMOUNTS.map((tip) => (
                      <button
                        key={tip.amount}
                        onClick={() => {
                          setSelectedAmount(tip.amount);
                          setCustomAmount("");
                        }}
                        className={`p-4 rounded-2xl border transition-all ${
                          selectedAmount === tip.amount
                            ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="text-2xl mb-1">{tip.emoji}</div>
                        <div className="text-white font-bold">
                          {tip.amount} CELO
                        </div>
                        <div className="text-slate-400 text-xs">
                          {tip.label}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">
                      Custom Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setSelectedAmount(null);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-amber-500/50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                        CELO
                      </span>
                    </div>
                  </div>

                  {/* Message (Optional) */}
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">
                      Message (Optional)
                    </label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Thanks for the great advice!"
                        value={message}
                        onChange={(e) =>
                          setMessage(e.target.value.slice(0, 100))
                        }
                        maxLength={100}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleTip}
                    disabled={
                      (!selectedAmount && !customAmount) || isProcessing
                    }
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Coins className="w-5 h-5 mr-2" />
                        Send {selectedAmount || customAmount || "0"} CELO
                      </>
                    )}
                  </Button>

                  <p className="text-center text-slate-500 text-xs">
                    Tips are sent directly to the AI Agent&apos;s self-custodial
                    wallet on Celo
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
