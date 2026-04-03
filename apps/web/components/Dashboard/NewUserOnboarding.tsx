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
  Camera,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@repo/ui/button";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  benefit: string;
}

/**
 * NewUserOnboarding - Redesigned with progressive disclosure principles
 * 
 * Key improvements:
 * - Focus on benefits first, features second
 * - Use simple, non-technical language
 * - Core value shown first (2 steps), optional extras revealed progressively
 * - Option to skip entirely for curious visitors
 */
const STEPS: OnboardingStep[] = [
  {
    title: "Your Personal AI Stylist",
    description: "Get outfit recommendations tailored to your style, body type, and budget.",
    icon: Palette,
    color: "text-primary",
    benefit: "Never buy clothes that don't look good on you",
  },
  {
    title: "See How It Looks",
    description: "Upload a photo and virtually try on any outfit before you buy.",
    icon: Camera,
    color: "text-accent",
    benefit: "Make confident decisions without leaving home",
  },
  {
    title: "Live Style Coaching",
    description: "Get real-time feedback on your outfit using your camera.",
    icon: Video,
    color: "text-emerald-400",
    benefit: "Like having a stylist in your pocket",
  },
  {
    title: "Earn Rewards",
    description: "Share your looks and earn points toward premium features.",
    icon: Zap,
    color: "text-amber-400",
    benefit: "Get rewarded for great style",
  },
];

export function NewUserOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("onpoint-onboarding-seen");
    if (!hasSeenOnboarding) {
      // Delay slightly to let the hero load first
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("onpoint-onboarding-seen", "true");
    setIsOpen(false);
  };

  const handleSkip = () => {
    handleClose();
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
        className="relative max-w-md w-full bg-background border border-border rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 p-2 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentStep >= i 
                        ? "w-8 bg-primary" 
                        : "w-2 bg-muted"
                    }`}
                  />
                ))}
              </div>

              {/* Icon */}
              <div className="flex justify-center">
                <div className={`w-24 h-24 rounded-3xl bg-muted/50 border border-border flex items-center justify-center`}>
                  <Icon className={`w-12 h-12 ${step.color}`} />
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  {step.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Key benefit - prominent */}
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground font-medium">
                    {step.benefit}
                  </p>
                </div>
              </div>

              {/* Primary CTA */}
              <Button
                onClick={nextStep}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-full py-4 flex items-center justify-center gap-2"
              >
                {currentStep === STEPS.length - 1 ? "Get Started" : "Next"}
                <ArrowRight className="w-5 h-5" />
              </Button>

              {/* Skip option */}
              {currentStep === 0 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  I'll explore on my own
                </button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Back button */}
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="absolute top-1/2 left-4 -translate-y-1/2 p-2 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
