"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  DollarSign,
  Crown,
  Gem,
  Wallet,
  Check,
  Camera,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";
import type { StylistPersona } from "@repo/ai-client";
import { PersonaAvatar, MascotWelcome } from "../ui/PersonaAvatar";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { useUserPreferences } from "../../hooks/useUserPreferences";

// ── Types ──

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

// ── Preference Options ──

const BODY_TYPES = [
  { value: "slim", label: "Slim", emoji: "🧘", description: "Narrow frame" },
  { value: "athletic", label: "Athletic", emoji: "💪", description: "Well-defined" },
  { value: "average", label: "Average", emoji: "🧑", description: "Balanced" },
  { value: "plus", label: "Plus", emoji: "💎", description: "Fuller figure" },
  { value: "petite", label: "Petite", emoji: "🌸", description: "Shorter stature" },
  { value: "tall", label: "Tall", emoji: "🦒", description: "Above average" },
] as const;

const STYLE_AESTHETICS = [
  { value: "streetwear", label: "Streetwear", emoji: "🧢" },
  { value: "casual", label: "Casual", emoji: "👕" },
  { value: "formal", label: "Formal", emoji: "👔" },
  { value: "vintage", label: "Vintage", emoji: "📻" },
  { value: "sporty", label: "Sporty", emoji: "⚡" },
  { value: "boho", label: "Boho", emoji: "🌸" },
  { value: "minimalist", label: "Minimalist", emoji: "◻️" },
  { value: "edgy", label: "Edgy", emoji: "🖤" },
  { value: "preppy", label: "Preppy", emoji: "🎀" },
  { value: "avant-garde", label: "Avant-Garde", emoji: "🎭" },
] as const;

const BUDGET_TIERS = [
  { value: "budget-friendly", label: "Budget-Friendly", icon: DollarSign, range: "Under $50", color: "border-emerald-400/30 bg-emerald-500/5" },
  { value: "moderate", label: "Moderate", icon: Wallet, range: "$50 – $150", color: "border-blue-400/30 bg-blue-500/5" },
  { value: "premium", label: "Premium", icon: Crown, range: "$150 – $500", color: "border-purple-400/30 bg-purple-500/5" },
  { value: "luxury", label: "Luxury", icon: Gem, range: "$500+", color: "border-amber-400/30 bg-amber-500/5" },
] as const;

// ── Mascot Greetings for each step ──

const STEP_GREETINGS: Record<string, string> = {
  welcome: "Welcome! I'm your personal style guide. Let's find what makes you look and feel amazing.",
  preferences: "To give you the best advice, I need to know a little about you. What's your body type?",
  aesthetics: "Now for the fun part — what styles speak to you? Pick as many as you like.",
  budget: "Great choices! One last thing — what's your budget range for new pieces?",
  stylist: "Based on what you've told me, I think you'll love working with this stylist. Ready to see what they can do?",
  trial: "You're all set! Here's a special offer to start your style journey — no commitment required.",
};

const GREETING_VOICES: Record<string, string> = {
  miranda: "Welcome. I'm Miranda Priestly. Let's begin discovering your style — efficiently.",
  edina: "Darling! It's Edina Monsoon, and I am OBSESSED with the idea of styling you!",
  shaft: "Right on. John Shaft here. Let's find your style and make it work.",
  luxury: "Greetings. Excellence begins with understanding. Let's discover your aesthetic.",
  streetwear: "Yo! Virgil here. Let's talk style. No cap — you've got potential.",
  sustainable: "Hello! Stella McCartney here. Let's find beautiful, conscious choices for you.",
};

// ── Persona Configs for selection ──

const SELECTABLE_PERSONAS: Array<{
  key: StylistPersona;
  tagline: string;
  vibe: string;
  bestFor: string;
}> = [
  { key: "miranda", tagline: "The truth, elegantly delivered", vibe: "💼 Professional", bestFor: "Polished, refined looks" },
  { key: "edina", tagline: "Absolutely fabulous, darling!", vibe: "🔥 Bold & Dramatic", bestFor: "Statement pieces" },
  { key: "shaft", tagline: "Cool, confident, classic", vibe: "✨ Supportive", bestFor: "Wardrobe building" },
];

// ── Budget to tier mapping for personalized plan ──

const BUDGET_TO_TIER: Record<string, string> = {
  "budget-friendly": "basic",
  "moderate": "pro",
  "premium": "pro",
  "luxury": "concierge",
};

const TIER_NAMES: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  concierge: "Concierge",
};

const TIER_PRICES: Record<string, number> = {
  basic: 9.99,
  pro: 29.99,
  concierge: 99.99,
};

// ── Sub-Components ──

function StepIndicator({ current, total }: { current: number; total: number }) {
  // Always show dots, no text steps
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i <= current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function BodyTypeSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BODY_TYPES.map((bt) => (
        <button
          key={bt.value}
          type="button"
          onClick={() => onChange(bt.value)}
          className={`
            flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all duration-200
            ${value === bt.value
              ? "border-primary bg-primary/10 shadow-sm scale-[1.02] ring-1 ring-primary/30"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
            }
          `}
        >
          <span className="text-xl leading-none">{bt.emoji}</span>
          <span className="text-xs font-semibold">{bt.label}</span>
          <span className="text-[9px] text-muted-foreground leading-tight">
            {bt.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function AestheticsSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (aesthetic: string) => {
    if (value.includes(aesthetic)) {
      onChange(value.filter((v) => v !== aesthetic));
    } else {
      onChange([...value, aesthetic]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {STYLE_AESTHETICS.map((a) => {
          const selected = value.includes(a.value);
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => toggle(a.value)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium
                transition-all duration-200 border
                ${selected
                  ? "bg-primary/10 text-primary border-primary/30 shadow-sm scale-105"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                }
              `}
            >
              <span className="text-sm">{a.emoji}</span>
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {value.length === 0
          ? "Pick as many as you like"
          : `${value.length} selected — great taste!`
        }
      </p>
    </div>
  );
}

function BudgetSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUDGET_TIERS.map((bt) => {
        const Icon = bt.icon;
        const selected = value === bt.value;
        return (
          <button
            key={bt.value}
            type="button"
            onClick={() => onChange(bt.value)}
            className={`
              flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200
              ${selected
                ? `${bt.color} border-primary shadow-sm scale-[1.02]`
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }
            `}
          >
            <div className={`p-2 rounded-lg ${
              selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{bt.label}</div>
              <div className="text-xs text-muted-foreground">{bt.range}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ──

export function NewUserOnboarding() {
  const router = useRouter();
  const { updatePreferencesWithSync } = useUserPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedBodyType, setSelectedBodyType] = useState<string | null>(null);
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<StylistPersona>("miranda");
  const [actionLoading, setActionLoading] = useState(false);
  const [hasStartedTrial, setHasStartedTrial] = useState(false);
  const stepKeyRef = useRef(0);

  // Voice greeting for current step
  const currentPersona = selectedPersona;

  // Show onboarding on first visit after a brief delay
  useEffect(() => {
    const hasSeen = localStorage.getItem("onpoint-onboarding-seen");
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem("onpoint-onboarding-seen", "true");
    setIsOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const getRecommendedPersona = useCallback((): StylistPersona => {
    // Simple recommendation logic based on style choices
    if (selectedAesthetics.includes("formal") || selectedAesthetics.includes("minimalist") || selectedAesthetics.includes("preppy")) {
      return "miranda";
    }
    if (selectedAesthetics.includes("streetwear") || selectedAesthetics.includes("edgy") || selectedAesthetics.includes("avant-garde")) {
      return "edina";
    }
    if (selectedAesthetics.includes("casual") || selectedAesthetics.includes("sporty") || selectedAesthetics.includes("vintage")) {
      return "shaft";
    }
    // Default to edina for fun
    return "edina";
  }, [selectedAesthetics]);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Find your style",
      subtitle: "Your personal AI stylist is here to help",
      content: null as any, // Rendered specially
    },
    {
      id: "preferences",
      title: "About your body",
      subtitle: "Helps us find the perfect fit for you",
      content: <BodyTypeSelector value={selectedBodyType} onChange={setSelectedBodyType} />,
    },
    {
      id: "aesthetics",
      title: "Your style vibe",
      subtitle: "What kind of looks do you love?",
      content: <AestheticsSelector value={selectedAesthetics} onChange={setSelectedAesthetics} />,
    },
    {
      id: "budget",
      title: "Your budget",
      subtitle: "Helps us find pieces in your range",
      content: <BudgetSelector value={selectedBudget} onChange={setSelectedBudget} />,
    },
    {
      id: "stylist",
      title: "Meet your stylist",
      subtitle: "Based on your choices, we recommend...",
      content: null as any, // Rendered specially
    },
    {
      id: "trial",
      title: "Start your free trial",
      subtitle: "No commitment — cancel anytime",
      content: null as any, // Rendered specially
    },
  ];

  const totalSteps = steps.length;
  const current = steps[currentStep];
  if (!current) return null;

  const canProceed = (() => {
    switch (current.id) {
      case "welcome": return true;
      case "preferences": return selectedBodyType !== null;
      case "aesthetics": return selectedAesthetics.length > 0;
      case "budget": return selectedBudget !== null;
      case "stylist": return true;
      case "trial": return true;
      default: return true;
    }
  })();

  const handleNext = () => {
    setDirection("forward");

    // Save preferences when leaving the preferences/aesthetics/budget steps
    if (current.id === "aesthetics") {
      const recommended = getRecommendedPersona();
      setSelectedPersona(recommended);
    }

    if (current.id === "budget") {
      // Save all preferences
      updatePreferencesWithSync({
        bodyType: selectedBodyType as any,
        styleAesthetics: selectedAesthetics,
        budgetTier: selectedBudget as any,
      });
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      stepKeyRef.current += 1;
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    setDirection("back");
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      stepKeyRef.current += 1;
    }
  };

  const handleStartTrial = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/auth/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trial", durationDays: 14 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start trial");
      setHasStartedTrial(true);
      setTimeout(() => {
        handleClose();
        router.push("/lab");
      }, 1500);
    } catch {
      // If trial fails, still let them proceed
      handleClose();
      router.push("/pricing");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExploreFree = () => {
    handleClose();
    router.push("/lab");
  };

  if (!isOpen) return null;

  const personaConfig = getPersonaConfig(selectedPersona);

  // ── Render step content ──

  const renderStepContent = () => {
    switch (current.id) {
      case "welcome":
        return (
          <div className="text-center space-y-6 py-2">
            <MascotWelcome persona="miranda" />
            <div className="space-y-3 max-w-xs mx-auto">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 text-left">
                <Camera className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Snap a photo — get instant AI style feedback</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 text-left">
                <Sparkles className="w-5 h-5 text-accent shrink-0" />
                <p className="text-xs text-muted-foreground">Try on outfits virtually before you buy</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 text-left">
                <MessageCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-xs text-muted-foreground">Chat with personality-driven AI stylists</p>
              </div>
            </div>
          </div>
        );

      case "stylist":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <PersonaAvatar persona={selectedPersona} size="2xl" animate="wave" showRing />
              <div className="text-center">
                <h3 className="text-xl font-bold">{personaConfig.characterName}</h3>
                <p className="text-xs text-muted-foreground italic max-w-xs">
                  &ldquo;{GREETING_VOICES[selectedPersona] || STEP_GREETINGS.stylist}&rdquo;
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {SELECTABLE_PERSONAS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelectedPersona(p.key)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-left
                    ${selectedPersona === p.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                    }
                  `}
                >
                  <PersonaAvatar persona={p.key} size="sm" animate={selectedPersona === p.key ? "wave" : "idle"} />
                  <div>
                    <div className="text-xs font-semibold">{getPersonaConfig(p.key).characterName}</div>
                    <div className="text-[10px] text-muted-foreground">{p.vibe}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case "trial":
        const recommendedTier = BUDGET_TO_TIER[selectedBudget || "moderate"] || "pro";
        const tierName = TIER_NAMES[recommendedTier] || "Pro";
        const tierPrice = TIER_PRICES[recommendedTier] || 29.99;

        return (
          <div className="space-y-4">
            {/* Mascot transition */}
            <div className="flex justify-center">
              <PersonaAvatar persona={selectedPersona} size="lg" animate="wave" showRing />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {personaConfig.characterName} recommends
              </p>
              <h3 className="text-2xl font-black text-primary">
                {tierName} Plan
              </h3>
              <p className="text-xs text-muted-foreground">
                Personalized for your {selectedBudget?.replace("-", " ") || "moderate"} budget
              </p>
            </div>

            {/* Trial offer card */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black">$0</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                  14-DAY FREE TRIAL
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  Premium AI stylists — including {personaConfig.characterName}
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  Unlimited style analyses & virtual try-on
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  {recommendedTier === "concierge" ? "Personal stylist consultations" : `${recommendedTier === "pro" ? "500" : "50"} actions per day`}
                </div>
              </div>
            </div>

            {hasStartedTrial ? (
              <div className="text-center py-3">
                <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting your trial...
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleStartTrial}
                  disabled={actionLoading}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-6 rounded-xl text-base"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start 14-Day Free Trial
                    </>
                  )}
                </Button>
                <button
                  onClick={handleExploreFree}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
                >
                  Explore free version first
                </button>
              </div>
            )}
          </div>
        );

      default:
        return current.content;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div
        key={stepKeyRef.current}
        className="animate-bounce-in-up relative max-w-sm w-full bg-background border border-border rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-5 right-5 p-2 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8">
          {/* Step indicator */}
          <StepIndicator current={currentStep} total={totalSteps} />

          {/* Step content */}
          <div className="mt-6 space-y-4">
            {/* Title + Subtitle */}
            {current.id !== "welcome" && (
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold tracking-tight">{current.title}</h2>
                <p className="text-xs text-muted-foreground">{current.subtitle}</p>
              </div>
            )}

            {/* Mascot avatar for non-welcome steps (small) */}
            {current.id !== "welcome" && current.id !== "stylist" && current.id !== "trial" && (
              <div className="flex justify-center">
                <PersonaAvatar persona={selectedPersona} size="md" animate="idle" />
              </div>
            )}

            {/* Content */}
            <div className="min-h-[180px]">
              {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`p-2 rounded-full transition-colors ${
                  currentStep === 0
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {current.id !== "trial" && current.id !== "stylist" && (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="rounded-full px-6"
                >
                  {current.id === "welcome" ? "Get Started" : "Continue"}
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}

              {(current.id === "stylist") && (
                <Button
                  onClick={handleNext}
                  className="rounded-full px-6 bg-gradient-to-r from-primary to-accent"
                >
                  Looks good!
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}

              {/* Skip option for preferences */}
              {currentStep > 0 && current.id !== "trial" && current.id !== "stylist" && (
                <button
                  onClick={handleNext}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
