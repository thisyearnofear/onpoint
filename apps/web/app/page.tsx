"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { Palette, ChevronDown, Sparkles, ArrowRight, Check, Camera, MessageCircle, Users } from "lucide-react";
import { EnhancedConnectButton } from "../components/chains";
import { FarcasterSignInButton } from "../components/FarcasterSignInButton";
import { TacticalDashboard } from "../components/Dashboard/TacticalDashboard";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "@repo/ui/button";

export default function Home() {
  const dashboardRef = useRef<HTMLDivElement>(null);

  const scrollToDashboard = () => {
    dashboardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Simplified Header for Marketing */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tighter">
              BeOnPoint
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hidden md:flex"
              onClick={scrollToDashboard}
            >
              How it works
            </Button>
            <FarcasterSignInButton />
            <EnhancedConnectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section - Marketing First */}
      <HeroSection onGetStarted={scrollToDashboard} />

      <main ref={dashboardRef}>
        <TacticalDashboard />
      </main>

      {/* Global Terminal Footer (Minimalist) */}
      <footer className="border-t border-border/60 py-4 bg-background/80">
        <div className="container mx-auto px-4 flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          <div>Ref: ONPOINT_PROTOCOL_V1.5</div>
          <div>Status: Fully Operational</div>
        </div>
      </footer>
    </div>
  );
}

/**
 * HeroSection - Marketing-focused landing hero with visual demo
 * 
 * Key principles:
 * - Lead with the problem and solution
 * - Show visual proof using existing assets
 * - Strong, clear CTA that scrolls to dashboard
 */
function HeroSection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 blur-3xl rounded-full" />
      </div>

      <div className="relative container mx-auto px-4 py-12 md:py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>AI-Powered Fashion Stylist</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                Never wonder
                <span className="block text-primary"> "does this suit me?"</span>
                again.
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Get personalized outfit recommendations tailored to your body, style, and budget. 
                See how clothes look on you before you buy.
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <Button 
                  size="lg" 
                  onClick={onGetStarted}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Try Virtual Fitting
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={onGetStarted}
                  className="font-bold px-8 py-6 rounded-full text-lg"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Chat with Stylist
                </Button>
              </div>

              {/* Feature list */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>No signup required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Works with any photo</span>
                </div>
              </div>
            </div>

            {/* Right: Visual Demo */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card/50 shadow-2xl shadow-primary/10">
                {/* Demo Label */}
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-background/90 backdrop-blur text-xs font-bold text-foreground shadow-sm">
                  AI Try-On Demo
                </div>
                
                {/* Product Showcase - Using existing assets */}
                <div className="grid grid-cols-2 gap-2 p-4">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                    <Image
                      src="/assets/1Product.png"
                      alt="Fashion item preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                    <Image
                      src="/assets/2Product.png"
                      alt="Fashion item preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                    <Image
                      src="/assets/3Product.png"
                      alt="Fashion item preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <div className="text-center p-4">
                      <Camera className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Upload your photo to see how any outfit looks on you</p>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA Bar */}
                <div className="border-t border-border/60 p-3 bg-muted/30">
                  <button 
                    onClick={onGetStarted}
                    className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    Try On These Styles
                  </button>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-2 -right-2 md:bottom-4 md:-right-4 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg">
                ✓ AI Verified
              </div>
            </div>
          </div>

          {/* Expandable "Learn More" section */}
          <div className="mt-16 text-center">
            <details className="group inline-block">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 list-none">
                Learn more about how it works
                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-8 grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
                <FeatureCard 
                  icon={<Camera className="w-6 h-6" />}
                  title="Virtual Try-On"
                  description="Upload any photo and see how outfits look on you using AI. No physical items needed."
                />
                <FeatureCard 
                  icon={<MessageCircle className="w-6 h-6" />}
                  title="AI Stylist"
                  description="Tell us your occasion, budget, and style preferences. Get personalized recommendations in seconds."
                />
                <FeatureCard 
                  icon={<Users className="w-6 h-6" />}
                  title="Community Style"
                  description="See what others are wearing, share your looks, and get inspired by the community."
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-card/50 border border-border hover:border-border/80 transition-colors">
      <div className="text-primary mb-3">{icon}</div>
      <h3 className="font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
