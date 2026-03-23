"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Video,
  Wallet,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  Palette,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@repo/ui/button";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  image?: string;
  features: string[];
}

const STEPS: OnboardingStep[] = [
  {
    title: "AI Stylist & Personas",
    description: "Get expert fashion advice tailored to your personal vibe.",
    icon: Palette,
    color: "text-indigo-400",
    features: [
      "Six distinct stylist personalities",
      "Roast, Flatter, or Real feedback modes",
      "Virtual try-on with realistic proportions",
    ],
  },
  {
    title: "Live AR Coaching",
    description: "Real-time fashion feedback as you move in front of your camera.",
    icon: Video,
    color: "text-emerald-400",
    features: [
      "Powered by Gemini Live & Venice AI",
      "Bidirectional voice & video analysis",
      "Instant style scores and fit checks",
    ],
  },
  {
    title: "Agent Economy",
    description: "Your AI agent can help you shop and stay on budget.",
    icon: Wallet,
    color: "text-amber-400",
    features: [
      "Set daily spending limits in cUSD",
      "Approve purchases with one tap",
      "Automated style-matched recommendations",
    ],
  },
  {
    title: "Community & Social",
    description: "Share your style and see what the community is wearing.",
    icon: Users,
    color: "text-blue-400",
    features: [
      "Farcaster & Twitter integration",
      "Proof of Style NFT minting on Celo",
      "Earn reputation for sharp outfits",
    ],
  },
];

export function NewUserOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("onpoint-onboarding-seen");
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("onpoint-onboarding-seen", "true");
    setIsOpen(false);
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep]!;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl bg-slate-800 border border-white/10 flex items-center justify-center shadow-xl`}>
                  <Icon className={`w-10 h-10 ${step.color}`} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">
                    {step.title}
                  </h2>
                  <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                {step.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm text-slate-200">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="rounded-full px-6 text-slate-500 hover:text-white disabled:opacity-0"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Button>

              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentStep === i ? "w-8 bg-indigo-500" : "w-1.5 bg-slate-700"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={nextStep}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-8 font-bold shadow-lg shadow-indigo-500/20"
              >
                {currentStep === STEPS.length - 1 ? "Get Started" : "Next"}
                {currentStep !== STEPS.length - 1 && <ChevronRight className="w-5 h-5 ml-1" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="bg-black/40 px-8 py-4 flex items-center justify-center gap-2 border-t border-white/5">
           <Zap className="w-3 h-3 text-indigo-400" />
           <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
             OnPoint Protocol v1.5 // Style Intelligence
           </span>
        </div>
      </motion.div>
    </div>
  );
}
