"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import {
  Mic,
  PhoneOff,
  Sparkles,
  AlertCircle,
  Camera,
  Clock,
  Volume2,
  VolumeX,
  Zap,
  Crown,
  CheckCircle,
  Coins,
  ShoppingBag,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { MintLookButton } from "./MintLookButton";
import { GeminiLivePaymentButton } from "./GeminiLivePaymentButton";
import { AgentStatus } from "../Agent/AgentStatus";
import { AgentActionCard } from "../Agent/AgentActionCard";
import { TipModal } from "../Agent/TipModal";
import { AgentApprovalModal } from "../Agent/AgentApprovalModal";
import { AgentSuggestionToast } from "../Agent/AgentSuggestionToast";
import { SuggestionHistoryPanel } from "../Agent/SuggestionHistoryPanel";
import { CartDrawer, CartButton } from "../Shop/CartDrawer";
import { CheckoutModal } from "../Shop/CheckoutModal";
import { useCartStore } from "../../lib/stores/cart-store";
import { trackProviderSelected } from "../../lib/utils/analytics";
import { useLiveSession, GOAL_OPTIONS } from "./hooks/useLiveSession";

interface LiveStylistViewProps {
  onBack: () => void;
}

export function LiveStylistView({ onBack }: LiveStylistViewProps) {
  const session = useLiveSession();
  const { isConnected: isWalletConnected } = useAccount();
  const cartItemCount = useCartStore((s) => s.itemCount());
  const openCart = useCartStore((s) => s.openCart);
  const [showTipModal, setShowTipModal] = React.useState(false);
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(true);

  const {
    selectedProvider,
    setSelectedProvider,
    sessionGoal,
    setSessionGoal,
    initStep,
    setInitStep,
    showSummary,
    setShowSummary,
    finalAdvice,
    isConnected,
    isInitializing,
    error,
    videoRef,
    startSession,
    stopSession,
    handleFinish,
    reasoning,
    agentEvents,
    sessionSummary,
    positionStatus,
    captures,
    selectedCaptureIndex,
    setSelectedCaptureIndex,
    isCapturing,
    showFlash,
    countdown,
    handleCapture,
    startTimerCapture,
    hasCaptures,
    selectedCapture,
    activities,
    coachingBadges,
    terminalExpanded,
    setTerminalExpanded,
    isVoiceEnabled,
    setIsVoiceEnabled,
    userApiKey,
    setUserApiKey,
    showByokInput,
    setShowByokInput,
    geminiPaymentToken,
    setGeminiPaymentToken,
    showPaymentSuccess,
    setShowPaymentSuccess,
    uploadedData,
    setUploadedData,
    suggestions,
    currentSuggestion,
    handleAcceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,
    currentApproval,
    isApprovalModalOpen,
    setIsApprovalModalOpen,
    approveRequest,
    rejectRequest,
  } = session;

  // ── Session Summary Screen ──
  if (showSummary && sessionSummary) {
    return (
      <div className="flex flex-col h-full bg-slate-950 overflow-y-auto pb-20">
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-indigo-500/20 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Session Summary
              </h1>
              <p className="text-[10px] text-indigo-300/60 uppercase tracking-widest font-mono">
                Proof of Style Verified
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-white bg-white/5 hover:bg-white/10 rounded-full"
            onClick={onBack}
          >
            Done
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Style Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 shadow-2xl shadow-indigo-500/20"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10 flex flex-col items-center text-center py-4">
              <span className="text-white/60 text-xs font-mono uppercase tracking-[0.2em] mb-4">
                Final Style Score
              </span>
              <div className="relative">
                <div className="text-8xl font-black text-white italic tracking-tighter tabular-nums drop-shadow-2xl">
                  {sessionSummary.score}
                </div>
                <div className="absolute -right-6 bottom-4 text-2xl font-bold text-indigo-300">
                  /10
                </div>
              </div>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {sessionSummary.score >= 8
                    ? "Elite Persona"
                    : sessionSummary.score >= 5
                      ? "Strong Baseline"
                      : "Growth Potential"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Key Takeaways */}
          <div className="space-y-4">
            <h2 className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-1 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              AI Stylist Insights
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {sessionSummary.takeaways.map((takeaway, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-900/80 border border-indigo-500/20 p-4 rounded-2xl flex gap-3 items-start"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">
                    {takeaway}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Analyzed Topics */}
          {sessionSummary.topics.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-1">
                Infrastructure Focus
              </h2>
              <div className="flex flex-wrap gap-2">
                {sessionSummary.topics.map((topic, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                    <span className="text-xs text-indigo-300/80">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {hasCaptures && (
            <div className="space-y-4">
              <h2 className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-1">
                Proof of Style Artifacts
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar">
                {captures.map((cap, i) => (
                  <motion.div
                    key={i}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCaptureIndex(i)}
                    className={`relative w-40 h-56 rounded-2xl overflow-hidden shrink-0 transition-all border-2 ${
                      selectedCaptureIndex === i
                        ? "border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                        : "border-white/5 grayscale-[0.8] opacity-60"
                    }`}
                  >
                    <img
                      src={cap.image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                      <p className="text-[10px] text-white/50 font-mono">
                        0x{Math.random().toString(16).substr(2, 6)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <SuggestionHistoryPanel suggestions={suggestions} />

            {selectedCapture && (
              <MintLookButton
                imageUrl={selectedCapture.image}
                ipfsCid=""
                aiCritique={finalAdvice}
                onUpload={async () => {
                  const res = await fetch("/api/ipfs/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      data: selectedCapture.image,
                      name: "outfit.jpg",
                    }),
                  });
                  return res.json();
                }}
              />
            )}
            <Button
              className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full py-6 text-lg font-bold gap-2"
              onClick={() => {
                if (!selectedCapture || !sessionSummary) return;
                const text = `Check out my OnPoint Style Score: ${sessionSummary.score}/10! 👗✨\n\nAnalyzed: ${sessionSummary.topics.join(", ")}\n\nTakeaway: ${sessionSummary.takeaways[0] || "Found my perfect look!"}\n\nMinted on Celo via @onpoint`;
                const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(window.location.host)}`;
                window.open(shareUrl, "_blank");
              }}
            >
              Share to Warpcast
            </Button>

            <AgentStatus
              compact
              showActions
              onTipClick={() => setShowTipModal(true)}
            />
            <AgentActionCard
              score={sessionSummary?.score}
              onMintClick={selectedCapture ? () => {} : undefined}
            />
          </div>

          <TipModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
          />
          <AgentApprovalModal
            isOpen={isApprovalModalOpen}
            onClose={() => setIsApprovalModalOpen(false)}
            onApprove={approveRequest}
            onReject={rejectRequest}
            request={currentApproval}
          />
        </div>
      </div>
    );
  }

  // ── Provider Selection Screen ──
  if (!selectedProvider) {
    return (
      <div className="flex flex-col h-full bg-slate-950 p-6">
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 max-w-md mx-auto">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tighter italic">
              LIVE STYLIST
            </h1>
            <p className="text-slate-400 text-sm">
              Choose your AI provider to begin the styling session.
            </p>
          </div>

          <div className="w-full space-y-4">
            <button
              onClick={() => {
                trackProviderSelected({ provider: "venice" });
                setSelectedProvider("venice");
              }}
              className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Venice AI
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full uppercase">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    AI-powered style analysis using vision models. Frame-based
                    polling (3s interval).
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                trackProviderSelected({ provider: "gemini" });
                setSelectedProvider("gemini");
              }}
              className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Gemini Live
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded-full">
                      Premium
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Real-time bidirectional streaming. True live video + audio
                    analysis. Requires CELO or BYOK.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="w-full bg-slate-900/50 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-slate-500 text-center">
              Venice AI uses our API key (free). Gemini Live requires payment
              via CELO or your own API key.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="text-slate-500 hover:text-white"
          onClick={onBack}
        >
          Back to Wardrobe
        </Button>
      </div>
    );
  }

  // ── Goal Selection Screen ──
  if (!sessionGoal) {
    return (
      <div className="flex flex-col h-full bg-slate-950 p-6">
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 max-w-sm mx-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedProvider === "venice"
                    ? "bg-emerald-500/20"
                    : "bg-indigo-500/20"
                }`}
              >
                {selectedProvider === "venice" ? (
                  <Zap className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Crown className="w-5 h-5 text-indigo-400" />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter italic">
              SESSION GOAL
            </h1>
            <p className="text-slate-400 text-sm">
              What are you styling for today?
            </p>
          </div>

          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSessionGoal(goal.id)}
                className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 border border-white/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center shrink-0`}
                  >
                    <goal.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors text-sm">
                      {goal.label}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{goal.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Gemini Payment Flow */}
          {selectedProvider === "gemini" && (
            <div className="w-full space-y-3">
              {!geminiPaymentToken && !showByokInput && (
                <>
                  <GeminiLivePaymentButton
                    onSuccess={(token: string) => {
                      setGeminiPaymentToken(token);
                      setShowPaymentSuccess(true);
                      setTimeout(() => setShowPaymentSuccess(false), 3000);
                    }}
                  />
                  <button
                    onClick={() => setShowByokInput(true)}
                    className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Or use your own API key →
                  </button>
                </>
              )}

              {showByokInput && (
                <div className="w-full space-y-2">
                  <input
                    type="password"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder="Enter Gemini API key"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Your key is stored locally and never sent to our servers.
                  </p>
                </div>
              )}

              {showPaymentSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center"
                >
                  <p className="text-emerald-400 text-sm font-bold">
                    Payment verified
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          className="text-slate-500 hover:text-white"
          onClick={() => setSelectedProvider(null)}
        >
          Back to Provider Selection
        </Button>
      </div>
    );
  }

  // ── Main Live Session View ──
  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative font-sans">
      {/* Top Ticker — Neural Stylist Reasoning */}
      <div className="absolute top-0 inset-x-0 z-[30] p-4 pointer-events-none">
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="max-w-md mx-auto pointer-events-auto"
        >
          <div
            className={`backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-all duration-500 ${terminalExpanded ? "shadow-2xl" : "shadow-lg"}`}
          >
            <div
              className="bg-black/60 px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setTerminalExpanded(!terminalExpanded)}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">
                    Neural Stylist Reasoning
                  </span>
                </div>
              </div>
              <motion.div animate={{ rotate: terminalExpanded ? 180 : 0 }}>
                <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    className="text-white/40"
                  >
                    <path
                      d="M1 1L5 5L9 1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {(terminalExpanded || reasoning.length > 0) && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: terminalExpanded ? "auto" : 48 }}
                  exit={{ height: 0 }}
                  className="px-4 pb-3 overflow-hidden"
                >
                  <div className="font-mono text-[11px] space-y-1 py-1">
                    {terminalExpanded ? (
                      reasoning.map((r, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-2"
                        >
                          <span className="text-white/20">
                            [{reasoning.length - i}]
                          </span>
                          <span
                            className={`${i === 0 ? "text-indigo-400" : "text-white/50"}`}
                          >
                            &gt; {r}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex gap-2 items-center">
                        <span className="text-indigo-400">&gt;</span>
                        <span className="text-slate-300 animate-in fade-in slide-in-from-left-2 truncate">
                          {reasoning[0] || "Awaiting visual telemetry…"}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        {/* Init Loader */}
        {isInitializing && (
          <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-t-2 border-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-b-2 border-indigo-400 animate-spin-slow" />
              </div>
            </div>
            <div className="mt-8 w-64 space-y-4">
              {["connecting", "authenticating", "starting"].map((step, i) => {
                const labels = [
                  "Connecting to camera...",
                  `Authenticating with ${selectedProvider === "venice" ? "Venice AI" : "Gemini"}...`,
                  "Starting AI session...",
                ];
                const isCurrent =
                  initStep === step ||
                  (step === "connecting" &&
                    initStep !== "authenticating" &&
                    initStep !== "starting" &&
                    initStep !== "ready" &&
                    initStep !== "error");
                const isDone =
                  (step === "connecting" &&
                    (initStep === "authenticating" ||
                      initStep === "starting" ||
                      initStep === "ready")) ||
                  (step === "authenticating" &&
                    (initStep === "starting" || initStep === "ready")) ||
                  (step === "starting" && initStep === "ready");
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isCurrent
                          ? "bg-indigo-500 animate-pulse"
                          : isDone
                            ? "bg-emerald-500"
                            : "bg-slate-600"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : isCurrent ? (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      ) : null}
                    </div>
                    <span
                      className={`text-xs ${isCurrent ? "text-indigo-400" : isDone ? "text-emerald-400" : "text-slate-500"}`}
                    >
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-8 text-indigo-400 font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">
              {selectedProvider === "venice"
                ? "Initializing Style Scanner (Free)"
                : "Initializing Live Agent (Premium)"}
            </p>
            {selectedProvider === "gemini" && (
              <p className="mt-2 text-amber-400/60 text-[10px]">
                Real-time streaming enabled
              </p>
            )}
          </div>
        )}

        {/* Error Screen */}
        {error ? (
          <div className="absolute inset-0 z-[70] flex items-center justify-center p-6 bg-rose-950/20 backdrop-blur-3xl">
            <div className="bg-slate-900/90 border border-rose-500/30 p-8 rounded-3xl max-w-sm w-full shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                {error.toLowerCase().includes("rate limit")
                  ? "Session Limit Reached"
                  : error.toLowerCase().includes("camera") ||
                      error.toLowerCase().includes("permission")
                    ? "Camera Access Required"
                    : error.toLowerCase().includes("payment") ||
                        error.toLowerCase().includes("verification")
                      ? "Payment Issue"
                      : "Connection Issue"}
              </h2>
              <div className="text-center mb-8 space-y-3">
                <p className="text-slate-400 text-sm">{error}</p>
                {selectedProvider === "venice" &&
                  error.toLowerCase().includes("rate limit") && (
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <p className="text-indigo-300 text-xs">
                        Upgrade to <strong>Gemini Live</strong> for unlimited
                        sessions (0.5 CELO)
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs"
                        onClick={() => {
                          setSelectedProvider("gemini");
                          setSessionGoal(null);
                        }}
                      >
                        Switch to Gemini Live →
                      </Button>
                    </div>
                  )}
                {error.toLowerCase().includes("camera") && (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-amber-300 text-xs">
                      Please allow camera access in your browser settings.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold"
                  onClick={() =>
                    startSession(
                      sessionGoal,
                      userApiKey || geminiPaymentToken || undefined,
                    )
                  }
                >
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  className="text-slate-400 hover:text-white hover:bg-white/5 font-bold"
                  onClick={() => {
                    setSelectedProvider(null);
                    setSessionGoal(null);
                  }}
                >
                  Choose Different Provider
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-all duration-1000 rounded-3xl ${
              positionStatus === "good"
                ? "ring-8 ring-green-500/40 opacity-100"
                : positionStatus === "bad"
                  ? "ring-8 ring-orange-500/40 opacity-90 grayscale-[0.2]"
                  : "opacity-40 grayscale"
            }`}
          />
        )}

        {/* Neural HUD Overlay */}
        {isConnected && (
          <div className="absolute inset-4 border-2 border-white/5 rounded-[2rem] pointer-events-none overflow-hidden">
            <div
              className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/20 ${positionStatus === "good" ? "opacity-20" : "opacity-0"}`}
            />
            <motion.div
              animate={{ y: [0, 600, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="w-full h-[1px] bg-indigo-500/20 blur-[1px]"
            />
          </div>
        )}

        {/* Agent Activity Trace — Desktop Only (z-30) */}
        <div className="absolute left-4 top-24 bottom-24 w-64 pointer-events-none hidden lg:flex flex-col gap-2 overflow-hidden z-[30]">
          <AnimatePresence>
            {agentEvents.map((event, idx) => (
              <motion.div
                key={`${event.step}-${event.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1 - idx * 0.2, x: 0 }}
                className="bg-black/60 border border-indigo-500/30 backdrop-blur-md p-3 rounded-lg flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                    {event.step}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-white/80 leading-tight">
                  {event.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Activities Panel — Desktop Only (z-30) */}
        <div className="absolute right-4 top-24 bottom-24 w-64 pointer-events-none hidden lg:flex flex-col gap-2 overflow-hidden z-[30]">
          <AnimatePresence>
            {activities.map((activity, idx) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 0.8 - idx * 0.1, x: 0 }}
                className={`p-3 rounded-xl border text-[10px] uppercase tracking-wider font-mono backdrop-blur-md flex flex-col gap-1 ${
                  activity.type === "decision"
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-black/40 border-white/10 text-white/60"
                }`}
              >
                <div className="flex justify-between opacity-50">
                  <span>{activity.type}</span>
                  <span>
                    {new Date(activity.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="leading-relaxed text-left">{activity.text}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Coaching Badges (z-40) — includes instruction toast merged in */}
        <AnimatePresence>
          {coachingBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-6 top-32 flex flex-col gap-2 z-[40]"
            >
              {coachingBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${badge.color} border border-white/20 shadow-lg`}
                >
                  <badge.icon className="w-3.5 h-3.5 text-white" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {badge.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction Toast — merged into coaching system, shows first 15s */}
        <AnimatePresence>
          {showInstructions && isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 inset-x-0 flex justify-center z-[40] px-6"
            >
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 max-w-sm w-full shadow-2xl">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                    Style Capture Active
                  </h4>
                  <p className="text-slate-400 text-[10px] leading-snug">
                    The AI is analyzing your silhouettes. Use the Timer to step
                    back and capture full poses.
                  </p>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-dismiss instruction toast after 15s */}
        {showInstructions && isConnected && (
          <AutoDismissTimer
            ms={15_000}
            onDismiss={() => setShowInstructions(false)}
          />
        )}

        {/* Agent Suggestion Toast (z-50) */}
        <AnimatePresence>
          {currentSuggestion && (
            <AgentSuggestionToast
              suggestion={currentSuggestion}
              onAccept={handleAcceptSuggestion}
              onReject={rejectSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}
        </AnimatePresence>

        {/* Captures Mini-Gallery (z-40) */}
        {hasCaptures && (
          <div className="absolute left-6 bottom-32 z-[40] flex flex-col gap-3">
            <div className="flex -space-x-3">
              {captures.slice(-3).map((cap, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, x: -20 }}
                  animate={{ scale: 1, x: 0 }}
                  className="w-12 h-16 rounded-lg border-2 border-white/10 overflow-hidden shadow-xl"
                >
                  <img
                    src={cap.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ))}
              {captures.length > 3 && (
                <div className="w-12 h-16 rounded-lg bg-indigo-600/80 border-2 border-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white text-xs">
                  +{captures.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Status — Desktop Only (z-50) */}
        {isConnected && (
          <div className="absolute right-6 bottom-32 z-[50] hidden sm:flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-xl rounded-full border border-white/10 shadow-lg"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] text-slate-300 font-medium">
                AI Stylist Active
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => setShowTipModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-full border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30 transition-all group shadow-lg"
            >
              <Coins className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] text-amber-300 font-bold">
                Tip Stylist
              </span>
            </motion.button>
          </div>
        )}

        {/* Modals (z-60) */}
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
        />
        <AgentApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          onApprove={approveRequest}
          onReject={rejectRequest}
          request={currentApproval}
        />
        <CartDrawer onCheckout={() => setShowCheckout(true)} />
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
        />

        {/* Flash Overlay (z-70) */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-white"
            />
          )}
        </AnimatePresence>

        {/* Countdown Overlay (z-70) */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none"
            >
              <div className="text-[12rem] font-black text-white italic drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                {countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar — Mobile-safe */}
      <div
        className="bg-slate-950 px-4 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-10 flex items-center justify-around gap-2 sm:gap-4 border-t border-white/5 relative z-[50] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => stopSession()}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 group"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500 group-hover:scale-110 transition-transform" />
        </Button>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            size="icon"
            onClick={startTimerCapture}
            className={`w-14 h-14 sm:w-18 sm:h-18 rounded-full transition-all duration-300 shadow-xl ${
              countdown !== null
                ? "bg-amber-600 scale-95 shadow-amber-500/20"
                : "bg-white hover:bg-slate-200 shadow-white/10"
            }`}
          >
            <Clock
              className={`w-6 h-6 sm:w-8 sm:h-8 ${countdown !== null ? "text-white" : "text-slate-950"}`}
            />
          </Button>

          <Button
            size="icon"
            onClick={handleCapture}
            className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20"
            disabled={isCapturing}
          >
            {isCapturing ? (
              <Sparkles className="animate-spin w-6 h-6 sm:w-8 sm:h-8" />
            ) : (
              <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
            )}
          </Button>
        </div>

        <div className="flex gap-1 sm:gap-2 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border transition-all ${
              isVoiceEnabled
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-white/5 border-white/10 text-white/40"
            }`}
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </Button>

          {/* Cart indicator */}
          <button
            onClick={openCart}
            className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-lg italic shadow-emerald-500/10"
            onClick={handleFinish}
          >
            <div className="relative">
              <span className="relative z-10 italic">#1</span>
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-emerald-400 opacity-50" />
            </div>
          </Button>
        </div>
      </div>

      {/* Ready for Scan prompt */}
      {!isConnected && !isInitializing && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="max-w-xs w-full p-8 rounded-3xl bg-slate-900 border border-white/10 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
              <Mic className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-black text-white italic tracking-tight mb-2 uppercase">
              READY FOR SCAN?
            </h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              The AI Stylist is ready to connect. Ensure your camera and
              microphone are accessible.
            </p>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full py-6 text-lg font-bold shadow-xl shadow-indigo-500/20"
              onClick={async () => {
                setInitStep("connecting");
                await new Promise((r) => setTimeout(r, 300));
                setInitStep("authenticating");
                await new Promise((r) => setTimeout(r, 500));
                setInitStep("starting");
                await startSession(
                  sessionGoal!,
                  userApiKey || geminiPaymentToken || undefined,
                );
              }}
            >
              ACTIVATE AGENT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: auto-dismiss timer ──

function AutoDismissTimer({
  ms,
  onDismiss,
}: {
  ms: number;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [ms, onDismiss]);
  return null;
}
