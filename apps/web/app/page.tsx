import React from "react";
import { Palette, ChevronDown, Sparkles, ArrowRight, Check, Camera, MessageCircle, Users, Zap } from "lucide-react";
import { EnhancedConnectButton, ChainStatusIndicator } from "../components/chains";
import { FarcasterSignInButton } from "../components/FarcasterSignInButton";
import { TacticalDashboard } from "../components/Dashboard/TacticalDashboard";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "@repo/ui/button";

export default function Home() {
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
            <Button variant="ghost" size="sm" className="text-muted-foreground hidden md:flex">
              How it works
            </Button>
            <FarcasterSignInButton />
            <EnhancedConnectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section - Marketing First */}
      <HeroSection />

      <main>
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
 * HeroSection - Marketing-focused landing hero with progressive disclosure
 * 
 * Key principles:
 * - Lead with the problem (fashion decisions are hard) and solution (AI styling)
 * - Hide crypto/web3 complexity until users are engaged
 * - Use progressive disclosure - show simple first, reveal advanced on demand
 * - Strong, clear CTA that doesn't require wallet connection
 */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 blur-3xl rounded-full" />
      </div>

      <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>AI-Powered Fashion Stylist</span>
          </div>

          {/* Headline - Focus on benefits, not tech */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight">
            Never wonder
            <span className="block text-primary"> "does this suit me?"</span>
            again.
          </h1>

          {/* Subheadline - Clear value prop */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Get personalized outfit recommendations tailored to your body, style, and budget. 
            See how clothes look on you before you buy — with AI that understands fashion.
          </p>

          {/* Primary CTAs - Don't require wallet */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25"
            >
              <Camera className="w-5 h-5 mr-2" />
              Try Virtual Fitting
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="font-bold px-8 py-6 rounded-full text-lg"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Chat with Stylist
            </Button>
          </div>

          {/* Social proof / Trust signals */}
          <div className="pt-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-background" />
                ))}
              </div>
              <span>Join 10,000+ people dressing smarter</span>
            </div>
            
            {/* Non-intimidating feature list */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>No account needed</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Works with any photo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable "Learn More" section - Progressive disclosure */}
        <div className="mt-12 text-center">
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

      {/* Advanced Features Toggle - Hidden by default */}
      <AdvancedFeaturesToggle />
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

/**
 * AdvancedFeaturesToggle - Progressive disclosure for power users / web3 features
 * Hidden behind a subtle toggle, not front and center
 */
function AdvancedFeaturesToggle() {
  return (
    <div className="container mx-auto px-4 pb-8">
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 list-none">
          <Zap className="w-3 h-3" />
          <span>Show advanced features</span>
        </summary>
        <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-dashed border-border">
          <p className="text-xs text-muted-foreground text-center">
            Advanced features include AI agent wallet, NFT style proofs, and crypto rewards. 
            These are optional and can be enabled when you're ready.
          </p>
        </div>
      </details>
    </div>
  );
}
