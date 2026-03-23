/**
 * useLiveSession — Core session state + logic for LiveStylistView
 *
 * Manages: provider selection, session lifecycle, captures, activities,
 * coaching badges, suggestion gating, capture logic, voice synthesis,
 * and AI-driven suggestion triggers.
 *
 * Extracted from LiveStylistView for single responsibility.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useGeminiLive, useVeniceLive } from "@repo/ai-client";
import { sdk } from "@farcaster/miniapp-sdk";
import { PersonaVoice } from "../../../lib/utils/persona-voice";
import {
  useAgentSuggestions,
  type AgentSuggestion,
} from "../../Agent/AgentSuggestionToast";
import { useAgentApproval } from "../../Agent/AgentApprovalModal";
import { useCartStore } from "../../../lib/stores/cart-store";
import type { ActionType } from "../../../lib/middleware/agent-controls";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import { MissionService } from "../../../lib/services/mission-service";
import { StyleContextStore } from "../../../lib/services/style-context-store";

// ── Types ──

export type AIProvider = "venice" | "gemini";

export interface CaptureOption {
  image: string;
  comment: string;
}

export type ActivityType = "thought" | "decision" | "action";

export interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  timestamp: number;
}

export interface CoachingBadge {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

export interface SessionSummary {
  score: number;
  topics: string[];
  takeaways: string[];
  recommendations?: Array<{ name: string; price: number; category: string }>;
}

type SessionGoal = "event" | "daily" | "critique" | null;

// ── Goal options (constant) ──

import {
  Calendar,
  Sun,
  MessageSquareWarning,
  Palette,
  Ruler,
  CheckCircle,
  Eye,
} from "lucide-react";

export const GOAL_OPTIONS = [
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

// ── Constants ──

const SUGGESTION_COOLDOWN_MS = 30_000;
const SESSION_WARMUP_MS = 15_000;
const VENICE_FREE_CAPTURES = 3;

// ── Hook ──

export function useLiveSession() {
  // ── Providers ──
  const gemini = useGeminiLive();
  const venice = useVeniceLive();

  // ── Session state ──
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    null,
  );
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [sessionGoal, setSessionGoal] = useState<SessionGoal>(null);
  const [initStep, setInitStep] = useState<string>("connecting");
  const [showSummary, setShowSummary] = useState(false);
  const [finalAdvice, setFinalAdvice] = useState<string>("");
  const [sessionEndedManually, setSessionEndedManually] = useState(false);

  // ── Capture state ──
  const [captures, setCaptures] = useState<CaptureOption[]>([]);
  const [selectedCaptureIndex, setSelectedCaptureIndex] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // ── UI toggles ──
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  // ── Activity state ──
  const [activities, setActivities] = useState<Activity[]>([]);
  const [coachingBadges, setCoachingBadges] = useState<CoachingBadge[]>([]);

  // ── Payment state ──
  const [userApiKey, setUserApiKey] = useState("");
  const [showByokInput, setShowByokInput] = useState(false);
  const [geminiPaymentToken, setGeminiPaymentToken] = useState<string | null>(
    null,
  );
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [uploadedData, setUploadedData] = useState<{
    url: string;
    ipfsUrl: string;
    ipfsCid: string;
  } | null>(null);

  // ── External hooks ──
  const isVenice = selectedProvider === "venice";
  const activeProvider = isVenice ? venice : gemini;
  const {
    isConnected,
    isInitializing,
    error,
    videoRef,
    startSession: providerStartSession,
    stopSession,
    transcript,
    aiResponse: liveAiResponse,
    reasoning,
    agentEvents,
  } = activeProvider;

  // Venice session timer (undefined for Gemini — no limit)
  const sessionTimeRemaining = isVenice
    ? (venice as any).sessionTimeRemaining
    : undefined;
  const sessionExpired = isVenice ? (venice as any).sessionExpired : false;

  // Capture limits: 3 for Venice (free), unlimited for Gemini (paid)
  const maxCaptures = isVenice ? VENICE_FREE_CAPTURES : Infinity;
  const capturesRemaining = Math.max(0, maxCaptures - captures.length);
  const capturesExhausted = capturesRemaining <= 0;

  const {
    suggestions,
    currentSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    createSuggestion,
    dismissSuggestion,
  } = useAgentSuggestions();

  const {
    currentApproval,
    isModalOpen: isApprovalModalOpen,
    setIsModalOpen: setIsApprovalModalOpen,
    approveRequest,
    rejectRequest,
  } = useAgentApproval();

  const addItemToCart = useCartStore((s) => s.addItem);

  // ── Refs ──
  const mintSuggestionCreatedRef = useRef(false);
  const lastSuggestionTimeRef = useRef(0);
  const suggestedItemTypesRef = useRef<Set<string>>(new Set());
  const sessionStartTimeRef = useRef(0);
  const recommendationsFetchedRef = useRef(false);

  // ── Session start tracking ──
  useEffect(() => {
    if (isConnected && sessionStartTimeRef.current === 0) {
      sessionStartTimeRef.current = Date.now();

      // Seed style memory from session goal
      const goalToCategory: Record<string, string> = {
        event: "dresses",
        daily: "shirts",
        critique: "accessories",
      };
      const category = sessionGoal ? goalToCategory[sessionGoal] : null;
      if (category) {
        fetch("/api/agent/style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, price: 100 }),
        }).catch(() => {});
      }

      // Get contextual prompt from StyleContextStore for cross-feature continuity
      const userId = "user-" + Date.now(); // In production, use actual user ID
      StyleContextStore.getContextualPrompt(userId)
        .then((prompt) => {
          if (prompt) {
            console.log("Style context loaded:", prompt);
          }
        })
        .catch(() => {});
    }
    if (!isConnected) {
      sessionStartTimeRef.current = 0;
      suggestedItemTypesRef.current.clear();
      lastSuggestionTimeRef.current = 0;
      mintSuggestionCreatedRef.current = false;
      recommendationsFetchedRef.current = false;
    }
  }, [isConnected, sessionGoal]);

  // ── Suggestion gating ──
  const canCreateSuggestion = useCallback((itemType: string) => {
    const now = Date.now();
    const elapsed = now - lastSuggestionTimeRef.current;
    const sessionAge = now - sessionStartTimeRef.current;

    if (elapsed < SUGGESTION_COOLDOWN_MS) return false;
    if (sessionAge < SESSION_WARMUP_MS) return false;
    if (suggestedItemTypesRef.current.has(itemType)) return false;

    lastSuggestionTimeRef.current = now;
    suggestedItemTypesRef.current.add(itemType);
    return true;
  }, []);

  // ── Session summary derivation ──
  const sessionSummary: SessionSummary | null = useMemo(() => {
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
    const base = isCritique ? 5 : 7;
    const sentimentBonus =
      total === 0 ? 0 : (posCount / total) * 3 - (negCount / total) * 2;
    const score = Math.min(10, Math.max(1, Math.round(base + sentimentBonus)));

    const takeaways = reasoning
      .slice(0, 5)
      .map((r) => r.replace(/^["\s]+|["\s]+$/g, ""))
      .filter((r) => r.length > 12 && r.length < 120);

    // Pick 3 relevant product recommendations
    const shuffled = [...CANVAS_ITEMS].sort(() => Math.random() - 0.5);
    const recommendations = shuffled.slice(0, 3).map((p) => ({
      name: p.name,
      price: p.price,
      category: p.category,
    }));

    return { score, topics: topics.slice(0, 4), takeaways, recommendations };
  }, [reasoning, finalAdvice, sessionGoal]);

  // ── Position detection ──
  const positionStatus = useMemo(() => {
    if (!isConnected || reasoning.length === 0) return "analyzing";
    const latest = (reasoning[0] || "").toLowerCase();
    if (/step back|too close|positioning/.test(latest)) return "bad";
    if (/good|ready|silhouette|perfect/.test(latest)) return "good";
    return "analyzing";
  }, [isConnected, reasoning]);

  // ── Coaching badges derivation ──
  useEffect(() => {
    if (!isConnected || reasoning.length === 0) {
      setCoachingBadges([]);
      return;
    }
    const latest = (reasoning[0] || "").toLowerCase();
    const badges: CoachingBadge[] = [];

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

  // ── Activity tracking (agent events) ──
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

  // ── Activity tracking (reasoning) ──
  useEffect(() => {
    if (reasoning.length > 0) {
      const latest = reasoning[0] ?? "";
      if (!latest) return;
      const lower = latest.toLowerCase();
      const type: ActivityType =
        lower.includes("analyzing") || lower.includes("checking")
          ? "thought"
          : lower.includes("perfect") || lower.includes("locked")
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

      // Record style analysis to StyleContextStore for cross-feature continuity
      const userId = "user-" + Date.now(); // In production, use actual user ID
      StyleContextStore.recordStyleAnalysis(userId, {
        source: "live-ar",
        type: "recommendation",
        content: latest,
        metadata: {
          persona: selectedPersona || undefined,
          score: sessionSummary?.score,
          timestamp: Date.now(),
        },
      }).catch(() => {});
    }
  }, [reasoning, selectedPersona, sessionSummary]);

  // ── Voice synthesis (persona-aware) ──
  useEffect(() => {
    if (liveAiResponse?.trim() && isVoiceEnabled && selectedPersona) {
      PersonaVoice.speakAsPersona(liveAiResponse, selectedPersona).catch(
        () => {},
      );
    }
  }, [liveAiResponse, isVoiceEnabled, selectedPersona]);

  // ── Accept suggestion handler ──
  const handleAcceptSuggestion = useCallback(
    async (id: string) => {
      await acceptSuggestion(id);

      // Track mission progress based on action type
      const userId = "user-" + Date.now(); // In production, use actual user ID

      if (currentSuggestion?.actionType === "purchase") {
        const desc = currentSuggestion.description.toLowerCase();
        const matched = CANVAS_ITEMS.find(
          (item) =>
            desc.includes(item.name.toLowerCase()) ||
            desc.includes(item.slug.toLowerCase()) ||
            desc.includes(item.category.toLowerCase()),
        );
        if (matched) {
          addItemToCart(matched);
        }
        // Track purchase for missions
        try {
          MissionService.updateMissionProgress(userId, "purchase-count");
        } catch (err) {
          console.error("Mission tracking error:", err);
        }
      }

      if (currentSuggestion?.actionType === "mint") {
        // Track mint for missions
        try {
          MissionService.updateMissionProgress(userId, "mint-count");
        } catch (err) {
          console.error("Mission tracking error:", err);
        }
      }
    },
    [acceptSuggestion, currentSuggestion, addItemToCart],
  );

  // ── Mint suggestion when score is elite ──
  useEffect(() => {
    if (
      sessionSummary &&
      sessionSummary.score >= 8 &&
      isConnected &&
      !mintSuggestionCreatedRef.current
    ) {
      mintSuggestionCreatedRef.current = true;
      createSuggestion({
        actionType: "mint" as ActionType,
        amount: "0.5 cUSD",
        description: `Style Score is Elite (${sessionSummary.score}/10). Mint this Proof of Style to Celo?`,
      }).catch(() => {});
    }
  }, [sessionSummary, isConnected, createSuggestion]);

  // ── Purchase suggestion from AI reasoning ──
  useEffect(() => {
    if (!isConnected || reasoning.length === 0) return;
    const latest = (reasoning[0] || "").toLowerCase();

    const itemKeywords: Record<string, string> = {
      shirt: "shirt",
      jacket: "jacket",
      shoe: "shoe",
      sneaker: "shoe",
      bag: "bag",
      accessory: "accessory",
      dress: "dress",
      coat: "coat",
      trouser: "trouser",
      denim: "denim",
    };

    const isRecommendation =
      latest.includes("recommend") || latest.includes("suggest");
    if (!isRecommendation) return;

    const matchedType = Object.entries(itemKeywords).find(([keyword]) =>
      latest.includes(keyword),
    );
    if (!matchedType) return;

    const [, itemType] = matchedType;
    if (!canCreateSuggestion(itemType)) return;

    const contextSnippet = reasoning[0]?.slice(0, 80) || "analyzing your look";
    createSuggestion({
      actionType: "purchase" as ActionType,
      amount: "< 5 cUSD",
      description: `I noticed: "${contextSnippet}" — this ${itemType} could complete the look`,
    }).catch(() => {});
  }, [reasoning, isConnected, createSuggestion, canCreateSuggestion]);

  // ── Personalized recommendations fetch ──
  useEffect(() => {
    if (!isConnected || recommendationsFetchedRef.current) return;

    const sessionAge = Date.now() - sessionStartTimeRef.current;
    if (sessionAge < SUGGESTION_COOLDOWN_MS * 2) return;

    recommendationsFetchedRef.current = true;

    fetch("/api/agent/style?limit=1")
      .then((res) => res.json())
      .then((data) => {
        const rec = data.recommendations?.[0];
        if (!rec) return;
        if (!canCreateSuggestion(rec.category)) return;

        const cat = data.preferences?.categories?.[0] || rec.category;
        createSuggestion({
          actionType: "purchase" as ActionType,
          amount: `$${rec.price} cUSD`,
          description: `Based on your ${cat} preference: ${rec.name} — ${rec.description}`,
        }).catch(() => {});
      })
      .catch(() => {});
  }, [isConnected, createSuggestion, canCreateSuggestion]);

  // ── Capture logic ──
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || isCapturing) return;
    if (isVenice && captures.length >= VENICE_FREE_CAPTURES) return;

    try {
      setIsCapturing(true);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);

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
          if (count <= 3) playBeep(880);
          else if (count % 2 === 0) playBeep(440);
          setCountdown(count);
        } else {
          clearInterval(interval);
          playBeep(1760);
          setCountdown(null);
          handleCapture();
        }
      }, 1000);
      playBeep(440);
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

  // ── Session actions ──
  const handleFinish = useCallback(async () => {
    setSessionEndedManually(true);
    setFinalAdvice(
      liveAiResponse ||
        "Great session! You've got a solid handle on your personal style.",
    );
    setShowSummary(true);

    // Track session completion for missions
    try {
      const userId = "user-" + Date.now(); // In production, use actual user ID
      MissionService.updateMissionProgress(userId, "session-complete", {
        persona: selectedPersona || undefined,
        score: sessionSummary?.score,
      });

      // Track persona usage if applicable
      if (selectedPersona) {
        MissionService.updateMissionProgress(userId, "persona-used", {
          persona: selectedPersona,
        });
      }
    } catch (err) {
      console.error("Mission tracking error:", err);
    }

    stopSession();
  }, [liveAiResponse, stopSession, selectedPersona, sessionSummary]);

  const startSession = useCallback(
    async (goal: SessionGoal, apiKey?: string, persona?: string) => {
      setSessionGoal(goal);
      if (persona) setSelectedPersona(persona);
      await providerStartSession(
        goal ?? undefined,
        apiKey || undefined,
        persona || undefined,
      );
    },
    [providerStartSession],
  );

  // ── Derived ──
  const hasCaptures = captures.length > 0;
  const selectedCapture = hasCaptures ? captures[selectedCaptureIndex] : null;
  const isCritique = sessionGoal === "critique";

  // ── Return ──
  return {
    // Provider
    selectedProvider,
    setSelectedProvider,
    activeProvider,

    // Session
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
    error,
    videoRef,
    startSession,
    stopSession,
    handleFinish,
    transcript,
    liveAiResponse,
    reasoning,
    agentEvents,
    sessionSummary,
    positionStatus,
    isCritique,

    // Captures
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
    uploadedData,
    setUploadedData,
    capturesRemaining,
    capturesExhausted,
    maxCaptures,

    // Session limits
    sessionTimeRemaining,
    sessionExpired,
    isVenice,

    // Activities
    activities,
    coachingBadges,

    // UI toggles
    terminalExpanded,
    setTerminalExpanded,
    isVoiceEnabled,
    setIsVoiceEnabled,

    // Payment
    userApiKey,
    setUserApiKey,
    showByokInput,
    setShowByokInput,
    geminiPaymentToken,
    setGeminiPaymentToken,
    showPaymentSuccess,
    setShowPaymentSuccess,

    // Suggestions
    suggestions,
    currentSuggestion,
    handleAcceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,

    // Approval
    currentApproval,
    isApprovalModalOpen,
    setIsApprovalModalOpen,
    approveRequest,
    rejectRequest,
  };
}
