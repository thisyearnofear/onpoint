"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Palette,
  Sparkles,
  ArrowRight,
  Check,
  Camera,
  FlaskConical,
  Store,
  X,
  Play,
  ChevronRight,
  Download,
  Share2,
  Shirt,
  Wand2,
  Lock,
  Crown,
  Flame,
  Heart,
  Scale,
  Ruler,
} from "lucide-react";
import { Reveal } from "../components/ui/Reveal";
import { ThemeToggle } from "../components/ThemeToggle";
import { Auth0HeaderButton } from "../components/auth/Auth0Components";
import { EnhancedConnectButton } from "../components/EnhancedConnectButton";
import { NotificationBell } from "../components/NotificationBell";
import { LiveCounter } from "../components/LiveCounter";
import { Button } from "@repo/ui/button";
import { PersonaAvatar } from "../components/ui/PersonaAvatar";
import { getPersonaConfig, PREMIUM_PERSONAS, isPersonaUnlocked } from "../lib/utils/persona-config";
import { usePremiumStatus } from "../hooks/use-premium-status";
import type { StylistPersona, CritiqueMode } from "@repo/ai-client";
import { useAnalysisHistory } from "../lib/stores/analysis-history-store";
import { trackRecentlySavedClicked } from "../lib/utils/analytics";
import { useScoreProgression } from "../lib/hooks/useScoreProgression";
import { useUserPreferences } from "../hooks/useUserPreferences";
import {
  BODY_TYPES,
  OCCASIONS,
  VIBES,
  VIBE_IMAGES,
  VIBE_PALETTES,
  OCCASION_VIBE_SYNERGY,
  OCCASION_PALETTES,
  OCCASION_DISPLAY_LABELS,
  BUDGET_TIERS,
} from "../lib/utils/style-constants";
import type { BodyType, BudgetTier } from "../lib/utils/style-constants";
import { captureReferralFromURL } from "../lib/utils/referral";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl hidden md:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
                <Palette className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight">
                BeOnPoint
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/curator"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-[background-color,transform,color] px-3 py-1.5 rounded-full"
            >
              <Store className="w-4 h-4" />
              Curators
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-[background-color,transform,color] px-3 py-1.5 rounded-full"
            >
              <FlaskConical className="w-4 h-4" />
              Lab
            </Link>
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-[background-color,transform,color] px-3 py-1.5 rounded-full"
            >
              Guides
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-[background-color,transform,color] px-3 py-1.5 rounded-full"
            >
              About
            </Link>
            <NotificationBell />
            <EnhancedConnectButton className="hidden lg:flex" />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">BeOnPoint</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell direction="up" />
            <EnhancedConnectButton />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <HeroView />
    </div>
  );
}

function PersonaCarousel() {
  const [selectedPersona, setSelectedPersona] = useState<StylistPersona | null>(null);
  const { isPremium } = usePremiumStatus();
  const personas: StylistPersona[] = ["miranda", "edina", "shaft", "luxury", "streetwear", "sustainable"];
  const personaNames: Record<string, string> = {
    miranda: "Miranda Priestly",
    edina: "Edina Monsoon",
    shaft: "John Shaft",
    luxury: "Anna Wintour",
    streetwear: "Virgil Abloh",
    sustainable: "Stella McCartney",
  };
  return (
    <>
      <div className="flex flex-wrap justify-center lg:justify-start gap-3 pt-2">
        {personas.map((p) => {
          const config = getPersonaConfig(p);
          const PersonaIcon = config.icon;
          const locked = !isPersonaUnlocked(p, isPremium);
          return (
            <button
              key={p}
              onClick={() => setSelectedPersona(p)}
              className="group relative flex flex-col items-center gap-1 active:scale-[0.95] transition-transform"
            >
              <PersonaAvatar persona={p} size="sm" animate="idle" />
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 backdrop-blur-[1px]">
                  <Lock className="w-3 h-3 text-muted-foreground/70" />
                </div>
              )}
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {personaNames[p]}
                {locked && <Lock className="w-2.5 h-2.5 inline ml-1" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Meet the Stylist Modal */}
      {selectedPersona && (
        <PersonaMeetModal
          persona={selectedPersona}
          isPremium={isPremium}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </>
  );
}

function PersonaMeetModal({
  persona,
  isPremium,
  onClose,
}: {
  persona: StylistPersona;
  isPremium: boolean;
  onClose: () => void;
}) {
  const config = getPersonaConfig(persona);
  const PersonaIcon = config.icon;
  const locked = !isPersonaUnlocked(persona, isPremium);

  const sampleCritiques: Record<string, string> = {
    miranda: "The structure is passable. The silhouette flatters your frame, but that color choice is three seasons stale. We can work with the proportions, but let's elevate the palette.",
    edina: "Darling! It's a look! The shape is absolutely fabulous, but that fabric? Sweetie, no. We need texture, we need drama, we need PEOPLE TO TURN THEIR HEADS!",
    shaft: "Right on. You've got the basics down — clean lines, good fit. But let's take it up a notch. A little more edge, a little more attitude. You feel me?",
    luxury: "Exquisite bone structure. The garment shows promise but lacks refinement. I'd suggest investing in quality fabrics and timeless silhouettes. Luxury is in the details.",
    streetwear: "Fresh. The silhouette is on point but the execution needs work. We're talking layered textures, statement accessories, and that effortless 'I didn't try' vibe.",
    sustainable: "Lovely to see natural fibers. The piece has potential but let's think about longevity — can you wear this 30 ways? Can it be repaired, reused, reimagined?",
  };

  const sampleScore: Record<string, number> = {
    miranda: 7,
    edina: 7,
    shaft: 8,
    luxury: 7,
    streetwear: 8,
    sustainable: 8,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Meet ${config.characterName}`}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${config.gradient} p-6 text-center`}>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/20 p-1.5 text-white/70 hover:text-white active:bg-black/30 active:scale-[0.95] transition-[background-color,transform,color]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 shadow-lg">
            <PersonaIcon className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-black text-white">{config.characterName}</h3>
          <p className="mt-1 text-xs text-white/80">{config.description}</p>
          <span className={`mt-2 inline-block rounded-full ${config.bg} px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.lightColor}`}>
            {config.mode} critic • {config.tier === "free" ? "Free" : "Premium"}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Sample critique */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sample analysis
              </span>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 border border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-primary">{sampleScore[persona]}/10</span>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  &ldquo;{sampleCritiques[persona]}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Stylist mode badge */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground border border-border">
              Mode: {config.mode}
            </span>
            <span className={`rounded-full ${config.bg} px-2 py-0.5 text-[10px] ${config.lightColor} border ${config.border}`}>
              {config.layoutStyle} style
            </span>
          </div>

          {/* CTA */}
          {locked ? (
            <Link
              href="/pricing"
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              <Crown className="h-4 w-4" />
              Upgrade to unlock {config.characterName.split(" ")[0]}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/lab?tab=try-on&persona=${persona}`}
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
            >
              <Camera className="h-4 w-4" />
              Try {config.characterName.split(" ")[0]} as your stylist
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeBackBanner() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const latest = sessions[0];
  const { totalLooks, bestScore, trend, daysSinceLastLook } = useScoreProgression();

  if (!latest) return null;

  const now = Date.now();
  const created = new Date(latest.createdAt).getTime();
  const hoursAgo = Math.floor((now - created) / 3600000);
  const daysAgo = Math.floor(hoursAgo / 24);
  let timeAgo: string;
  if (hoursAgo < 1) timeAgo = "just now";
  else if (hoursAgo < 24) timeAgo = `${hoursAgo}h ago`;
  else if (daysAgo < 7) timeAgo = `${daysAgo}d ago`;
  else timeAgo = new Date(latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const isStale = daysSinceLastLook !== null && daysSinceLastLook >= 7;
  const trendLabel = trend === "improving" ? "Your scores are trending up" : trend === "declining" ? "Time to try a new stylist?" : null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            {isStale ? "It's been a while — your style skills are waiting" : "Welcome back!"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last analysis {timeAgo} — <span className="font-semibold text-primary">{latest.score}/10</span>
            {latest.persona && <>, styled by <span className="capitalize font-medium">{latest.persona}</span></>}
            {totalLooks > 1 && <> · {totalLooks} looks{bestScore ? `, best: ${bestScore}/10` : ""}</>}
          </p>
          {trendLabel && (
            <p className="mt-0.5 text-[11px] font-medium text-primary">{trendLabel}</p>
          )}
        </div>
        <Link
          href="/lab?tab=my-looks"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
        >
          View looks
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function DemoToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98]"
    >
      <Play className="h-4 w-4" />
      See how it works
    </button>
  );
}

function DemoWalkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = [
    {
      title: "Upload your photo",
      description: "Snap a photo or upload one from your gallery. OnPoint analyzes your outfit in seconds.",
      image: "/assets/1Model.png",
      badge: "1. Upload",
      stat: null,
    },
    {
      title: "AI analyzes your style",
      description: "Our AI stylists read your silhouette, color palette, and fit. Get a detailed score and personalized feedback.",
      image: "/assets/2Model.png",
      badge: "2. AI Analysis",
      stat: { label: "Score", value: "8/10" },
    },
    {
      title: "Save & share your look",
      description: "Save to My Looks, share a polaroid-style card to Farcaster or Twitter, or email yourself the full report.",
      image: "/assets/3Model.png",
      badge: "3. Share",
      stat: { label: "Shared", value: "1.2K" },
    },
  ];

  const advance = useCallback(() => {
    setStep((prev) => {
      if (prev >= steps.length - 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length]);

  useEffect(() => {
    intervalRef.current = setInterval(advance, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [advance]);

  const current = steps[step]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How it works"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white/70 hover:text-white active:bg-black/30 active:scale-[0.95] transition-[background-color,transform,color]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image area */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
          <Image
            src={current.image}
            alt={current.title}
            fill
            className="object-cover opacity-80 transition-all duration-700"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* Step badge */}
          <div className="absolute bottom-4 left-4 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
            {current.badge}
          </div>

          {/* Stat badge */}
          {current.stat && (
            <div className="absolute bottom-4 right-4 rounded-xl bg-black/70 px-3 py-2 text-center backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wider text-white/60">{current.stat.label}</p>
              <p className="text-lg font-black text-white">{current.stat.value}</p>
            </div>
          )}

          {/* Step dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setStep(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 active:scale-y-[1.5] ${
                  i === step ? "w-6 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{current.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Step {step + 1} of {steps.length}
            </div>
            <div className="flex gap-2">
              {step < steps.length - 1 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    advance();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
                >
                  Next
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <Link
                  href="/lab"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Try it free
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PERSONA_QUOTES: Record<string, string> = {
  miranda: "Passable.",
  edina: "Fabulous!",
  shaft: "Right on.",
  luxury: "Exquisite.",
  streetwear: "Fresh.",
  sustainable: "Thoughtful.",
};

function PersonaChip({ persona }: { persona: StylistPersona }) {
  const config = getPersonaConfig(persona);
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} border ${config.border} px-2.5 py-1 transition-all duration-500`}>
      <Icon className={`h-3 w-3 ${config.text}`} />
      <span className="text-[10px] font-bold text-foreground">
        {config.characterName.split(" ")[0]}:
      </span>
      <span className={`text-[10px] font-medium ${config.text}`}>
        &ldquo;{PERSONA_QUOTES[persona]}&rdquo;
      </span>
    </div>
  );
}

function HeroVisual() {
  const [step, setStep] = useState(0);
  const cyclingPersonas: StylistPersona[] = ["miranda", "edina", "shaft", "luxury", "streetwear"];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 5), 5000);
    return () => clearInterval(id);
  }, []);

  const steps = [
    {
      mainImage: "/assets/1Model.png",
      mainLabel: "1. Upload Your Look",
      grid: [
        {
          type: "text" as const,
          title: "SNAP & ANALYZE",
          lines: ["Take a photo", "AI scans instantly", "Any outfit works"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/1Product.png",
          label: "Detected items",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/2Model.png",
      mainLabel: "2. AI Reads Your Style",
      grid: [
        {
          type: "text" as const,
          title: "STYLE SCORE",
          lines: ["Color harmony: 8/10", "Fit: 9/10", "Silhouette: 7/10"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/2Product.png",
          label: "Palette match",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/3Model.png",
      mainLabel: "3. Get Your Verdict",
      grid: [
        {
          type: "text" as const,
          title: "CRITIQUE",
          lines: ["Strong proportions", "Elevate accessories", "Great layering"],
          color: "accent",
        },
        {
          type: "image" as const,
          image: "/assets/3Product.png",
          label: "Suggested fix",
          color: "primary",
        },
      ],
    },
    {
      mainImage: "/assets/1Product.png",
      mainLabel: "4. Agent Finds Matches",
      grid: [
        {
          type: "text" as const,
          title: "SHOPPING",
          lines: ["3 items found", "Within budget", "Ready to buy"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/2Model.png",
          label: "Best match",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/2Product.png",
      mainLabel: "5. Share Your Look",
      grid: [
        {
          type: "text" as const,
          title: "SHARE",
          lines: ["Polaroid card", "Farcaster cast", "Download PNG"],
          color: "accent",
        },
        {
          type: "image" as const,
          image: "/assets/3Model.png",
          label: "Your style",
          color: "primary",
        },
      ],
    },
  ];

  const current = steps[step]!;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] shadow-xl shadow-primary/10 p-6">
      <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold shadow-sm flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        AI Vision
      </div>

      <div className="absolute top-4 right-4 z-10">
        <PersonaChip persona={cyclingPersonas[step % cyclingPersonas.length]!} />
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={`main-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            <Image
              src={current.mainImage}
              alt={current.mainLabel}
              fill
              className="object-cover opacity-90"
              unoptimized
            />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/90 text-[10px] font-bold">
              {current.mainLabel}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={`grid-left-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.05, ease: "easeInOut" }}
              className="relative aspect-square rounded-lg overflow-hidden border border-primary/20 bg-primary/5"
            >
              {current.grid[0]!.type === "text" && (
                <div className="p-3 space-y-1">
                  <div className="text-[10px] font-bold text-primary">
                    {current.grid[0]!.title}
                  </div>
                  {current.grid[0]!.lines.map((line, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`grid-right-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeInOut" }}
              className="relative aspect-square rounded-lg overflow-hidden border"
              style={{ borderColor: `hsl(var(--${current.grid[1]!.color}) / 0.2)` }}
            >
              {current.grid[1]!.type === "image" && (
                <>
                  <Image
                    src={current.grid[1]!.image}
                    alt={current.grid[1]!.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div
                    className="absolute bottom-2 left-2 px-2 py-1 rounded text-white text-[10px] font-bold"
                    style={{ backgroundColor: `hsl(var(--${current.grid[1]!.color}) / 0.9)` }}
                  >
                    {current.grid[1]!.label}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-4 bg-primary" : "w-1.5 bg-primary/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}



/** Mode-aware critiques per persona — each mode gets 4+ entries for variety */
const PERSONA_CRITIQUES: Record<string, Record<string, string[]>> = {
  miranda: {
    real: [
      "The silhouette is acceptable, but the palette shows promise. Refine the accessories.",
      "Interesting proportions. The layering works — keep pushing the boundaries.",
      "A solid foundation. Now elevate it with one unexpected detail. The potential is there.",
      "Strong composition. The fit flatters your frame. Consider a bolder silhouette for impact.",
      "Clean lines, intentional palette. This works. Now edit one element for maximum effect.",
    ],
    roast: [
      "Did you dress in the dark? The proportions are at war with each other. Pick a lane.",
      "That hem length suggests you simply don't care. I'd suggest you start.",
      "The palette is screaming. Tell it to use its indoor voice. We can salvage this.",
      "This is... a choice. Not a good one, but a choice nonetheless. Let's rebuild from the shoes up.",
    ],
    flatter: [
      "You clearly understand proportion. The silhouette is working beautifully for you.",
      "There's real intelligence in this composition. You have a natural eye for balance.",
      "The palette is considered and cohesive. This is someone who knows what they're doing.",
      "Strong foundation with room to play. You've earned the right to experiment more.",
    ],
  },
  edina: {
    real: [
      "Darling, this is STUNNING. The colors are singing! Just add more drama!",
      "Oh honey, YES! This turns heads. Now make it louder — MORE IS MORE!",
      "Fabulous doesn't even cover it! The vibe is immaculate. Add sparkle!",
      "You've got the base right, sweetie, but where's the EXCITEMENT? Textures! Layers!",
      "I'm getting there with this look. It needs a STATEMENT piece to push it over the top.",
    ],
    roast: [
      "Sweetie, no. Just... no. This is giving 'I gave up.' And I REFUSE to accept that!",
      "Oh honey. The 80s called and they want their outfit back. Burn it. Start over.",
      "This is a CRIME against fashion, darling! We need an intervention, stat!",
      "Budget. BUDGET, sweetie! This look screams 'I raided a charity bin in the dark.'",
    ],
    flatter: [
      "ABSOLUTELY FABULOUS! You look like a million bucks, darling! MEGA-WOW!",
      "Yes yes YES! This is the energy we need! You are a STYLE ICON in the making!",
      "Darling, you've got IT! That special something! Now let's turn it up to ELEVEN!",
      "I am OBSESSED with this look! The confidence, the attitude, the VISION!",
    ],
  },
  shaft: {
    real: [
      "Clean. Confident. You look like you own the room. Keep it sharp.",
      "That's what I'm talking about. Strong look, strong energy. Stay bold.",
      "Right on. This has swagger written all over it. Wear it like you mean it.",
      "Solid look. The proportions work. Now own it like you knew it would.",
      "Clean execution. The details are right where they should be. Respect.",
    ],
    roast: [
      "Nah. That's not it. You're better than this — try again.",
      "That fit is doing you dirty. Size up, size down, but fix it.",
      "You're trying too hard. Real style doesn't try. It just IS.",
      "Lose the accessories. All of them. You look like you're cosplaying.",
    ],
    flatter: [
      "Now THAT'S what I'm talking about. Clean, sharp, confident. You got it.",
      "Right on. This is a look that says 'I know who I am.' Respect.",
      "Clean. You look like you walked out of a magazine. Keep that energy.",
      "That's how you do it. Strong choices, strong execution. You're on fire.",
    ],
  },
};

function LookCrafter() {
  const [phase, setPhase] = useState<"choose" | "generating" | "result">("choose");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [vibe, setVibe] = useState<string | null>(null);
  const [persona, setPersona] = useState<StylistPersona | null>(null);
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [critiqueMode, setCritiqueMode] = useState<CritiqueMode>("real");
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null);
  const [result, setResult] = useState<{ image: string; score: number; critique: string; palette: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Wire up user preferences — pre-fill body type and budget tier from saved preferences
  const { preferences, updatePreferencesWithSync } = useUserPreferences();
  useEffect(() => {
    if (preferences?.bodyType && !bodyType) {
      setBodyType(preferences.bodyType as BodyType);
    }
    if (preferences?.budgetTier && !budgetTier) {
      setBudgetTier(preferences.budgetTier as BudgetTier);
    }
  }, [preferences, bodyType, budgetTier]);

  const occasions = OCCASIONS;
  const vibes = VIBES;

  const freePersonas: { id: StylistPersona; name: string; emoji: string }[] = [
    { id: "miranda", name: "Miranda", emoji: "⭐" },
    { id: "edina", name: "Edina", emoji: "✨" },
    { id: "shaft", name: "Shaft", emoji: "💬" },
  ];

  const canGenerate = occasion && vibe && persona;

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    setPhase("generating");

    // 1. Compute pre-canned result instantly (always available, no API dependency)
    const buildCannedResult = () => {
      const synergy = OCCASION_VIBE_SYNERGY[occasion!]?.[vibe!] || [7, 8];
      const baseScore = synergy[0] + Math.floor(Math.random() * (synergy[1] - synergy[0] + 1));
      const variance = bodyType ? Math.floor(Math.random() * 3) - 1 : 0;
      const score = Math.max(1, Math.min(10, baseScore + variance));
      const palette = OCCASION_PALETTES[occasion!]?.[vibe!] || VIBE_PALETTES[vibe!] || VIBE_PALETTES.minimalist!;
      const image = VIBE_IMAGES[vibe!] || "/assets/1Model.png";
      const modeCritiques = PERSONA_CRITIQUES[persona!]?.[critiqueMode];
      const fallbackCritiques = PERSONA_CRITIQUES[persona!]?.real;
      const critiquePool = modeCritiques || fallbackCritiques || PERSONA_CRITIQUES.edina!.real!;
      const critique = critiquePool[Math.floor(Math.random() * critiquePool.length)]!;
      return { image, score, critique, palette };
    };

    // Show pre-canned result immediately
    const canned = buildCannedResult();
    setResult(canned);
    setPhase("result");

    // 2. Progressive enhancement: try AI-generated critique in background
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    fetch("/api/ai/look-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occasion: occasion!,
        vibe: vibe!,
        persona: persona!,
        bodyType,
        critiqueMode,
        budgetTier,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.critique && data.score) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  score: data.score,
                  critique: data.critique,
                }
              : prev,
          );
        }
      })
      .catch(() => {
        // Silently fall back to pre-canned — already shown
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
  }, [occasion, vibe, persona, bodyType, critiqueMode, canGenerate]);

  const handleBodyTypeSelect = (bt: BodyType) => {
    setBodyType(bt);
    updatePreferencesWithSync({ bodyType: bt });
  };

  const handleBudgetTierSelect = (bt: BudgetTier) => {
    setBudgetTier(bt);
    updatePreferencesWithSync({ budgetTier: bt });
  };

  const handleReset = () => {
    setPhase("choose");
    setOccasion(null);
    setVibe(null);
    setPersona(null);
    setBodyType(null);
    setBudgetTier(null);
    setCritiqueMode("real");
    setResult(null);
    setCopied(false);
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const isDark = document.documentElement.classList.contains("dark");
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: isDark ? "#0f0f13" : "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = "my-onpoint-look.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleShare = async () => {
    const personaName = getPersonaConfig(persona!).characterName.split(" ")[0];
    const occasionLabel = OCCASION_DISPLAY_LABELS[occasion!] || occasion!;
    const text = `${personaName} rated my ${occasionLabel} look ${result?.score}/10 and said "${result?.critique.slice(0, 60)}..." — what would ${personaName} say about yours?`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
    if (navigator.share) {
      navigator.share({ title: "My OnPoint Look", text, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.04),transparent_60%)]">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Reveal>
          <div className="max-w-2xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-medium text-accent mb-4">
              <Wand2 className="w-3.5 h-3.5" />
              Interactive Preview
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              Craft a look, get your score
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a vibe, choose your AI stylist, and get a shareable look card — no sign-up needed.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="max-w-lg mx-auto rounded-2xl border border-border/40 bg-gradient-to-br from-background via-background to-primary/[0.03] shadow-lg shadow-primary/5 overflow-hidden">
            {phase === "choose" && (
              <div className="p-6 space-y-5">
                {/* 1. Body Type */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    1. Your body type
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {BODY_TYPES.map((bt) => (
                      <button
                        key={bt.id}
                        onClick={() => handleBodyTypeSelect(bt.id)}
                        className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-[10px] font-medium transition-all active:scale-[0.95] ${
                          bodyType === bt.id
                            ? "bg-primary/10 border border-primary text-primary shadow-sm"
                            : "bg-muted/50 border border-transparent text-muted-foreground hover:bg-muted active:bg-muted/80"
                        }`}
                      >
                        <span className="text-base">{bt.emoji}</span>
                        <span className="leading-tight">{bt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Occasion */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    2. Pick the occasion
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {occasions.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setOccasion(o.id)}
                        className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-medium transition-all active:scale-[0.95] ${
                          occasion === o.id
                            ? "bg-primary/10 border-2 border-primary text-primary shadow-sm"
                            : "bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted active:bg-muted/80"
                        }`}
                      >
                        <span className="text-lg">{o.emoji}</span>
                        <span>{o.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Vibe */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    3. Pick your vibe
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {vibes.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVibe(v.id)}
                        className={`rounded-xl p-2.5 text-xs font-medium transition-all active:scale-[0.95] ${
                          vibe === v.id
                            ? "bg-primary/10 border-2 border-primary text-primary shadow-sm"
                            : "bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted active:bg-muted/80"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Budget */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    4. Budget range
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {BUDGET_TIERS.map((bt) => (
                      <button
                        key={bt.id}
                        onClick={() => handleBudgetTierSelect(bt.id)}
                        className={`flex flex-col items-center gap-0.5 rounded-xl p-2.5 text-xs font-medium transition-all active:scale-[0.95] ${
                          budgetTier === bt.id
                            ? "bg-primary/10 border-2 border-primary text-primary shadow-sm"
                            : "bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted active:bg-muted/80"
                        }`}
                      >
                        <span className="text-base">{bt.emoji}</span>
                        <span>{bt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Critique Mode */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    5. Critique style
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: "real" as CritiqueMode, label: "Real", icon: Scale, color: "text-blue-500" },
                      { id: "roast" as CritiqueMode, label: "Roast", icon: Flame, color: "text-red-500" },
                      { id: "flatter" as CritiqueMode, label: "Flatter", icon: Heart, color: "text-pink-500" },
                    ]).map((mode) => {
                      const ModeIcon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setCritiqueMode(mode.id)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-medium transition-all active:scale-[0.95] ${
                            critiqueMode === mode.id
                              ? "bg-primary/10 border-2 border-primary text-primary shadow-sm"
                              : "bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted active:bg-muted/80"
                          }`}
                        >
                          <ModeIcon className={`w-3.5 h-3.5 ${mode.color}`} />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Stylist */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    6. Choose your stylist
                  </p>
                  <div className="flex gap-3 justify-center">
                    {freePersonas.map((p) => {
                      const config = getPersonaConfig(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPersona(p.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all active:scale-[0.95] ${
                            persona === p.id
                              ? `${config.bg} border-2 ${config.border.replace("border-", "border-")} shadow-sm`
                              : "bg-muted/50 border-2 border-transparent hover:bg-muted active:bg-muted/80"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
                            {React.createElement(config.icon, { className: `w-5 h-5 ${config.text}` })}
                          </div>
                          <span className="text-[11px] font-medium">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-bold text-white transition-all hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate My Look
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {phase === "generating" && (
              <div className="p-12 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-primary animate-spin" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {getPersonaConfig(persona!).characterName} is styling your look...
                </p>
              </div>
            )}

            {phase === "result" && result && (
              <div className="p-6 space-y-4">
                {/* Polaroid card */}
                <div
                  ref={cardRef}
                  className="mx-auto max-w-[280px] bg-background rounded-lg shadow-[inset_0_2px_8px_hsl(var(--border)/0.3)] overflow-hidden -rotate-1 hover:rotate-0 transition-transform duration-500"
                >
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={result.image}
                      alt="Your crafted look"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm">
                      <div className="w-4 h-4 rounded-full bg-primary/80 flex items-center justify-center">
                        {React.createElement(getPersonaConfig(persona!).icon, { className: "w-2.5 h-2.5 text-white" })}
                      </div>
                      <span className="text-[11px] font-bold text-white">
                        {getPersonaConfig(persona!).characterName.split(" ")[0]}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-black text-white drop-shadow-lg">{result.score}/10</span>
                        <div className="flex gap-1">
                          {result.palette.map((color, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full border-2 border-white/50 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-background">
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                      &ldquo;{result.critique}&rdquo;
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-medium text-muted-foreground capitalize">
                        {occasion}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-medium text-muted-foreground capitalize">
                        {vibe}
                      </span>
                    </div>
                    <p className="text-fashion-label mt-2 text-center text-muted-foreground/40">
                      Crafted on BeOnPoint
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 active:scale-[0.98] transition-[background-color,transform]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 active:scale-[0.98] transition-[background-color,transform]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Share"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted active:bg-muted/80 active:scale-[0.98] transition-[background-color,transform]"
                  >
                    <Shirt className="w-3.5 h-3.5" />
                    New Look
                  </button>
                </div>

                {/* CTA to lab — secondary action, the hero CTA above is the primary */}
                <Link
                  href={`/lab?persona=${persona}`}
                  className="flex items-center justify-center gap-2 w-full rounded-full border border-border bg-transparent py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-[background-color,transform,color]"
                >
                  Try this look
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function EditorialStats() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const totalLooks = sessions.length;
  const avgScore = totalLooks > 0 ? (sessions.reduce((sum, s) => sum + s.score, 0) / totalLooks).toFixed(1) : null;
  const bestScore = totalLooks > 0 ? Math.max(...sessions.map((s) => s.score)) : null;

  const stats = [
    { value: "6", label: "AI stylists", suffix: "" },
    { value: avgScore || "8", label: "avg. score", suffix: "/10" },
    { value: totalLooks > 0 ? String(totalLooks) : "30", label: totalLooks > 0 ? "looks you've analyzed" : "seconds to first result", suffix: "" },
    { value: bestScore ? String(bestScore) : "0", label: totalLooks > 0 ? "your best score" : "platform fees", suffix: totalLooks > 0 ? "/10" : "", prefix: totalLooks > 0 ? "" : "$" },
  ];

  return (
    <section className="bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05),transparent_60%)]">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08}>
                <div className="text-center md:text-left">
                  <div className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                    {"prefix" in stat && stat.prefix}{stat.value}
                    {stat.suffix && <span className="text-primary">{stat.suffix}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroView() {
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    captureReferralFromURL();
  }, []);

  // Show the floating mobile CTA only when the hero CTA has scrolled out of view.
  // Default to `true` (visible) so the button stays hidden until the observer confirms
  // the hero CTA is offscreen — avoids a flash of the floating button on load.
  const heroCtaRef = React.useRef<HTMLDivElement | null>(null);
  const [heroCtaInView, setHeroCtaInView] = React.useState(true);
  React.useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setHeroCtaInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Welcome Back Banner */}
      <div className="container mx-auto px-4 pt-6">
        <WelcomeBackBanner />
      </div>

      {/* Demo Walkthrough */}
      {showDemo && <DemoWalkthrough onClose={() => setShowDemo(false)} />}

      <div className="relative container mx-auto px-4 py-12 md:py-20 lg:py-24 bg-gradient-to-b from-primary/[0.03] via-background to-background bg-[length:200%_200%] animate-gradient-shift">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left space-y-6">
              <Reveal delay={0}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>AI-Powered Fashion</span>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                  Your AI stylist
                  <span className="block text-primary">
                    sees, judges, shops.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.2}>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                  Point your camera at an outfit. Get instant AI feedback from a team of personality-driven stylists. Discover what works for your body and style.
                </p>
              </Reveal>

              <Reveal delay={0.3}>
                <div
                  ref={heroCtaRef}
                  className="flex flex-col sm:flex-row items-center lg:items-start gap-3"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Link
                      href="/lab"
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25 transition-[background-color,transform]"
                    >
                      <Camera className="w-5 h-5" />
                      Try It Free
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                    <p className="text-[11px] text-muted-foreground/70 text-center max-w-[280px]">
                      Snap a photo or upload one — your AI stylist scores your fit in seconds
                    </p>
                  </div>
                  <DemoToggleButton onClick={() => setShowDemo(true)} />
                </div>
              </Reveal>

              <Reveal delay={0.4}>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>No sign-up needed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Works on any phone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>30s to your first result</span>
                  </div>
                  <LiveCounter />
                </div>
              </Reveal>

              {/* Persona Mascot Presence */}
              <Reveal delay={0.5}>
                <div className="pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground text-center lg:text-left mb-3">
                    <Sparkles className="w-3 h-3 inline mr-1 text-accent" />
                    Choose your stylist personality
                  </p>
                  <PersonaCarousel />
                </div>
              </Reveal>

              {/* Sample AI output — mobile preview */}
              <Reveal delay={0.4} className="lg:hidden">
                <div className="mt-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.04] to-accent/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Sample AI Analysis
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black text-primary">8/10</div>
                    <div className="flex-1 text-xs text-muted-foreground leading-relaxed">
                      &ldquo;Strong color coordination. The oversized silhouette works well with your frame. Consider a structured bag to balance the proportions.&rdquo;
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">✓ Color Harmony</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">✓ Fit</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-medium">↑ Accessories</span>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right: Visual — desktop only */}
            <Reveal direction="right" delay={0.15} className="relative hidden lg:block">
              <HeroVisual />
            </Reveal>
          </div>
        </div>
      </div>

      {/* Recently Saved — shown when user has saved looks */}
      <RecentlySavedSection />

      {/* Craft a Look — interactive lead magnet */}
      <LookCrafter />

      {/* Editorial Stats */}
      <EditorialStats />

      {/* Curator Pitch Strip */}
      <Reveal>
        <section className="border-t border-border/30">
          <div className="container mx-auto px-4 py-10 md:py-14">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg md:text-xl font-light tracking-tight text-foreground">
                You curate fashion?{" "}
                <Link
                  href="/curator"
                  className="font-bold text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/30"
                >
                  Open a storefront
                </Link>
                {" "}— AI try-on, branded polaroids, WhatsApp checkout. Zero fees.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            BeOnPoint
          </div>
          <div className="flex items-center gap-4">
            <Link href="/curators" className="hover:text-foreground transition-colors">Browse</Link>
            <Link href="/curator" className="hover:text-foreground transition-colors">Curators</Link>
            <Link href="/lab" className="hover:text-foreground transition-colors">Lab</Link>
            <Link href="/guides" className="hover:text-foreground transition-colors">Guides</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs">AI-powered personal styling.</p>
        </div>
      </footer>

      {/* Mobile Continue Button — only shows once the hero CTA scrolls out of view */}
      <div
        className={`fixed bottom-4 left-4 right-4 md:hidden z-40 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out ${
          heroCtaInView
            ? "translate-y-24 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
        aria-hidden={heroCtaInView}
      >
        <Link
          href="/lab"
          className="block w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg text-center active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
        >
          Try It Free — Point Your Camera
        </Link>
      </div>
    </div>
  );
}

function RecentlySavedSection() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const recent = sessions.slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <section className="bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.04),transparent_70%)] overflow-hidden">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Reveal className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <Bookmark className="h-3.5 w-3.5" />
                Continued from last visit
              </div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                Recently Saved
              </h2>
            </div>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 active:opacity-70 active:scale-[0.98] transition-[opacity,transform,color]"
            >
              New look
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Film strip — overlapping images, no card containers */}
          <div className="flex -space-x-4 sm:-space-x-6 md:-space-x-8">
            {recent.map((session, i) => {
              const date = new Date(session.createdAt);
              const dateLabel = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <Link
                  key={session.id}
                  href="/lab?tab=my-looks"
                  onClick={() =>
                    trackRecentlySavedClicked({
                      sessionAge: (Date.now() - new Date(session.createdAt).getTime()) / 3600000,
                      score: session.score,
                      persona: session.persona,
                    })
                  }
                  className="group relative flex-1 aspect-[4/3] overflow-hidden rounded-lg transition-all duration-300 hover:z-10 hover:scale-[1.02] hover:shadow-2xl"
                  style={{ minWidth: 0 }}
                >
                  {session.coverImage ? (
                    <img
                      src={session.coverImage}
                      alt={session.headline}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Camera className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Score badge */}
                  <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    {session.score}/10
                  </div>
                  {/* Info overlay — visible on hover */}
                  <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-xs font-semibold leading-snug text-white line-clamp-1 drop-shadow-lg">
                      {session.headline}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-white/70">{dateLabel}</span>
                      {session.persona && (
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white capitalize">
                          {session.persona}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
