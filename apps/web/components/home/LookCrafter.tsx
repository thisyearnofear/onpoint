"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Wand2,
  Sparkles,
  ArrowRight,
  Check,
  Ruler,
  Scale,
  Flame,
  Heart,
  Download,
  Share2,
  Shirt,
} from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { getCritique } from "../../lib/utils/persona-critiques";
import type { StylistPersona, CritiqueMode } from "@repo/ai-client";
import { useUserPreferences } from "../../hooks/useUserPreferences";
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
} from "../../lib/utils/style-constants";
import type { BodyType, BudgetTier } from "../../lib/utils/style-constants";
import { PRODUCT_NAME } from "../../lib/brand";

export function LookCrafter() {
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
      const critique = getCritique(persona!, critiqueMode);
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
                      Crafted on {PRODUCT_NAME}
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
