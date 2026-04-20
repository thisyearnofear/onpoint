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

export interface SessionFeedback {
  text: string;
  timestamp: number;
  type: "praise" | "critique" | "suggestion" | "observation";
}

export interface SessionSummary {
  score: number;
  topics: string[];
  takeaways: string[];
  fullFeedback: SessionFeedback[];
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
  // Initialize from localStorage (DRY - single source of truth for preference)
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    () => {
      if (typeof window === "undefined") return null;
      const saved = localStorage.getItem("onpoint_preferred_provider");
      return saved === "venice" || saved === "gemini" ? saved : null;
    },
  );

  // Persist provider preference
  const handleSetProvider = (provider: AIProvider | null) => {
    setSelectedProvider(provider);
    if (provider) {
      localStorage.setItem("onpoint_preferred_provider", provider);
    } else {
      localStorage.removeItem("onpoint_preferred_provider");
    }
  };
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
  const [captureToast, setCaptureToast] = useState<string | null>(null);

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
  const isAnalyzing = isVenice ? (venice as any).isAnalyzing ?? false : false;

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
  const sessionUserIdRef = useRef<string>("");

  // ── Session start tracking ──
  useEffect(() => {
    if (isConnected && sessionStartTimeRef.current === 0) {
      sessionStartTimeRef.current = Date.now();
      sessionUserIdRef.current = "user-" + Date.now();

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
        }).catch(console.error);
      }

      // Get contextual prompt from StyleContextStore for cross-feature continuity
      StyleContextStore.getContextualPrompt(sessionUserIdRef.current)
        .then((prompt) => {
          if (prompt) {
            console.log("Style context loaded:", prompt);
          }
        })
        .catch(console.error);
    }
    if (!isConnected) {
      sessionStartTimeRef.current = 0;
      sessionUserIdRef.current = "";
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

    // ── Classify each reasoning entry ──
    const classifyEntry = (text: string): SessionFeedback["type"] => {
      const lower = text.toLowerCase();
      const hasSuggestion =
        /replace|swap|switch|opt for|try instead|consider|would work better|recommend|suggest/.test(
          lower,
        );
      const hasCritique =
        /avoid|not working|clash|off|wrong|too tight|too loose|mismatch|distract|overpower|remove|change/.test(
          lower,
        );
      const hasPraise =
        /good|great|sharp|excellent|love|perfect|solid|flattering|on point|working well|strong look/.test(
          lower,
        );

      if (hasSuggestion) return "suggestion";
      if (hasCritique && !hasPraise) return "critique";
      if (hasPraise && !hasCritique) return "praise";
      return "observation";
    };

    const feedbackEntries: SessionFeedback[] = reasoning.map((r) => ({
      text: r.replace(/^["\s]+|["\s]+$/g, ""),
      timestamp: Date.now(),
      type: classifyEntry(r),
    }));

    if (finalAdvice) {
      feedbackEntries.push({
        text: finalAdvice.replace(/^["\s]+|["\s]+$/g, ""),
        timestamp: Date.now(),
        type: classifyEntry(finalAdvice),
      });
    }

    const fullFeedback = feedbackEntries;

    // ── Score based on classified feedback ──
    const praiseCount = fullFeedback.filter((f) => f.type === "praise").length;
    const critiqueCount = fullFeedback.filter(
      (f) => f.type === "critique",
    ).length;
    const suggestionCount = fullFeedback.filter(
      (f) => f.type === "suggestion",
    ).length;
    const totalClassified = praiseCount + critiqueCount + suggestionCount;

    const isCritique = sessionGoal === "critique";
    const base = isCritique ? 5 : 7;

    let score: number;
    if (totalClassified === 0) {
      score = base;
    } else {
      // Suggestions imply the current outfit needs improvement → reduce score
      // Praise raises score, critiques lower it
      const praiseRatio = praiseCount / totalClassified;
      const critiqueRatio =
        (critiqueCount + suggestionCount * 0.7) / totalClassified;
      const sentimentBonus = praiseRatio * 3 - critiqueRatio * 2.5;
      score = Math.min(10, Math.max(1, Math.round(base + sentimentBonus)));
    }

    // ── Topic detection ──
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

    // ── Takeaways: prioritize suggestions > critiques > praise > observations ──
    const prioritized = [...fullFeedback]
      .filter((f) => f.text.length > 12 && f.text.length < 200)
      .sort((a, b) => {
        const order: Record<string, number> = {
          suggestion: 0,
          critique: 1,
          praise: 2,
          observation: 3,
        };
        return (order[a.type] ?? 3) - (order[b.type] ?? 3);
      });

    const takeaways = prioritized.slice(0, 5).map((f) => f.text);

    // Pick 3 product recommendations (deterministic per session via content hash)
    const seed = allText.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = [...CANVAS_ITEMS]
      .map((item, i) => ({
        item,
        sort: (seed * (i + 1) * 2654435761) % CANVAS_ITEMS.length,
      }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.item);
    const recommendations = shuffled.slice(0, 3).map((p) => ({
      name: p.name,
      price: p.price,
      category: p.category,
    }));

    return {
      score,
      topics: topics.slice(0, 4),
      takeaways,
      fullFeedback,
      recommendations,
    };
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
      StyleContextStore.recordStyleAnalysis(sessionUserIdRef.current, {
        source: "live-ar",
        type: "recommendation",
        content: latest,
        metadata: {
          persona: selectedPersona || undefined,
          score: sessionSummary?.score,
          timestamp: Date.now(),
        },
      }).catch(console.error);
    }
  }, [reasoning, selectedPersona, sessionSummary]);

  // ── Voice synthesis (persona-aware) ──
  useEffect(() => {
    if (liveAiResponse?.trim() && isVoiceEnabled && selectedPersona) {
      PersonaVoice.speakAsPersona(liveAiResponse, selectedPersona).catch(
        console.error,
      );
    }
  }, [liveAiResponse, isVoiceEnabled, selectedPersona]);

  // ── Accept suggestion handler ──
  const handleAcceptSuggestion = useCallback(
    async (id: string) => {
      await acceptSuggestion(id);

      const userId = sessionUserIdRef.current;

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
        amount: "~$0.50",
        description: `Style Score is Elite (${sessionSummary.score}/10). Mint this Proof of Style to Celo?`,
      }).catch(console.error);
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

    const [keyword, itemType] = matchedType;
    if (!canCreateSuggestion(itemType)) return;

    // Check if we have a match in internal catalog
    const internalMatch = CANVAS_ITEMS.find(
      (item) =>
        latest.includes(item.name.toLowerCase()) ||
        latest.includes(item.category.toLowerCase()),
    );

    if (internalMatch) {
      const contextSnippet =
        reasoning[0]?.slice(0, 80) || "analyzing your look";
      createSuggestion({
        actionType: "purchase" as ActionType,
        amount: `$${internalMatch.price}`,
        description: `Matching internal catalog: "${internalMatch.name}" — ${internalMatch.description}`,
      }).catch(console.error);
    } else {
      // No internal match? Trigger the Web Agent!
      console.log(
        `[WebAgent] No internal match for ${itemType}. Triggering web discovery...`,
      );

      const contextSnippet =
        reasoning[0]?.slice(0, 80) || "analyzing your look";

      // 1. Create a "Searching" suggestion first
      createSuggestion({
        actionType: "external_search" as ActionType,
        amount: "Searching Web...",
        description: `I observed: "${contextSnippet}". Browsing live stores for ${itemType}...`,
        isSearching: true,
      })
        .then(async (data) => {
          const suggestionId = data.suggestion.id;

          // 2. Dispatch to the bridge
          const result = await fetch("/api/agent/purchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: sessionUserIdRef.current,
              actionType: "external_search",
              query: latest,
              suggestionId, // To update the status later
            }),
          });
        })
        .catch(console.error);
    }
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
          amount: `$${rec.price}`,
          description: `Based on your ${cat} preference: ${rec.name} — ${rec.description}`,
        }).catch(console.error);
      })
      .catch(console.error);
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

        // Show capture confirmation toast
        const captureCount = captures.length + 1;
        const maxLabel = isVenice ? `${VENICE_FREE_CAPTURES}` : "∞";
        setCaptureToast(`Capture saved! (${captureCount}/${maxLabel})`);
        setTimeout(() => setCaptureToast(null), 2000);
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

    // Mark first session done so returning users see dashboard
    if (typeof window !== "undefined") {
      localStorage.setItem("onpoint-first-session-done", "true");
    }

    // Send style report email (fire-and-forget)
    if (sessionSummary?.score && sessionSummary.takeaways.length > 0) {
      fetch("/api/auth/style-report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: sessionSummary.score,
          takeaways: sessionSummary.takeaways,
        }),
      }).catch(() => {});
    }

    // Track session completion for missions
    try {
      const userId = sessionUserIdRef.current;
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
    setSelectedProvider: handleSetProvider,
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
    isAnalyzing,
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
    captureToast,
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
