import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
  Mic,
  Video,
  PhoneOff,
  Sparkles,
  AlertCircle,
  Camera,
  Clock,
  Volume2,
  VolumeX,
  Calendar,
  Sun,
  MessageSquareWarning,
  CheckCircle,
  Palette,
  Ruler,
  Eye,
  Zap,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGeminiLive, useVeniceLive } from "@repo/ai-client";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { CeloTipButton } from "./CeloTipButton";
import { MintLookButton } from "./MintLookButton";
import { GeminiLivePaymentButton } from "./GeminiLivePaymentButton";
import { useAccount } from "wagmi";
import {
  trackProviderSelected,
  trackSessionStarted,
  trackSessionEnded,
  trackPaymentInitiated,
  trackPaymentCompleted,
  trackPaymentFailed,
  trackError,
  getABTestValue,
} from "../../lib/utils/analytics";

type AIProvider = "venice" | "gemini";

interface CaptureOption {
  image: string;
  comment: string;
}

interface LiveStylistViewProps {
  onBack: () => void;
}

type ActivityType = "thought" | "decision" | "action";

interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  timestamp: number;
}

export function LiveStylistView({ onBack }: LiveStylistViewProps) {
  const gemini = useGeminiLive();
  const venice = useVeniceLive();
  const { context } = useMiniApp();
  const { isConnected: isWalletConnected } = useAccount();

  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    null,
  );
  const [activities, setActivities] = useState<Activity[]>([]);

  const [captures, setCaptures] = useState<CaptureOption[]>([]);
  const [selectedCaptureIndex, setSelectedCaptureIndex] = useState<number>(0);
  const [finalAdvice, setFinalAdvice] = useState<string>("");
  const [uploadedData, setUploadedData] = useState<{
    url: string;
    ipfsUrl: string;
    ipfsCid: string;
  } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionGoal, setSessionGoal] = useState<
    "event" | "daily" | "critique" | null
  >(null);
  const [userApiKey, setUserApiKey] = useState("");
  const [showByokInput, setShowByokInput] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [geminiPaymentToken, setGeminiPaymentToken] = useState<string | null>(
    null,
  );
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [initStep, setInitStep] = useState<string>("connecting");

  // Use the appropriate provider based on selection
  const activeProvider = selectedProvider === "venice" ? venice : gemini;
  const {
    isConnected,
    isInitializing,
    error,
    videoRef,
    startSession,
    stopSession,
    transcript,
    aiResponse: liveAiResponse,
    reasoning,
    agentEvents,
  } = activeProvider;

  // Derive a session summary from reasoning + AI responses
  const sessionSummary = useMemo(() => {
    if (reasoning.length === 0 && !finalAdvice) return null;

    const allText = [...reasoning, finalAdvice]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const positives = [
      "good",
      "great",
      "sharp",
      "excellent",
      "love",
      "perfect",
      "solid",
      "working",
      "flattering",
      "on point",
      "elevate",
      "strong",
    ];
    const negatives = [
      "avoid",
      "not working",
      "clash",
      "off",
      "wrong",
      "too tight",
      "too loose",
      "mismatch",
      "distract",
      "overpower",
    ];
    const topics: string[] = [];

    if (/color|palette|tone|shade|hue|coordination/.test(allText))
      topics.push("Color Harmony");
    if (/fit|drape|silhouette|proportion|shape|tailor/.test(allText))
      topics.push("Fit & Proportion");
    if (/accessory|jewelry|watch|belt|bag|shoe/.test(allText))
      topics.push("Accessories");
    if (/texture|fabric|material/.test(allText))
      topics.push("Fabric & Texture");
    if (/posture|stance|pose|angle/.test(allText))
      topics.push("Posture & Pose");
    if (/event|occasion|formal|casual|dress code/.test(allText))
      topics.push("Occasion Match");
    if (/layer|outerwear|cardigan|jacket/.test(allText))
      topics.push("Layering");

    const isCritique = sessionGoal === "critique";
    const posCount = positives.filter((p) => allText.includes(p)).length;
    const negCount = negatives.filter((n) => allText.includes(n)).length;
    const total = posCount + negCount;
    // Base score 7, adjusted by sentiment.
    // Critique mode is harsher (lower base).
    const base = isCritique ? 5 : 7;
    const sentimentBonus =
      total === 0 ? 0 : (posCount / total) * 3 - (negCount / total) * 2;

    const score = Math.min(10, Math.max(1, Math.round(base + sentimentBonus)));

    const takeaways = reasoning
      .slice(0, 5)
      .map((r) => r.replace(/^["\s]+|["\s]+$/g, ""))
      .filter((r) => r.length > 12 && r.length < 120);

    return { score, topics: topics.slice(0, 4), takeaways };
  }, [reasoning, finalAdvice, sessionGoal]);

  const isCritique = sessionGoal === "critique";

  // Position detection derived from reasoning
  const positionStatus = useMemo(() => {
    if (!isConnected || reasoning.length === 0) return "analyzing";
    const latest = (reasoning[0] || "").toLowerCase();
    if (
      latest.includes("step back") ||
      latest.includes("too close") ||
      latest.includes("positioning")
    )
      return "bad";
    if (
      latest.includes("good") ||
      latest.includes("ready") ||
      latest.includes("silhouette") ||
      latest.includes("perfect")
    )
      return "good";
    return "analyzing";
  }, [isConnected, reasoning]);

  const GOAL_OPTIONS = [
    {
      id: "event" as const,
      label: "Event Styling",
      desc: "Prepare for a special occasion — formal, party, or date night",
      icon: Calendar,
      color: "from-purple-500 to-indigo-600",
    },
    {
      id: "daily" as const,
      label: "Daily Outfit Check",
      desc: "Quick review of your everyday look for fit and coordination",
      icon: Sun,
      color: "from-amber-500 to-orange-600",
    },
    {
      id: "critique" as const,
      label: "Honest Critique",
      desc: "No sugarcoating — real talk on what works and what doesn't",
      icon: MessageSquareWarning,
      color: "from-rose-500 to-red-600",
    },
  ];

  const hasCaptures = captures.length > 0;
  const selectedCapture = hasCaptures ? captures[selectedCaptureIndex] : null;

  // Coaching overlays — derived from reasoning keywords
  const [coachingBadges, setCoachingBadges] = useState<
    Array<{
      id: string;
      label: string;
      icon: typeof CheckCircle;
      color: string;
    }>
  >([]);

  useEffect(() => {
    if (!isConnected || reasoning.length === 0) {
      setCoachingBadges([]);
      return;
    }
    const latest = (reasoning[0] || "").toLowerCase();
    const badges: typeof coachingBadges = [];

    if (/color|palette|tone|shade|hue/.test(latest)) {
      badges.push({
        id: "color",
        label: "Color Check",
        icon: Palette,
        color: "from-violet-500/80 to-purple-600/80",
      });
    }
    if (/fit|drape|silhouette|proportion|shape/.test(latest)) {
      badges.push({
        id: "fit",
        label: "Fit Analysis",
        icon: Ruler,
        color: "from-emerald-500/80 to-green-600/80",
      });
    }
    if (/good|great|sharp|excellent|love|perfect|solid|working/.test(latest)) {
      badges.push({
        id: "approval",
        label: "Looking Good",
        icon: CheckCircle,
        color: "from-sky-500/80 to-blue-600/80",
      });
    }
    if (
      /scan|analyz|check|evaluat|review/.test(latest) &&
      !badges.some((b) => b.id === "approval")
    ) {
      badges.push({
        id: "scanning",
        label: "Scanning…",
        icon: Eye,
        color: "from-amber-500/80 to-orange-600/80",
      });
    }

    setCoachingBadges(badges);
  }, [isConnected, reasoning]);

  useEffect(() => {
    if (agentEvents.length > 0) {
      const latest = agentEvents[0];
      if (!latest) return;
      setActivities((prev) =>
        [
          {
            id: `protocol-${latest.id}`,
            type: "action" as ActivityType,
            text: String(latest.text ?? ""),
            timestamp: Number(latest.id) || Date.now(),
          },
          ...prev,
        ].slice(0, 10),
      );
    }
  }, [agentEvents]);

  useEffect(() => {
    if (reasoning.length > 0) {
      const latest = reasoning[0] ?? "";
      if (!latest) return;
      const type: ActivityType =
        latest.toLowerCase().includes("analyzing") ||
        latest.toLowerCase().includes("checking")
          ? "thought"
          : latest.toLowerCase().includes("perfect") ||
              latest.toLowerCase().includes("locked")
            ? "decision"
            : "thought";

      setActivities(
        (prev) =>
          [
            {
              id: Math.random().toString(36).substr(2, 9),
              type,
              text: latest,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 10) as Activity[],
      );
    }
  }, [reasoning]);

  useEffect(() => {
    if (liveAiResponse?.trim() && isVoiceEnabled) {
      const utterance = new SpeechSynthesisUtterance(liveAiResponse);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [liveAiResponse, isVoiceEnabled]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);

      // Pulse haptic if on Farcaster
      try {
        sdk.actions.ready();
      } catch {}

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const image = canvas.toDataURL("image/jpeg", 0.82);

        const newCapture = {
          image,
          comment: reasoning[0] || "Analyzing style selection…",
        };

        setCaptures((prev) => [...prev, newCapture]);
        setSelectedCaptureIndex(captures.length);
      }
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, reasoning, videoRef, captures.length]);

  const startTimerCapture = useCallback(() => {
    if (countdown !== null) return;
    setCountdown(10);

    // Play countdown sound if possible
    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const playBeep = async (freq: number) => {
        if (ctx.state === "suspended") await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      };

      let count = 10;
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          if (count <= 3)
            playBeep(880); // Speed up beeps for last 3s
          else if (count % 2 === 0) playBeep(440);
          setCountdown(count);
        } else {
          clearInterval(interval);
          playBeep(1760);
          setCountdown(null);
          handleCapture();
        }
      }, 1000);
      playBeep(440); // Initial beep
    } catch {
      let count = 10;
      const interval = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else {
          clearInterval(interval);
          setCountdown(null);
          handleCapture();
        }
      }, 1000);
    }
  }, [countdown, handleCapture]);

  const handleFinish = async () => {
    setFinalAdvice(
      liveAiResponse ||
        "Great session! You've got a solid handle on your personal style.",
    );
    setShowSummary(true);
    stopSession();
  };

  const handleShare = async () => {
    if (!selectedCapture || !sessionSummary) return;

    try {
      const text = `Check out my OnPoint Style Score: ${sessionSummary.score}/10! 👗✨\n\nAnalyzed: ${sessionSummary.topics.join(", ")}\n\nTakeaway: ${sessionSummary.takeaways[0] || "Found my perfect look!"}\n\nMinted on Celo via @onpoint`;

      const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(window.location.host)}`;
      window.open(shareUrl, "_blank");
    } catch (err) {
      console.error("Share error:", err);
    }
  };

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

          {/* Photo Gallery Wrap */}
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
              onClick={handleShare}
            >
              Share to Warpcast
            </Button>
            <CeloTipButton />
          </div>
        </div>
      </div>
    );
  }

  // Provider selection screen
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
            {/* Venice AI - Free */}
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

            {/* Gemini Live - Premium */}
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

  // Goal selection screen (only shown after provider is selected)
  if (!sessionGoal) {
    return (
      <div className="flex flex-col h-full bg-slate-950 p-6">
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 max-w-sm mx-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span
                className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                  selectedProvider === "venice"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-indigo-500/20 text-indigo-400"
                }`}
              >
                {selectedProvider === "venice"
                  ? "Venice AI (Free)"
                  : "Gemini Live (Premium)"}
              </span>
              <button
                onClick={() => setSelectedProvider(null)}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline"
              >
                Change
              </button>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter italic">
              LIVE STYLIST
            </h1>
            <p className="text-slate-400 text-sm">
              Select your session goal to begin style analysis.
            </p>
          </div>

          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSessionGoal(goal.id)}
                className="w-full text-left p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-indigo-500/30 group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center shrink-0`}
                  >
                    <goal.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {goal.label}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {goal.desc}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Gemini options: Payment or BYOK */}
          {selectedProvider === "gemini" && (
            <div className="w-full space-y-4 pt-4">
              {/* Payment success message */}
              <AnimatePresence>
                {showPaymentSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <p className="text-emerald-300 text-sm font-medium">
                        Gemini Live unlocked! Select a session goal to start.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Payment button - show if no BYOK and no payment yet */}
              {!showByokInput && !geminiPaymentToken && (
                <div className="space-y-3">
                  <GeminiLivePaymentButton
                    onSuccess={(token) => {
                      setGeminiPaymentToken(token);
                      setShowPaymentSuccess(true);
                      setTimeout(() => setShowPaymentSuccess(false), 3000);
                    }}
                    onError={(err) => console.error("Payment error:", err)}
                  />
                </div>
              )}

              {/* BYOK toggle */}
              <div className="flex items-center justify-center">
                <div className="h-px bg-white/10 flex-1" />
                <span className="px-3 text-[10px] text-slate-500 uppercase">
                  or
                </span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <button
                onClick={() => setShowByokInput(!showByokInput)}
                className="text-indigo-400 text-xs font-bold uppercase tracking-widest"
              >
                {showByokInput ? "Cancel BYOK" : "Use My Own Gemini Key (BYOK)"}
              </button>

              <AnimatePresence>
                {showByokInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <input
                      type="password"
                      placeholder="Enter Gemini API Key"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Your key is used locally and never stored on our servers.
                    </p>
                    {userApiKey && (
                      <p className="text-[10px] text-emerald-400">
                        Using your own API key — no payment required.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative font-sans">
      {/* Top Ticker reasoning */}
      <div className="absolute top-0 inset-x-0 z-[60] p-4 pointer-events-none">
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
        {isInitializing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-t-2 border-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-b-2 border-indigo-400 animate-spin-slow" />
              </div>
            </div>

            {/* Step-by-step progress indicator */}
            <div className="mt-8 w-64 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    initStep === "connecting"
                      ? "bg-indigo-500 animate-pulse"
                      : initStep !== "error"
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                  }`}
                >
                  {initStep !== "connecting" && initStep !== "error" ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : initStep === "connecting" ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : null}
                </div>
                <span
                  className={`text-xs ${initStep === "connecting" ? "text-indigo-400" : "text-emerald-400"}`}
                >
                  Connecting to camera...
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    initStep === "authenticating"
                      ? "bg-indigo-500 animate-pulse"
                      : initStep === "ready" || initStep === "starting"
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                  }`}
                >
                  {initStep === "ready" || initStep === "starting" ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : initStep === "authenticating" ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : null}
                </div>
                <span
                  className={`text-xs ${
                    initStep === "authenticating"
                      ? "text-indigo-400"
                      : initStep === "ready" || initStep === "starting"
                        ? "text-emerald-400"
                        : "text-slate-500"
                  }`}
                >
                  Authenticating with{" "}
                  {selectedProvider === "venice" ? "Venice AI" : "Gemini"}...
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    initStep === "starting"
                      ? "bg-indigo-500 animate-pulse"
                      : initStep === "ready"
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                  }`}
                >
                  {initStep === "ready" ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : initStep === "starting" ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : null}
                </div>
                <span
                  className={`text-xs ${
                    initStep === "starting"
                      ? "text-indigo-400"
                      : initStep === "ready"
                        ? "text-emerald-400"
                        : "text-slate-500"
                  }`}
                >
                  Starting AI session...
                </span>
              </div>
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

        {error ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-rose-950/20 backdrop-blur-3xl">
            <div className="bg-slate-900/90 border border-rose-500/30 p-8 rounded-3xl max-w-sm w-full shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                Interface Failure
              </h2>
              <p className="text-slate-400 text-sm text-center mb-8">{error}</p>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-full font-bold"
                  onClick={() =>
                    startSession(
                      sessionGoal,
                      userApiKey || geminiPaymentToken || undefined,
                    )
                  }
                >
                  Restart Interface
                </Button>
                {!userApiKey && !geminiPaymentToken && (
                  <Button
                    variant="ghost"
                    className="text-white hover:bg-white/5 font-bold"
                    onClick={() => setSessionGoal(null)}
                  >
                    Select New Goal
                  </Button>
                )}
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

        {/* Agent Activity Trace (AG-UI Style) */}
        <div className="absolute left-4 top-24 bottom-24 w-64 pointer-events-none hidden lg:flex flex-col gap-2 overflow-hidden">
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

        <div className="absolute right-4 top-24 bottom-24 w-64 pointer-events-none hidden lg:flex flex-col gap-2 overflow-hidden">
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

        {/* Real-time Coaching Overlays */}
        <AnimatePresence>
          {coachingBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-6 top-32 flex flex-col gap-2 z-40"
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

        {/* Action Suggestion Toast */}
        <AnimatePresence>
          {sessionSummary && sessionSummary.score >= 8 && isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-32 inset-x-0 flex justify-center z-50 px-6"
            >
              <div className="bg-indigo-600 border border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] p-4 rounded-3xl flex items-center gap-4 max-w-md w-full">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">
                    Agent Recommendation
                  </h4>
                  <p className="text-white/80 text-xs">
                    Style Score is Elite. I propose minting this Proof of Style
                    to Celo.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-white text-indigo-600 hover:bg-white/90 font-bold rounded-full px-4"
                  onClick={handleCapture}
                >
                  Capture
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captures Mini-Gallery */}
        {hasCaptures && (
          <div className="absolute left-6 bottom-32 z-40 flex flex-col gap-3">
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

        {/* Flash Overlay */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white"
            />
          )}
        </AnimatePresence>

        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
            >
              <div className="text-[12rem] font-black text-white italic drop-shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                {countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction Toast */}
        <AnimatePresence>
          {showInstructions && isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 inset-x-0 flex justify-center z-40 px-6"
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
      </div>

      {/* Control Bar */}
      <div className="bg-slate-950 px-6 py-6 pb-10 flex items-center justify-around gap-4 border-t border-white/5 relative z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => stopSession()}
          className="w-14 h-14 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 group"
        >
          <PhoneOff className="w-6 h-6 text-rose-500 group-hover:scale-110 transition-transform" />
        </Button>

        <div className="flex items-center gap-4">
          <Button
            size="icon"
            onClick={startTimerCapture}
            className={`w-18 h-18 rounded-full transition-all duration-300 shadow-xl ${
              countdown !== null
                ? "bg-amber-600 scale-95 shadow-amber-500/20"
                : "bg-white hover:bg-slate-200 shadow-white/10"
            }`}
          >
            <Clock
              className={`w-8 h-8 ${countdown !== null ? "text-white" : "text-slate-950"}`}
            />
          </Button>

          <Button
            size="icon"
            onClick={handleCapture}
            className="w-18 h-18 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20"
            disabled={isCapturing}
          >
            {isCapturing ? (
              <Sparkles className="animate-spin w-8 h-8" />
            ) : (
              <Camera className="w-8 h-8" />
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className={`w-14 h-14 rounded-full border transition-all ${
              isVoiceEnabled
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-white/5 border-white/10 text-white/40"
            }`}
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-6 h-6" />
            ) : (
              <VolumeX className="w-6 h-6" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="w-14 h-14 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-lg italic shadow-emerald-500/10"
            onClick={handleFinish}
          >
            <div className="relative">
              <span className="relative z-10 italic">#1</span>
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-emerald-400 opacity-50" />
            </div>
          </Button>
        </div>
      </div>

      {!isConnected && !isInitializing && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
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
