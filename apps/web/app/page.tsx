"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Auth0HeaderButton } from "../components/auth/Auth0Components";
import { NotificationBell } from "../components/NotificationBell";
import { LiveCounter } from "../components/LiveCounter";
import { Button } from "@repo/ui/button";
import { PersonaAvatar } from "../components/ui/PersonaAvatar";
import { getPersonaConfig } from "../lib/utils/persona-config";
import type { StylistPersona } from "@repo/ai-client";
import { useAnalysisHistory } from "../lib/stores/analysis-history-store";
import { trackRecentlySavedClicked } from "../lib/utils/analytics";

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
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
            >
              <Store className="w-4 h-4" />
              Curators
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
            >
              <FlaskConical className="w-4 h-4" />
              Lab
            </Link>
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
            >
              Guides
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
            >
              About
            </Link>
            <NotificationBell />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <HeroView />
    </div>
  );
}

function PersonaCarousel() {
  const [selectedPersona, setSelectedPersona] = useState<StylistPersona | null>(null);
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
          return (
            <button
              key={p}
              onClick={() => setSelectedPersona(p)}
              className="group relative flex flex-col items-center gap-1"
            >
              <PersonaAvatar persona={p} size="sm" animate="idle" />
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {personaNames[p]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Meet the Stylist Modal */}
      {selectedPersona && (
        <PersonaMeetModal
          persona={selectedPersona}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </>
  );
}

function PersonaMeetModal({
  persona,
  onClose,
}: {
  persona: StylistPersona;
  onClose: () => void;
}) {
  const config = getPersonaConfig(persona);
  const PersonaIcon = config.icon;

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
            className="absolute right-3 top-3 rounded-full bg-black/20 p-1.5 text-white/70 hover:text-white transition-colors"
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
          <Link
            href={`/lab?tab=try-on&persona=${persona}`}
            onClick={onClose}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Try {config.characterName.split(" ")[0]} as your stylist
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function WelcomeBackBanner() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const latest = sessions[0];

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

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            Welcome back! 👋
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last analysis {timeAgo} — <span className="font-semibold text-primary">{latest.score}/10</span>
            {latest.persona && <>, styled by <span className="capitalize font-medium">{latest.persona}</span></>}
          </p>
        </div>
        <Link
          href="/lab?tab=my-looks"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary/90"
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
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground hover:bg-muted/50"
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
      image: "/assets/1Product.png",
      badge: "1. Upload",
      stat: null,
    },
    {
      title: "AI analyzes your style",
      description: "Our AI stylists read your silhouette, color palette, and fit. Get a detailed score and personalized feedback.",
      image: "/assets/1Product.png",
      badge: "2. AI Analysis",
      stat: { label: "Score", value: "8/10" },
    },
    {
      title: "Save & share your look",
      description: "Save to My Looks, share a polaroid-style card to Farcaster or Twitter, or email yourself the full report.",
      image: "/assets/2Product.png",
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
          className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white/70 hover:text-white transition-colors"
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
              <p className="text-[9px] uppercase tracking-wider text-white/60">{current.stat.label}</p>
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
                >
                  Next
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <Link
                  href="/lab"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
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

function HeroView() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Welcome Back Banner */}
      <div className="container mx-auto px-4 pt-6">
        <WelcomeBackBanner />
      </div>

      {/* Demo Walkthrough */}
      {showDemo && <DemoWalkthrough onClose={() => setShowDemo(false)} />}

      <div className="relative container mx-auto px-4 py-12 md:py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>AI-Powered Fashion</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                Your AI stylist
                <span className="block text-primary">
                  sees, judges, shops.
                </span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Point your camera at an outfit. Get instant AI feedback from a team of personality-driven stylists. Discover what works for your body and style.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <Link
                  href="/lab"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  Try It Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <DemoToggleButton onClick={() => setShowDemo(true)} />
              </div>

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

              {/* Persona Mascot Presence */}
              <div className="pt-4 border-t border-border/40">
                <p className="text-xs text-muted-foreground text-center lg:text-left mb-3">
                  <Sparkles className="w-3 h-3 inline mr-1 text-accent" />
                  Choose your stylist personality
                </p>
                <PersonaCarousel />
              </div>

              {/* Sample AI output — mobile preview */}
              <div className="lg:hidden mt-4 rounded-2xl border border-primary/20 bg-card/50 p-4 space-y-3">
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
            </div>

            {/* Right: Visual — desktop only */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-primary/5 to-accent/5 shadow-2xl p-6">
                {/* Mascot floating badge */}
                <div className="absolute -top-3 -right-3 z-20 animate-float">
                  <div className="relative">
                    <PersonaAvatar persona="edina" size="sm" animate="wave" showRing />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-card border border-border text-[9px] font-medium shadow-sm">
                      &ldquo;Absolutely fabulous!&rdquo;
                    </div>
                  </div>
                </div>

                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Vision
                </div>
                
                <div className="space-y-3">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    <Image
                      src="/assets/1Product.png"
                      alt="AI analyzing your photo"
                      fill
                      className="object-cover opacity-90"
                      unoptimized
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/90 text-[10px] font-bold">
                      1. Upload Photo
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-primary/20 bg-primary/5">
                      <div className="p-3 space-y-1">
                        <div className="text-[10px] font-bold text-primary">FIT ANALYSIS</div>
                        <div className="text-[9px] text-muted-foreground">Athletic build</div>
                        <div className="text-[9px] text-muted-foreground">Broad shoulders</div>
                        <div className="text-[9px] text-muted-foreground">Slim waist</div>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-primary/90 text-white text-[10px] font-bold">
                        2. AI Judges
                      </div>
                    </div>
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-accent/20">
                      <Image
                        src="/assets/2Product.png"
                        alt="AI recommended outfit"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-accent/90 text-white text-[10px] font-bold">
                        3. Agent Shops
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Saved — shown when user has saved looks */}
      <RecentlySavedSection />

      {/* Mobile Continue Button */}
      <div className="fixed bottom-20 left-4 right-4 md:hidden z-40">
        <Link
          href="/lab"
          className="block w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg text-center"
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
    <section className="border-t border-border/60 bg-gradient-to-b from-card/50 to-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              New look
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recent.map((session) => {
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
                  className="group block rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
                >
                  {/* Polaroid-style photo area */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {session.coverImage ? (
                      <img
                        src={session.coverImage}
                        alt={session.headline}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    {/* Score badge */}
                    <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      {session.score}/10
                    </div>
                  </div>
                  {/* Info area */}
                  <div className="p-3">
                    <p className="text-xs font-semibold leading-snug line-clamp-1">
                      {session.headline}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {dateLabel}
                      </span>
                      {session.persona && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary capitalize">
                          {session.persona}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
