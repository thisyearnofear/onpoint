"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Palette,
  Sparkles,
  ArrowRight,
  Check,
  Camera,
  MessageCircle,
} from "lucide-react";
import { EnhancedConnectButton } from "../components/chains";
import { FarcasterSignInButton } from "../components/FarcasterSignInButton";
import { TacticalDashboard } from "../components/Dashboard/TacticalDashboard";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "@repo/ui/button";
import { LayoutDashboard, Users } from "lucide-react";

type View = "hero" | "dashboard";

export default function Home() {
  const [view, setView] = useState<View>("hero");
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem("onpoint-has-visited");
    if (seen) {
      setIsFirstVisit(false);
      setView("dashboard");
    }
  }, []);

  const handleContinue = () => {
    localStorage.setItem("onpoint-has-visited", "true");
    setIsFirstVisit(false);
    setView("dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Desktop Header - sticky */}
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

            {/* Desktop Nav */}
            <nav className="flex items-center gap-1">
              <Button
                variant={view === "dashboard" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("dashboard")}
                className="rounded-full"
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Start
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <FarcasterSignInButton />
            <EnhancedConnectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      {view === "hero" ? (
        <HeroView onContinue={handleContinue} />
      ) : (
        <DashboardView onBack={() => setView("hero")} />
      )}

      {/* Mobile Bottom Nav */}
      <MobileNav
        currentView={view}
        onNavigate={setView}
        visible={view === "dashboard"}
      />
    </div>
  );
}

function HeroView({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen">
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
                Never wonder
                <span className="block text-primary">
                  {" "}
                  "does this suit me?"
                </span>
                again.
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Get personalized outfit recommendations tailored to your body,
                style, and budget. See how clothes look on you before you buy.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <Button
                  size="lg"
                  onClick={onContinue}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Start Trying Looks
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>No signup required</span>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card/50 shadow-2xl">
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-background/90 text-xs font-bold shadow-sm">
                  Preview
                </div>
                <div className="grid grid-cols-2 gap-1 p-2">
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                    <Image
                      src="/assets/1Product.png"
                      alt="Look 1"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                    <Image
                      src="/assets/2Product.png"
                      alt="Look 2"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Continue Button */}
      <div className="fixed bottom-20 left-4 right-4 md:hidden z-40">
        <Button
          onClick={onContinue}
          className="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}

function DashboardView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-24 md:pb-0">
      <TacticalDashboard />
    </div>
  );
}

function MobileNav({
  currentView,
  onNavigate,
  visible,
}: {
  currentView: View;
  onNavigate: (view: View) => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border md:hidden z-50">
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => onNavigate("hero")}
          className={`flex flex-col items-center gap-1 p-2 ${
            currentView === "hero" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>
        <button
          onClick={() => onNavigate("dashboard")}
          className={`flex flex-col items-center gap-1 p-2 ${
            currentView === "dashboard"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">App</span>
        </button>
      </div>
    </div>
  );
}
