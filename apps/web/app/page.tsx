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
import { ThemeToggle } from "../components/ThemeToggle";
import { Auth0HeaderButton } from "../components/auth/Auth0Components";
import { Button } from "@repo/ui/button";
import { TacticalDashboard } from "../components/Dashboard/TacticalDashboard";
import { LayoutDashboard } from "lucide-react";

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
            <Auth0HeaderButton />
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
                Your AI stylist
                <span className="block text-primary">
                  sees, judges, shops.
                </span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Point your camera at an outfit. Get instant AI feedback. Discover what works for your body and style.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <Button
                  size="lg"
                  onClick={onContinue}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Try It Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
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
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Vision
                </div>
                
                {/* Before/After Split */}
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

      {/* Mobile Continue Button */}
      <div className="fixed bottom-20 left-4 right-4 md:hidden z-40">
        <Button
          onClick={onContinue}
          className="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg"
        >
          Try It Free — Point Your Camera
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
