"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Button } from "@repo/ui/button";
import {
  PhoneOff,
  Sparkles,
  AlertCircle,
  Camera,
  Clock,
  Volume2,
  VolumeX,
  CheckCircle,
  ShoppingBag,
  HelpCircle,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { TipSheet } from "../Agent/TipModal";
import { AgentApprovalModal } from "../Agent/AgentApprovalModal";
import { AgentSuggestionToast } from "../Agent/AgentSuggestionToast";
import { CartDrawer } from "../Shop/CartDrawer";
import { CheckoutModal } from "../Shop/CheckoutModal";
import { SessionEndingCard } from "./SessionEndingCard";
import { useCartStore } from "../../lib/stores/cart-store";
import { trackProviderSelected } from "../../lib/utils/analytics";
import { useLiveSession, type SessionGoal } from "./hooks/useLiveSession";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { recordLatency } from "../../lib/utils/latency-persistence";
import { LiveSessionStartScreen } from "./LiveSessionStartScreen";
import { LiveSessionError } from "./LiveSessionError";
import { AutoDismissTimer } from "./hooks/AutoDismissTimer";
import { CaptureProgressRing } from "./hooks/CaptureProgressRing";


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
  /**
   * Optional handler to switch to the photo-upload mode. Shown in the
   * start screen, init card, and error screen as an escape hatch when
   * the camera is blocked, slow, or fails to launch.
   */
  onSwitchToUpload?: () => void;
}

type QueuedLiveStart = {
  provider: string;
  goal: string;
  persona: string;
  apiKey?: string;
};

const DEFAULT_LIVE_PERSONA = "shaft";

export function LiveStylistView({ onBack, onSwitchToUpload }: LiveStylistViewProps) {
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
    setShowSummary: _setShowSummary,
    finalAdvice,
    sessionEndedManually,
    isConnected,
    isInitializing,
    isAnalyzing,
    error,
    cameraError,
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
    showPaymentSuccess: _showPaymentSuccess,
    setShowPaymentSuccess: _setShowPaymentSuccess,
    uploadedData: _uploadedData,
    setUploadedData: _setUploadedData,
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
    requiresPayment: _requiresPayment,
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

  const { isConnected: _isWalletConnected } = useAccount();
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
    // `session` is intentionally omitted from deps — it changes on every
    // render, which would defeat the purpose of useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stopSession, onBack]);

  // Cleanup on unmount — ensure camera stops if component is removed
  React.useEffect(() => {
    return () => {
      session.stopSession();
    };
    // We intentionally omit `session` from deps — we only want this to run on unmount,
    // and session.stopSession is captured fresh via the ref pattern below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile detection — hide non-essential HUD elements on small screens
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  const personaStyling = React.useMemo(
    () => getPersonaConfig(selectedPersona),
    [selectedPersona],
  );

  // When the session is ending (manual stop, expired, or out of captures),
  // unmount the camera video so it can't reconnect to a cleared stream and
  // doesn't waste resources while the ending card / summary is shown.
  const sessionEnding = React.useMemo(
    () => sessionEndedManually || sessionExpired || capturesExhausted,
    [sessionEndedManually, sessionExpired, capturesExhausted],
  );

  const PersonaIcon = personaStyling.icon;
  const liveModeLabel = React.useMemo(
    () =>
      sessionGoal === "event"
        ? "Event prep"
        : sessionGoal === "critique"
          ? "Critique"
          : "Outfit check",
    [sessionGoal],
  );
  const scanSignals = React.useMemo(
    () => [
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
    ],
    [positionStatus, reasoning.length, isAnalyzing, suggestions.length],
  );


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
      <LiveSessionStartScreen
        onBack={handleBack}
        isPremium={isPremium}
        isInitializing={isInitializing}
        error={error}
        capturesRemaining={capturesRemaining}
        onDismissError={() => { stopSession(); setSelectedProvider(null); }}
        onUseUploadPhoto={onSwitchToUpload}
        onStart={() => {
          trackProviderSelected({ provider: "venice" });
          // Set all session state and call startSession in one batch.
          // The hook's startSession sets isInitializing(true) synchronously,
          // so the main view renders with the init overlay already showing —
          // eliminating the blank-camera flash between start screen and init.
          setSelectedProvider("venice");
          setSessionGoal("daily");
          setSelectedPersona(DEFAULT_LIVE_PERSONA);
          startSession("daily", undefined, DEFAULT_LIVE_PERSONA);
        }}
        onCompareProviders={() => setShowComparison(true)}
        showComparison={showComparison}
        onCloseComparison={() => setShowComparison(false)}
        onSelectComparisonProvider={(p, g) => {
          trackProviderSelected({ provider: p as "venice" | "gemini" });
          setSelectedProvider(p as "venice" | "gemini");
          setSessionGoal(g as SessionGoal);
          setSelectedPersona(DEFAULT_LIVE_PERSONA);
          startSession(g as SessionGoal, undefined, DEFAULT_LIVE_PERSONA);
        }}
      />
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
        {/* Init placeholder — centered visual in the viewport so the user
            never sees a blank area while the camera is initializing. The
            init card below shows the technical progress. */}
        {isInitializing && (
          <div
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none px-6"
            role="presentation"
            aria-hidden="true"
          >
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-6 opacity-50">
              <div className="absolute inset-0 rounded-3xl border-2 border-white/10" />
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-emerald-300/60 rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-emerald-300/60 rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-emerald-300/60 rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-emerald-300/60 rounded-br-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera
                  className={`w-12 h-12 sm:w-16 sm:h-16 text-${personaStyling.accent}/40 animate-pulse`}
                />
              </div>
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none">
                <motion.div
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  initial={{ y: 0 }}
                  animate={{ y: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
            <p className="text-sm text-white/70 font-medium text-center max-w-xs">
              Setting up your camera
            </p>
            <p className="text-xs text-white/40 text-center max-w-xs mt-1">
              We&apos;re asking for camera permission
            </p>
            {onSwitchToUpload && (
              <button
                onClick={onSwitchToUpload}
                className="mt-5 pointer-events-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] border border-white/10 text-white/70 hover:text-white text-xs font-medium transition-[background-color,transform,color]"
              >
                <Upload className="w-3.5 h-3.5" />
                Use Upload Photo instead
              </button>
            )}
          </div>
        )}

        {/* Init Loader — floating card so the user can see the camera preview
            as it initializes behind it. */}
        {isInitializing && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,420px)] rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 p-4 shadow-2xl pointer-events-auto"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="relative shrink-0">
                <div
                  className={`w-8 h-8 rounded-full border-t-2 border-${personaStyling.color} animate-spin`}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-4 h-4 rounded-full border-b-2 border-${personaStyling.accent} animate-spin-slow`}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-${personaStyling.text} font-mono text-[10px] uppercase tracking-[0.2em] truncate`}
                >
                  {isPremium
                    ? "Connecting Live Agent"
                    : "Connecting Style Scanner"}
                </p>
                {isPremium && (
                  <p className="text-amber-400/60 text-[9px] mt-0.5">
                    Real-time streaming enabled
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {["connecting", "authenticating", "starting"].map((step, i) => {
                const labels = [
                  "Camera ready",
                  `Authenticating ${providerDisplayName}`,
                  "Starting AI session",
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
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? `bg-${personaStyling.color} animate-pulse`
                          : isDone
                            ? "bg-emerald-500"
                            : "bg-slate-600"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      ) : isCurrent ? (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      ) : null}
                    </div>
                    <span
                      className={`text-[10px] truncate ${
                        isCurrent
                          ? `text-${personaStyling.text}`
                          : isDone
                            ? "text-emerald-400"
                            : "text-slate-500"
                      }`}
                    >
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                stopSession();
                setSelectedProvider(null);
                setSessionGoal(null);
                setSelectedPersona(null);
                setQueuedStart(null);
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] border border-white/10 text-white/70 hover:text-white text-[10px] font-medium transition-[background-color,transform,box-shadow]"
            >
              <PhoneOff className="w-3 h-3" />
              Cancel
            </button>
            {onSwitchToUpload && (
              <button
                onClick={onSwitchToUpload}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-white/50 hover:text-white/80 text-[10px] font-medium transition-colors"
              >
                <Upload className="w-3 h-3" />
                Use Upload Photo instead
              </button>
            )}
          </div>
        )}

        {/* Error Screen — LiveSessionError handles both generic errors
            (payment, network, server) and structured camera errors. When
            cameraError is set, it renders a recovery layout with
            browser-specific steps; otherwise it falls back to the
            generic error shell. */}
        {error || cameraError ? (
          <LiveSessionError
            error={error ?? undefined}
            cameraError={cameraError}
            isPremium={isPremium}
            supportsByok={supportsByok}
            geminiPaymentToken={geminiPaymentToken}
            showByokInput={showByokInput}
            userApiKey={userApiKey}
            sessionGoal={sessionGoal}
            onStopSession={() => stopSession()}
            onGoBack={() => { stopSession(); setSelectedProvider(null); setSessionGoal(null); }}
            onPaymentSuccess={(token) => {
              setGeminiPaymentToken(token);
              _setShowPaymentSuccess(true);
              startSession(sessionGoal as SessionGoal, token);
            }}
            onStartSession={(goal, apiKey) => startSession(goal as SessionGoal, apiKey)}
            onShowByok={() => setShowByokInput(true)}
            onSetUserApiKey={(key) => setUserApiKey(key)}
            onUseUploadPhoto={onSwitchToUpload}
          />
        ) : sessionEnding || isInitializing ? null : (
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
                    Capture {maxCaptures} Style Shots
                  </h4>
                  <p className="text-muted-foreground text-[10px] leading-snug">
                    Step back until framing locks. Tap the camera button to save
                    snapshots — {capturesRemaining} shot{capturesRemaining !== 1 ? "s" : ""} left
                    build your full style profile.
                  </p>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  aria-label="Dismiss instructions"
                  className="w-11 h-11 rounded-full hover:bg-white/10 active:bg-white/15 active:scale-[0.95] flex items-center justify-center transition-[background-color,transform]"
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
        {sessionEnding &&
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
      {!sessionEnding && (
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
              className={`w-14 h-14 sm:w-18 sm:h-18 rounded-full text-white shadow-xl relative ${
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
              {/* Capture progress ring (free tier) */}
              {!isPremium && maxCaptures > 0 && maxCaptures !== Infinity && (
                <CaptureProgressRing
                  used={maxCaptures - capturesRemaining}
                  total={maxCaptures}
                />
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

          {/* Help — recall instructions toast */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowInstructions(true);
            }}
            aria-label="Show capture instructions"
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border transition-all ${
              showInstructions
                ? `bg-${personaStyling.color}/20 border-${personaStyling.color}/40 text-${personaStyling.accent}`
                : "bg-muted/30 border-border text-muted-foreground"
            }`}
          >
            <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>

          {/* Cart + Tip — mobile accessible */}
          <button
            onClick={openCart}
            className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-muted/30 hover:bg-muted active:bg-muted/50 active:scale-[0.95] border border-border flex items-center justify-center transition-[background-color,transform]"
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
      )}
    </div>
  );
}
