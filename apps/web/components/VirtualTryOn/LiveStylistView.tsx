"use client";

import React from "react";
import dynamic from "next/dynamic";
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
  CheckCircle,
  ShoppingBag,
  ShieldCheck,
  Ruler,
  Palette,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { GeminiLivePaymentButton } from "./GeminiLivePaymentButton";
import { TipSheet } from "../Agent/TipModal";
import { AgentApprovalModal } from "../Agent/AgentApprovalModal";
import { AgentSuggestionToast } from "../Agent/AgentSuggestionToast";
import { CartDrawer } from "../Shop/CartDrawer";
import { CheckoutModal } from "../Shop/CheckoutModal";
import { SessionEndingCard } from "./SessionEndingCard";
import { useCartStore } from "../../lib/stores/cart-store";
import { trackProviderSelected } from "../../lib/utils/analytics";
import { useLiveSession, type SessionGoal } from "./hooks/useLiveSession";
import { findPremiumProvider } from "@repo/ai-client";
import { ProviderComparisonModal } from "./ProviderComparisonModal";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { recordLatency } from "../../lib/utils/latency-persistence";


const SessionSummaryScreen = dynamic(
  () => import("./SessionSummaryScreen").then((m) => ({ default: m.SessionSummaryScreen })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            Preparing summary…
          </p>
        </div>
      </div>
    ),
  },
);

interface LiveStylistViewProps {
  onBack: () => void;
}

type QueuedLiveStart = {
  provider: string;
  goal: string;
  persona: string;
  apiKey?: string;
};

const DEFAULT_LIVE_PERSONA = "shaft";

export function LiveStylistView({ onBack }: LiveStylistViewProps) {
  const session = useLiveSession();
  const {
    selectedProvider,
    setSelectedProvider,
    selectedPersona,
    setSelectedPersona,
    sessionGoal,
    setSessionGoal,
    initStep,
    setInitStep,
    showSummary,
    setShowSummary,
    finalAdvice,
    sessionEndedManually,
    isConnected,
    isInitializing,
    isAnalyzing,
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
    captureToast,
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
    capturesRemaining,
    capturesExhausted,
    maxCaptures,
    sessionTimeRemaining,
    sessionExpired,
    isVenice,
    providerDisplayName,
    isPremium,
    requiresPayment,
    supportsByok,
    latencyMs,
    provider,
  } = session;

  const queueLiveStart = React.useCallback(
    (config: QueuedLiveStart) => {
      setSelectedProvider(config.provider);
      setSessionGoal(config.goal as SessionGoal);
      setSelectedPersona(config.persona);
      setQueuedStart(config);
    },
    [setSelectedPersona, setSelectedProvider, setSessionGoal],
  );

  const { isConnected: isWalletConnected } = useAccount();
  const cartItemCount = useCartStore((s) => s.itemCount());
  const openCart = useCartStore((s) => s.openCart);
  const [showTipModal, setShowTipModal] = React.useState(false);
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(true);
  const [showStyleReport, setShowStyleReport] = React.useState(false);
  const [showComparison, setShowComparison] = React.useState(false);
  const [queuedStart, setQueuedStart] = React.useState<QueuedLiveStart | null>(null);

  // Persist latency samples to localStorage for historical averages
  React.useEffect(() => {
    if (latencyMs > 0 && provider) {
      recordLatency(provider, latencyMs);
    }
  }, [latencyMs, provider]);

  // Stop camera when leaving the view
  const handleBack = React.useCallback(() => {
    session.stopSession();
    onBack();
  }, [session.stopSession, onBack]);

  // Cleanup on unmount — ensure camera stops if component is removed
  React.useEffect(() => {
    return () => {
      session.stopSession();
    };
  }, []);

  // Mobile detection — hide non-essential HUD elements on small screens
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  const personaStyling = getPersonaConfig(selectedPersona);

  const PersonaIcon = personaStyling.icon;
  const liveModeLabel =
    sessionGoal === "event"
      ? "Event prep"
      : sessionGoal === "critique"
        ? "Critique"
        : "Outfit check";
  const scanSignals = [
    {
      label: "Framing",
      value:
        positionStatus === "good"
          ? "locked"
          : positionStatus === "bad"
            ? "adjust"
            : "scanning",
      tone:
        positionStatus === "good"
          ? "text-emerald-300"
          : positionStatus === "bad"
            ? "text-amber-300"
            : "text-slate-300",
    },
    {
      label: "Fit",
      value: reasoning.length > 1 ? "reading" : "pending",
      tone: "text-sky-300",
    },
    {
      label: "Palette",
      value: isAnalyzing ? "sampling" : reasoning.length ? "ready" : "pending",
      tone: "text-violet-300",
    },
    {
      label: "Shop",
      value: suggestions.length > 0 ? "matches" : "context",
      tone: "text-amber-300",
    },
  ];


  const runStartSequence = React.useCallback(
    async (config: QueuedLiveStart) => {
      setInitStep("connecting");
      await startSession(config.goal as SessionGoal, config.apiKey, config.persona);
    },
    [setInitStep, startSession],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const consumeAutoStart = () => {
      if (queuedStart || isConnected || isInitializing) return;
      if (window.localStorage.getItem("onpoint-live-auto-start") !== "true") {
        return;
      }
      window.localStorage.removeItem("onpoint-live-auto-start");
      queueLiveStart({
        provider: "venice",
        goal: "daily",
        persona: DEFAULT_LIVE_PERSONA,
      });
    };

    consumeAutoStart();
    window.addEventListener("onpoint-live-auto-start", consumeAutoStart);
    return () => {
      window.removeEventListener("onpoint-live-auto-start", consumeAutoStart);
    };
  }, [isConnected, isInitializing, queueLiveStart, queuedStart]);

  React.useEffect(() => {
    if (!queuedStart || isConnected || isInitializing) return;
    if (
      selectedProvider !== queuedStart.provider ||
      sessionGoal !== queuedStart.goal ||
      selectedPersona !== queuedStart.persona
    ) {
      return;
    }

    let cancelled = false;
    window.requestAnimationFrame(() => {
      if (cancelled) return;
      runStartSequence(queuedStart).finally(() => {
        if (!cancelled) setQueuedStart(null);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    isConnected,
    isInitializing,
    queuedStart,
    runStartSequence,
    selectedPersona,
    selectedProvider,
    sessionGoal,
  ]);

    // ── Session Summary Screen (lazy-loaded) ──
  if (showSummary && sessionSummary) {
    return (
      <SessionSummaryScreen
        sessionSummary={sessionSummary}
        personaStyling={personaStyling}
        selectedPersona={selectedPersona}
        onBack={handleBack}
        hasCaptures={hasCaptures}
        captures={captures}
        selectedCaptureIndex={selectedCaptureIndex}
        onSelectCapture={(i) => i !== null && setSelectedCaptureIndex(i)}
        selectedCapture={selectedCapture ?? null}
        suggestions={suggestions}
        finalAdvice={finalAdvice}
        sessionGoal={sessionGoal}
        isApprovalModalOpen={isApprovalModalOpen}
        currentApproval={currentApproval}
        onApprove={() => approveRequest("")}
        onReject={() => rejectRequest("")}
        showStyleReport={showStyleReport}
        onSetShowStyleReport={setShowStyleReport}
        showTipModal={showTipModal}
        onSetShowTipModal={setShowTipModal}
      />
    );
  }

  // ── Start Screen ──
  if (!selectedProvider) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Top bar: back + status */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 shrink-0">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              {isPremium ? 'Premium' : 'Free · No signup'}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-5 sm:gap-6 max-w-2xl mx-auto w-full px-5 sm:px-6 py-6 sm:py-8">

            {/* HERO PREVIEW CARD — shows what the live session will look like */}
            <div className="w-full">
              <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 shadow-2xl shadow-emerald-500/10">
                {/* Radial glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,_rgba(16,185,129,0.18),_transparent_60%)]" />

                {/* Stylized person silhouette (head + shoulders) */}
                <div className="absolute inset-0 flex items-end justify-center">
                  <div className="relative w-[44%] h-[78%]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[34%] aspect-square rounded-full bg-gradient-to-b from-slate-300/70 to-slate-500/70" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[58%] rounded-t-[45%] bg-gradient-to-b from-slate-400/60 to-slate-600/60" />
                  </div>
                </div>

                {/* Framing corners */}
                <div className="absolute inset-6 sm:inset-10">
                  <div className="relative w-full h-full">
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-emerald-300/80 rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-emerald-300/80 rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-emerald-300/80 rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-emerald-300/80 rounded-br-2xl" />
                  </div>
                </div>

                {/* Top status pill */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                    Good Position
                  </span>
                </div>

                {/* Bottom scan signal chips — preview of live HUD */}
                <div className="absolute bottom-4 inset-x-3 sm:inset-x-6 flex gap-1.5 sm:gap-2">
                  {[
                    { label: 'Framing', value: 'locked', color: 'text-emerald-300' },
                    { label: 'Fit', value: 'reading', color: 'text-sky-300' },
                    { label: 'Palette', value: 'sampling', color: 'text-violet-300' },
                    { label: 'Shop', value: 'matches', color: 'text-amber-300' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-1.5 sm:px-2 py-1.5 min-w-0"
                    >
                      <p className="text-[8px] uppercase tracking-wider text-white/50 font-bold truncate">
                        {s.label}
                      </p>
                      <p className={`text-[10px] sm:text-[11px] font-bold truncate ${s.color}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Scan line — only for real-time (premium) providers */}
                {isPremium && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div
                      aria-hidden
                      className="absolute inset-x-0 h-full"
                      initial={{ y: '-100%' }}
                      animate={{ y: ['-100%', '100%', '-100%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                    </motion.div>
                  </div>
                )}
              </div>
            </div>

            {/* Title + value copy */}
            <div className="text-center space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  {isPremium ? 'Live · Premium' : 'On-device preview · No signup'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tighter italic">
                {isPremium ? 'Live Style Camera' : 'Snap & Analyze'}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                {isPremium
                  ? 'Real-time AI feedback as you move. Get fit, palette, and voice-led styling.'
                  : 'Tap to capture. Get fit, palette, and shopping matches in seconds.'
                }
              </p>
            </div>

            {/* Value bullets — what the user gets */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-md">
              {[
                { icon: Ruler, label: 'Fit', desc: 'Proportion read' },
                { icon: Palette, label: 'Palette', desc: 'Color harmony' },
                { icon: Zap, label: 'Matches', desc: 'Shop the gaps' },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl border border-border bg-card/50"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-1.5">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Error display */}
            {error && (
              <div className="w-full max-w-md rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-wider">Session Error</p>
                </div>
                <p className="mt-2 text-sm text-rose-300">{error}</p>
                {error.toLowerCase().includes("camera") && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-rose-300/70">
                      Make sure you allow camera access and are on HTTPS.
                    </p>
                    <button
                      onClick={() => { stopSession(); setSelectedProvider(null); }}
                      className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2"
                    >
                      Use Upload Photo instead →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Start button — explicit permission gate */}
            <div className="w-full max-w-md space-y-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-full py-6 text-base sm:text-lg font-bold shadow-xl shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50"
                disabled={isInitializing}
                onClick={() => {
                  trackProviderSelected({ provider: "venice" });
                  queueLiveStart({
                    provider: "venice",
                    goal: "daily",
                    persona: DEFAULT_LIVE_PERSONA,
                  });
                }}
              >
                {isInitializing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    START STYLE CAMERA
                  </span>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground/70 leading-relaxed">
                We only open the camera after you tap. Frames stay on your device unless you save them.
              </p>
            </div>

            <button
              onClick={() => setShowComparison(true)}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Compare AI providers →
            </button>

            <ProviderComparisonModal
              isOpen={showComparison}
              onClose={() => setShowComparison(false)}
              onSelect={(p, g) => {
                trackProviderSelected({ provider: p as "venice" | "gemini" });
                queueLiveStart({ provider: p as "venice" | "gemini", goal: g, persona: DEFAULT_LIVE_PERSONA });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main Live Session View ──
  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative font-sans">
      {/* Top Ticker — Neural Stylist Reasoning */}
      <div
        className={`absolute top-0 inset-x-0 z-[30] ${isMobile ? "p-2" : "p-4"} pointer-events-none`}
      >
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className={`${isMobile ? "max-w-[95vw]" : "max-w-md"} mx-auto pointer-events-auto`}
        >
          <div
            className={`backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-500 ${terminalExpanded ? "shadow-2xl" : "shadow-lg"}`}
          >
            <div
              role="button"
              tabIndex={0}
              aria-expanded={terminalExpanded}
              aria-label="Toggle analysis feed"
              className="bg-black/60 px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setTerminalExpanded(!terminalExpanded)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTerminalExpanded(!terminalExpanded);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full bg-${personaStyling.color} animate-pulse`}
                  />
                  <span
                    className={`text-[10px] font-mono text-${personaStyling.text} uppercase tracking-widest`}
                  >
                    {personaStyling.label}
                  </span>
                </div>
                {/* Latency indicator */}
                {isConnected && latencyMs > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      latencyMs < 2000
                        ? "text-emerald-400"
                        : latencyMs < 5000
                          ? "text-amber-400"
                          : "text-rose-400"
                    }`}
                  >
                    {latencyMs}ms
                  </span>
                )}
                {/* Session timer (providers with time limits) */}
                {isConnected && sessionTimeRemaining != null && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      sessionTimeRemaining <= 30
                        ? "text-rose-400 animate-pulse"
                        : sessionTimeRemaining <= 60
                          ? "text-amber-400"
                          : "text-slate-500"
                    }`}
                  >
                    {Math.floor(sessionTimeRemaining / 60)}:
                    {String(sessionTimeRemaining % 60).padStart(2, "0")}
                  </span>
                )}
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
                            className={`${i === 0 ? `text-${personaStyling.text}` : "text-white/50"}`}
                          >
                            &gt; {r}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col gap-1.5 w-full">
                        {isAnalyzing ? (
                          <>
                            <div className="flex gap-2 items-center">
                              <span className={`text-${personaStyling.text}`}>&gt;</span>
                              <span className="h-3 rounded bg-slate-700/80 animate-pulse w-3/4" />
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-transparent">&gt;</span>
                              <span className="h-3 rounded bg-slate-700/50 animate-pulse w-1/2" style={{ animationDelay: "150ms" }} />
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-transparent">&gt;</span>
                              <span className="h-3 rounded bg-slate-700/30 animate-pulse w-2/3" style={{ animationDelay: "300ms" }} />
                            </div>
                          </>
                        ) : reasoning[0] ? (
                          <div className="flex gap-2 items-center">
                            <span className={`text-${personaStyling.text}`}>&gt;</span>
                            <span className="text-slate-300 animate-in fade-in slide-in-from-left-2 truncate">
                              {reasoning[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <span className={`text-${personaStyling.text}`}>&gt;</span>
                            <span className="text-slate-500 flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                              Awaiting visual telemetry…
                            </span>
                          </div>
                        )}
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
              <div
                className={`w-20 h-20 rounded-full border-t-2 border-${personaStyling.color} animate-spin`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-12 h-12 rounded-full border-b-2 border-${personaStyling.accent} animate-spin-slow`}
                />
              </div>
            </div>
            <div className="mt-8 w-64 space-y-4">
              {["connecting", "authenticating", "starting"].map((step, i) => {
                const labels = [
                  "Connecting to camera...",
                  `Authenticating with ${providerDisplayName}...`,
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
                          ? `bg-${personaStyling.color} animate-pulse`
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
                      className={`text-xs ${isCurrent ? `text-${personaStyling.text}` : isDone ? "text-emerald-400" : "text-slate-500"}`}
                    >
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p
              className={`mt-8 text-${personaStyling.text} font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse`}
            >
              {isPremium
                ? "Initializing Live Agent (Premium)"
                : "Initializing Style Scanner (Free)"}
            </p>
            {isPremium && (
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
                {!isPremium &&
                  error.toLowerCase().includes("rate limit") &&
                  (() => {
                    const premium = findPremiumProvider();
                    if (!premium) return null;
                    return (
                      <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <p className="text-indigo-300 text-xs">
                          Upgrade to <strong>Premium</strong> for unlimited
                          sessions
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs"
                          onClick={() => {
                            stopSession();
                            setSelectedProvider(null);
                            setSessionGoal(null);
                          }}
                        >
                          Go Back
                        </Button>
                      </div>
                    );
                  })()}
                {error.toLowerCase().includes("camera") && (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-amber-300 text-xs">
                      Please allow camera access in your browser settings.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {/* Payment/BYOK options for payment-required errors */}
                {supportsByok &&
                  (error.toLowerCase().includes("payment") ||
                    error.toLowerCase().includes("api key") ||
                    error.toLowerCase().includes("requires payment")) && (
                    <div className="space-y-3">
                      {!geminiPaymentToken && !showByokInput && (
                        <>
                          <GeminiLivePaymentButton
                            onSuccess={(token: string) => {
                              setGeminiPaymentToken(token);
                              setShowPaymentSuccess(true);
                              startSession(sessionGoal, token);
                            }}
                          />
                          <button
                            onClick={() => setShowByokInput(true)}
                            className="w-full text-xs text-slate-400 hover:text-white transition-colors py-1"
                          >
                            Or use your own API key
                          </button>
                        </>
                      )}
                      {showByokInput && (
                        <div className="space-y-2">
                          <input
                            type="password"
                            value={userApiKey}
                            onChange={(e) => setUserApiKey(e.target.value)}
                            placeholder="Enter your Gemini API key"
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                          />
                          <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold"
                            disabled={!userApiKey.trim()}
                            onClick={() => {
                              startSession(sessionGoal, userApiKey);
                            }}
                          >
                            Start with API Key
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                {/* Standard retry for non-payment errors */}
                {!(
                  supportsByok &&
                  (error.toLowerCase().includes("payment") ||
                    error.toLowerCase().includes("api key") ||
                    error.toLowerCase().includes("requires payment"))
                ) && (
                  <Button
                    variant="ghost"
                    className="text-slate-400 hover:text-white hover:bg-white/5 font-bold"
                    onClick={() => {
                      stopSession();
                      setSelectedProvider(null);
                      setSessionGoal(null);
                    }}
                  >
                    Go Back
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={
                positionStatus === "good"
                  ? "Good position detected"
                  : positionStatus === "bad"
                    ? "Adjust your position — step back or center yourself"
                    : "Analyzing your position"
              }
              className={`w-full h-full object-cover transition-all duration-1000 ${
                isMobile ? "rounded-2xl" : "rounded-3xl"
              } ${
                positionStatus === "good"
                  ? `${isMobile ? "ring-4" : "ring-8"} ring-green-500/40 opacity-100`
                  : positionStatus === "bad"
                    ? `${isMobile ? "ring-4" : "ring-8"} ring-orange-500/40 opacity-90 grayscale-[0.2]`
                    : "opacity-40 grayscale"
              }`}
            />
            {/* Position status text indicator (for colorblind users / accessibility) */}
            {isConnected && positionStatus !== "analyzing" && (
              <div
                className={`absolute ${isMobile ? "top-14" : "top-20"} inset-x-0 flex justify-center pointer-events-none z-[25]`}
              >
                <div
                  className={`px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-bold uppercase tracking-wider ${
                    positionStatus === "good"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  }`}
                >
                  {positionStatus === "good"
                    ? "Good Position"
                    : "Adjust Position"}
                </div>
              </div>
            )}

            {isConnected && (
              <>
                <div className="absolute inset-0 z-[22] pointer-events-none flex items-center justify-center px-8">
                  <div
                    className={`relative w-full max-w-[340px] sm:max-w-[420px] aspect-[3/4] rounded-[2rem] border ${
                      positionStatus === "good"
                        ? "border-emerald-300/45"
                        : positionStatus === "bad"
                          ? "border-amber-300/50"
                          : "border-white/20"
                    }`}
                  >
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-2 border-l-2 border-white/50 rounded-tl-[2rem]" />
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-2 border-r-2 border-white/50 rounded-tr-[2rem]" />
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-2 border-l-2 border-white/50 rounded-bl-[2rem]" />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-2 border-r-2 border-white/50 rounded-br-[2rem]" />
                  </div>
                </div>

                <div className="absolute left-3 right-3 sm:left-6 sm:right-auto sm:w-[360px] bottom-5 z-[45] pointer-events-none">
                  <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-2xl p-3 sm:p-4 shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/45 font-bold">
                          Live style state
                        </p>
                        <p className="text-sm font-bold text-white">
                          {liveModeLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                          seeing
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {scanSignals.map((signal) => (
                        <div
                          key={signal.label}
                          className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-2 min-w-0"
                        >
                          <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold truncate">
                            {signal.label}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-bold truncate ${signal.tone}`}>
                            {signal.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <span className="w-4 h-4 rounded-full bg-slate-100 border border-white/30" />
                        <span className="w-4 h-4 rounded-full bg-stone-500 border border-white/30" />
                        <span className="w-4 h-4 rounded-full bg-indigo-500 border border-white/30" />
                        <span className="w-4 h-4 rounded-full bg-emerald-500 border border-white/30" />
                      </div>
                      <p className="text-[10px] text-white/55 truncate">
                        Palette and catalog context update as frames arrive.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Neural HUD Overlay — Simplified on Mobile */}
        {isConnected && (
          <div
            className={`absolute ${isMobile ? "inset-2" : "inset-4"} border-2 ${isAnalyzing ? "border-indigo-500/20" : "border-white/5"} rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none overflow-hidden transition-colors duration-500`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/20 ${positionStatus === "good" ? "opacity-20" : "opacity-0"}`}
            />
            {!isMobile && (
              <motion.div
                animate={{ y: [0, 600, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className={`w-full h-[1px] bg-${personaStyling.color}/20 blur-[1px]`}
              />
            )}
          </div>
        )}

        {/* Agent Activity Trace — Desktop Only (z-30) */}
        <div className="absolute left-4 top-24 bottom-24 w-64 pointer-events-none hidden xl:flex flex-col gap-2 overflow-hidden z-[30]">
          <AnimatePresence>
            {agentEvents.map((raw, idx) => {
              const event = raw as { step: string; id: string; text: string };
              return (
              <motion.div
                key={`${event.step}-${event.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1 - idx * 0.2, x: 0 }}
                className={`bg-black/60 border border-${personaStyling.color}/30 backdrop-blur-md p-3 rounded-lg flex flex-col gap-1`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full bg-${personaStyling.accent} animate-pulse`}
                  />
                  <span
                    className={`text-[10px] font-bold text-${personaStyling.accent} uppercase tracking-tighter`}
                  >
                    {event.step}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-white/80 leading-tight">
                  {event.text}
                </div>
              </motion.div>
            );
            })}
          </AnimatePresence>
        </div>

        {/* Activities Panel — Desktop Only (z-30) */}
        <div className="absolute right-4 top-24 bottom-24 w-64 pointer-events-none hidden xl:flex flex-col gap-2 overflow-hidden z-[30]">
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

        {/* Coaching Badges (z-40) — Show only first badge on mobile */}
        <AnimatePresence>
          {coachingBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-4 sm:right-6 top-24 sm:top-32 flex flex-col gap-2 z-[40]"
            >
              {(isMobile ? coachingBadges.slice(0, 1) : coachingBadges).map(
                (badge) => (
                  <div
                    key={badge.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${badge.color} border border-white/20 shadow-lg`}
                  >
                    <badge.icon className="w-3.5 h-3.5 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {badge.label}
                    </span>
                  </div>
                ),
              )}
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
              className={`absolute ${isMobile ? "bottom-36" : "bottom-32"} inset-x-0 flex justify-center z-[40] px-4 sm:px-6`}
            >
              <div className="bg-card/80 backdrop-blur-2xl border border-border p-4 rounded-3xl flex items-center gap-4 max-w-sm w-full shadow-2xl">
                <div
                  className={`w-10 h-10 rounded-2xl bg-${personaStyling.color}/20 flex items-center justify-center shrink-0 border border-${personaStyling.color}/30`}
                >
                  <Camera className={`w-5 h-5 text-${personaStyling.accent}`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-foreground font-bold text-xs uppercase tracking-wider">
                    Live Style Context
                  </h4>
                  <p className="text-muted-foreground text-[10px] leading-snug">
                    Step back until framing locks. The camera builds fit, palette,
                    and shopping context as frames arrive.
                  </p>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  aria-label="Dismiss instructions"
                  className="w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
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

        {/* Captures Mini-Gallery — Desktop Only (z-40) */}
        {hasCaptures && !isMobile && (
          <div className="absolute left-6 bottom-28 sm:bottom-32 z-[40] flex flex-col gap-3">
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
                    alt={`Recent capture ${i + 1}`}
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
        {isConnected && !isMobile && (
          <div className="absolute right-6 bottom-28 sm:bottom-32 z-[50] hidden sm:flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-xl rounded-full border border-white/10 shadow-lg"
            >
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-br from-${personaStyling.color} to-${personaStyling.accent} flex items-center justify-center`}
              >
                <PersonaIcon className="w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] text-slate-300 font-medium">
                Style Camera Active
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {isPremium ? "Premium" : "Quick"}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </motion.div>
          </div>
        )}

        {/* Mobile: Compact Status Indicator */}
        {isConnected && isMobile && (
          <div className="absolute right-4 top-24 z-[50]">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/80 backdrop-blur-xl rounded-full border border-white/10"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-slate-400 font-medium">
                {isPremium ? "PREMIUM" : "QUICK"}
              </span>
            </motion.div>
          </div>
        )}

        {/* Modals (z-60) */}
        <TipSheet
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          score={sessionSummary?.score}
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
              <div className="text-[8rem] sm:text-[10rem] md:text-[12rem] font-black text-white italic drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                {countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Capture Confirmation Toast (z-70) */}
        <AnimatePresence>
          {captureToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`absolute ${isMobile ? "bottom-36" : "bottom-32"} inset-x-0 flex justify-center z-[70] pointer-events-none`}
            >
              <div
                className={`bg-${personaStyling.color}/20 backdrop-blur-xl border border-${personaStyling.color}/30 px-4 py-2 rounded-full flex items-center gap-2`}
              >
                <CheckCircle
                  className={`w-4 h-4 text-${personaStyling.accent}`}
                />
                <span className="text-xs text-white font-medium">
                  {captureToast}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session Ending Card — shows on manual stop, session expired, or captures exhausted */}
      <AnimatePresence>
        {(sessionExpired || capturesExhausted || sessionEndedManually) &&
          !showSummary &&
          sessionSummary && (
            <SessionEndingCard
              summary={sessionSummary}
              captures={captures}
              sessionExpired={sessionExpired}
              isVenice={isVenice}
              onUpgrade={() => {
                stopSession();
                setSelectedProvider(null);
                setSessionGoal(null);
                setSelectedPersona(null);
              }}
              onMint={() => setShowTipModal(false)}
              onViewSummary={handleFinish}
              onTip={() => setShowTipModal(true)}
              recommendedProducts={sessionSummary.recommendations || []}
              onViewShop={openCart}
            />
          )}
      </AnimatePresence>

      {/* Control Bar — Mobile-safe */}
      <div
        className="bg-card px-4 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-10 flex items-center justify-around gap-2 sm:gap-4 border-t border-border relative z-[50] shadow-[0_-20px_50px_rgba(0,0,0,0.15)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFinish()}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 group"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500 group-hover:scale-110 transition-transform" />
        </Button>

        <div className="flex flex-col items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              size="icon"
              onClick={startTimerCapture}
              className={`w-14 h-14 sm:w-18 sm:h-18 rounded-full transition-all duration-300 shadow-xl ${
                countdown !== null
                  ? "bg-amber-600 scale-95 shadow-amber-500/20"
                  : capturesExhausted
                    ? "bg-white/20 cursor-not-allowed"
                    : "bg-white hover:bg-slate-200 shadow-white/10"
              }`}
              disabled={capturesExhausted}
            >
              <Clock
                className={`w-6 h-6 sm:w-8 sm:h-8 ${countdown !== null ? "text-white" : capturesExhausted ? "text-white/30" : "text-slate-950"}`}
              />
            </Button>

            <Button
              size="icon"
              onClick={handleCapture}
              className={`w-14 h-14 sm:w-18 sm:h-18 rounded-full text-white shadow-xl ${
                capturesExhausted
                  ? "bg-slate-700 cursor-not-allowed shadow-none"
                  : `bg-${personaStyling.color} hover:bg-${personaStyling.accent} shadow-${personaStyling.color}/20`
              }`}
              disabled={isCapturing || capturesExhausted}
            >
              {isCapturing ? (
                <Sparkles className="animate-spin w-6 h-6 sm:w-8 sm:h-8" />
              ) : (
                <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
              )}
            </Button>
          </div>
          {/* Captures remaining badge — free tier only */}
          {!isPremium && (
            <span
              className={`text-[10px] font-mono font-bold ${
                capturesExhausted ? "text-rose-400" : "text-slate-500"
              }`}
            >
              {capturesExhausted
                ? "Free captures used"
                : `${capturesRemaining} capture${capturesRemaining !== 1 ? "s" : ""} left`}
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            onClick={openCart}
            className="hidden sm:flex h-12 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-100 px-4 gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-bold">Shop gaps</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border transition-all ${
              isVoiceEnabled
                ? `bg-${personaStyling.color}/20 border-${personaStyling.color}/40 text-${personaStyling.accent} shadow-[0_0_15px_rgba(99,102,241,0.2)]`
                : "bg-muted/30 border-border text-muted-foreground"
            }`}
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </Button>

          {/* Cart + Tip — mobile accessible */}
          <button
            onClick={openCart}
            className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-muted/30 hover:bg-muted border border-border flex items-center justify-center transition-all"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-foreground/80" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
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
