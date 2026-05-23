import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Progress } from "@repo/ui/progress";
import {
  Camera,
  Sparkles,
  Wallet,
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Star,
  Heart,
  Palette,
  DollarSign,
  Crown,
  Gem,
} from "lucide-react";

// ── Types ──

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  required?: boolean;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userProgress?: {
    hasWallet?: boolean;
    hasAuth0?: boolean;
    hasTriedAR?: boolean;
    hasCompletedProfile?: boolean;
  };
}

// ── Preference Options ──

const BODY_TYPES = [
  { value: "slim", label: "Slim", icon: "🧘", description: "Narrow frame, lean build" },
  { value: "athletic", label: "Athletic", icon: "💪", description: "Muscular, well-defined" },
  { value: "average", label: "Average", icon: "🧑", description: "Balanced proportions" },
  { value: "plus", label: "Plus", icon: "💎", description: "Fuller figure, curves" },
  { value: "petite", label: "Petite", icon: "🌸", description: "Shorter stature" },
  { value: "tall", label: "Tall", icon: "🦒", description: "Above average height" },
] as const;

const STYLE_AESTHETICS = [
  { value: "streetwear", label: "Streetwear", emoji: "🧢", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "casual", label: "Casual", emoji: "👕", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "formal", label: "Formal", emoji: "👔", color: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300" },
  { value: "vintage", label: "Vintage", emoji: "📻", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "sporty", label: "Sporty", emoji: "⚡", color: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300" },
  { value: "boho", label: "Boho", emoji: "🌸", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  { value: "minimalist", label: "Minimalist", emoji: "◻️", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "edgy", label: "Edgy", emoji: "🖤", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "preppy", label: "Preppy", emoji: "🎀", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { value: "avant-garde", label: "Avant-Garde", emoji: "🎭", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
] as const;

const BUDGET_TIERS = [
  { value: "budget-friendly", label: "Budget-Friendly", icon: <DollarSign className="w-5 h-5" />, range: "Under $50", color: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30" },
  { value: "moderate", label: "Moderate", icon: <Wallet className="w-5 h-5" />, range: "$50 – $150", color: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" },
  { value: "premium", label: "Premium", icon: <Crown className="w-5 h-5" />, range: "$150 – $500", color: "border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30" },
  { value: "luxury", label: "Luxury", icon: <Gem className="w-5 h-5" />, range: "$500+", color: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" },
] as const;

// ── Preference Step Sub-Components ──

function BodyTypeSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        What's your body type?
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {BODY_TYPES.map((bt) => (
          <button
            key={bt.value}
            type="button"
            onClick={() => onChange(bt.value)}
            className={`
              flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all duration-200
              ${value === bt.value
                ? "border-primary bg-primary/5 shadow-sm scale-[1.02]"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
              }
            `}
          >
            <span className="text-lg leading-none">{bt.icon}</span>
            <span className="text-xs font-semibold">{bt.label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {bt.description}
            </span>
          </button>
        ))}
      </div>
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
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Palette className="w-4 h-4 text-primary" />
        Pick your style aesthetics
      </h4>
      <div className="flex flex-wrap gap-2">
        {STYLE_AESTHETICS.map((a) => {
          const selected = value.includes(a.value);
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => toggle(a.value)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 border
                ${selected
                  ? `${a.color} border-transparent shadow-sm scale-105`
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
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Select as many as you like — you can always adjust later
        </p>
      )}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} selected
        </p>
      )}
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
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        What's your budget range?
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {BUDGET_TIERS.map((bt) => (
          <button
            key={bt.value}
            type="button"
            onClick={() => onChange(bt.value)}
            className={`
              flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200
              ${value === bt.value
                ? `${bt.color} border-primary shadow-sm scale-[1.02]`
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
              }
            `}
          >
            <div className={`p-2 rounded-lg ${
              value === bt.value
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              {bt.icon}
            </div>
            <div>
              <div className="text-sm font-semibold">{bt.label}</div>
              <div className="text-xs text-muted-foreground">{bt.range}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Welcome Step (existing) ──

function WelcomeContent() {
  return (
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">AI-Powered Fashion</h3>
        <p className="text-muted-foreground">
          Discover your perfect style with virtual try-on, personalized
          recommendations, and expert AI styling guidance.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center">
          <Camera className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm font-medium">Virtual Try-On</p>
        </div>
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="text-sm font-medium">AI Styling</p>
        </div>
        <div className="text-center">
          <Heart className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium">Personal Style</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export function OnboardingFlow({
  isOpen,
  onClose,
  onComplete,
  userProgress = {},
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Preference state
  const [selectedBodyType, setSelectedBodyType] = useState<string | null>(null);
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);

  const savePreferences = useCallback(() => {
    const prefs = {
      bodyType: selectedBodyType,
      styleAesthetics: selectedAesthetics,
      budgetTier: selectedBudget,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem("onpoint-style-preferences", JSON.stringify(prefs));
    } catch {
      // localStorage may be unavailable
    }
  }, [selectedBodyType, selectedAesthetics, selectedBudget]);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to OnPoint",
      description: "Your AI-powered fashion stylist awaits",
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      content: <WelcomeContent />,
    },
    {
      id: "preferences",
      title: "Tell Us About Your Style",
      description: "Help us personalize your experience",
      icon: <Palette className="w-6 h-6 text-pink-500" />,
      content: (
        <div className="space-y-6 overflow-y-auto max-h-[50vh] pr-1">
          <BodyTypeSelector value={selectedBodyType} onChange={setSelectedBodyType} />
          <div className="border-t border-border" />
          <AestheticsSelector value={selectedAesthetics} onChange={setSelectedAesthetics} />
          <div className="border-t border-border" />
          <BudgetSelector value={selectedBudget} onChange={setSelectedBudget} />
        </div>
      ),
    },
    {
      id: "wallet",
      title: "Connect Your Wallet",
      description: "Access premium features and secure transactions",
      icon: <Wallet className="w-6 h-6 text-blue-500" />,
      required: true,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium mb-2">Why connect a wallet?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access virtual try-on features</li>
              <li>• Purchase fashion items securely</li>
              <li>• Earn rewards for style contributions</li>
              <li>• Own your fashion data</li>
            </ul>
          </div>

          {userProgress.hasWallet ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Wallet connected successfully!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          )}
        </div>
      ),
    },
    {
      id: "account",
      title: "Create Your Account",
      description: "Save your preferences and style history",
      icon: <User className="w-6 h-6 text-green-500" />,
      required: false,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="font-medium mb-2">Account benefits:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Save your style preferences</li>
              <li>• Access your styling history</li>
              <li>• Get personalized recommendations</li>
              <li>• Sync across devices</li>
            </ul>
          </div>

          {userProgress.hasAuth0 ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Account created successfully!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <User className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          )}
        </div>
      ),
    },
    {
      id: "virtual-tryon",
      title: "Try Virtual Styling",
      description: "Experience AI-powered fashion like never before",
      icon: <Camera className="w-6 h-6 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-purple-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Virtual Try-On Preview
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg text-center">
              <Sparkles className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <p className="text-sm font-medium">AI Analysis</p>
              <p className="text-xs text-muted-foreground">Body type & style</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-sm font-medium">Recommendations</p>
              <p className="text-xs text-muted-foreground">Personalized tips</p>
            </div>
          </div>

          {userProgress.hasTriedAR ? (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Virtual try-on completed!
              </span>
            </div>
          ) : (
            <Button className="w-full" size="lg">
              <Camera className="w-4 h-4 mr-2" />
              Start Virtual Try-On
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (currentStepData?.id === "preferences") {
      savePreferences();
    }
    if (isLastStep) {
      onComplete();
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const canProceed =
    !currentStepData?.required ||
    (currentStepData?.id === "wallet" && userProgress.hasWallet) ||
    (currentStepData?.id === "account" && userProgress.hasAuth0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              {currentStepData?.icon}
              <span>{currentStepData?.title}</span>
            </CardTitle>
            <CardDescription>{currentStepData?.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex space-x-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-1 rounded ${
                  index < currentStep
                    ? "bg-primary"
                    : index === currentStep
                      ? "bg-primary/60"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step Content */}
          <div className="min-h-[200px]">{currentStepData?.content}</div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button onClick={handleNext} disabled={!canProceed}>
              {isLastStep ? "Get Started" : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Skip Option */}
          {!currentStepData?.required && currentStep > 0 && (
            <div className="text-center">
              <button
                onClick={handleNext}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip this step
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
