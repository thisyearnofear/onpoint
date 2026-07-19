"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Check,
  Camera,
  Bot,
  Store,
  Wallet,
  Image as ImageIcon,
  Palette,
  MessageCircle,
} from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { ComingSoonBadge } from "../ui/ComingSoonBadge";
import { FeedbackLink } from "../ui/FeedbackLink";
import { LiveCounter } from "../LiveCounter";
import { trackHomepageCta } from "../../lib/utils/analytics";
import { captureReferralFromURL } from "../../lib/utils/referral";
import {
  CTA_SHOP,
  CTA_SUPPLY,
  CTA_LAB,
  HERO,
  PRODUCT_NAME,
} from "../../lib/brand";
import { WelcomeBackBanner } from "./WelcomeBackBanner";
import { DemoWalkthrough } from "./DemoWalkthrough";
import { HeroVisual } from "./HeroVisual";
import { LookCrafter } from "./LookCrafter";
import { EditorialStats } from "./EditorialStats";
import { RecentlySavedSection } from "./RecentlySavedSection";
import { AgentActivityFeed } from "../AgentActivityFeed";
import { LiveCommerceProof } from "./LiveCommerceProof";
import { NiaPreviewGrid } from "./NiaPreviewGrid";

export function HeroView() {
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    captureReferralFromURL();
  }, []);

  // Show the floating mobile CTA only when the hero CTA has scrolled out of view.
  // Default to `true` (visible) so the button stays hidden until the observer confirms
  // the hero CTA is offscreen — avoids a flash of the floating button on load.
  const heroCtaRef = React.useRef<HTMLDivElement | null>(null);
  const [heroCtaInView, setHeroCtaInView] = React.useState(true);
  React.useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setHeroCtaInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Welcome Back Banner */}
      <div className="container mx-auto px-4 pt-6">
        <WelcomeBackBanner />
      </div>

      {/* Demo Walkthrough */}
      {showDemo && <DemoWalkthrough onClose={() => setShowDemo(false)} />}

      <div className="relative container mx-auto px-4 py-12 md:py-20 lg:py-24 bg-gradient-to-b from-primary/[0.03] via-background to-background bg-[length:200%_200%] animate-gradient-shift">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left space-y-6">
              <Reveal delay={0}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>{HERO.eyebrow}</span>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                  {HERO.headline}
                  <span className="block text-primary">
                    {HERO.headlineAccent}
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.2}>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                  {HERO.subcopy}
                </p>
              </Reveal>

              <Reveal delay={0.3}>
                <div
                  ref={heroCtaRef}
                  className="flex flex-col sm:flex-row items-center lg:items-start gap-3"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <FeedbackLink
                      href={CTA_SHOP.href}
                      onClick={() =>
                        trackHomepageCta({ cta: "shop", placement: "hero" })
                      }
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/25 transition-[background-color,transform]"
                    >
                      <Camera className="w-5 h-5" />
                      {CTA_SHOP.label}
                      <ArrowRight className="w-5 h-5" />
                    </FeedbackLink>
                    <p className="text-[11px] text-muted-foreground/70 text-center max-w-[280px]">
                      Try on AI designs from Nia — free, no wallet required
                    </p>
                  </div>
                  <Link
                    href="/developers"
                    onClick={() =>
                      trackHomepageCta({ cta: "developers", placement: "hero" })
                    }
                    className="inline-flex items-center gap-2 border border-border hover:bg-muted/50 active:scale-[0.98] font-bold px-6 py-6 rounded-full text-base transition-[background-color,transform]"
                  >
                    <Bot className="w-5 h-5" />
                    For agents
                  </Link>
                  <Link
                    href={CTA_SUPPLY.onboardHref}
                    onClick={() =>
                      trackHomepageCta({ cta: "supply", placement: "hero" })
                    }
                    className="inline-flex items-center gap-2 border border-border hover:bg-muted/50 active:scale-[0.98] font-bold px-6 py-6 rounded-full text-base transition-[background-color,transform]"
                  >
                    <Store className="w-5 h-5" />
                    {CTA_SUPPLY.onboardLabel}
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.4}>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>No wallet before first try-on</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>WhatsApp / M-Pesa ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>Same catalog for agents</span>
                  </div>
                  <LiveCounter />
                </div>
              </Reveal>

              {/* Sample AI output — mobile preview */}
              <Reveal delay={0.4} className="lg:hidden">
                <div className="mt-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.04] to-accent/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Sample fit signal
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black text-primary">8/10</div>
                    <div className="flex-1 text-xs text-muted-foreground leading-relaxed">
                      &ldquo;Strong color coordination. The oversized silhouette works well with your frame. Consider a structured bag to balance the proportions.&rdquo;
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">✓ Color Harmony</span>
                    <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">✓ Fit</span>
                    <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-medium">↑ Accessories</span>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right: Visual — desktop only */}
            <Reveal direction="right" delay={0.15} className="relative hidden lg:block">
              <HeroVisual />
            </Reveal>
          </div>
        </div>
      </div>

      <LiveCommerceProof />

      {/* How It Works — 30-second explainer */}
      <section className="border-t border-border/30 bg-background">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                How it works
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Try on before you buy — in 30 seconds
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute top-0 right-1/2 transform translate-x-16 -translate-y-2 w-6 h-6 rounded-full bg-success flex items-center justify-center text-white text-xs font-bold">
                    1
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2">Upload your photo</h3>
                <p className="text-sm text-muted-foreground">
                  Take a selfie or upload a photo. No wallet or account needed.
                </p>
              </div>

              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute top-0 right-1/2 transform translate-x-16 -translate-y-2 w-6 h-6 rounded-full bg-success flex items-center justify-center text-white text-xs font-bold">
                    2
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2">AI tries it on you</h3>
                <p className="text-sm text-muted-foreground">
                  See yourself in the outfit. Get fit recommendations and style notes.
                </p>
              </div>

              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute top-0 right-1/2 transform translate-x-16 -translate-y-2 w-6 h-6 rounded-full bg-success flex items-center justify-center text-white text-xs font-bold">
                    3
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  Order via WhatsApp
                  <ComingSoonBadge size="xs" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  Share your try-on with the curator. Confirm size, stock, and delivery.
                </p>
              </div>
            </div>

            <div className="mt-12 text-center">
              <FeedbackLink
                href={CTA_SHOP.href}
                onClick={() => trackHomepageCta({ cta: "shop", placement: "how_it_works" })}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-8 py-4 rounded-full text-base shadow-lg shadow-primary/25 transition-all"
              >
                <Camera className="w-5 h-5" />
                Try it now — it&apos;s free
                <ArrowRight className="w-5 h-5" />
              </FeedbackLink>
              <p className="mt-3 text-xs text-muted-foreground">
                No wallet required · Takes 30 seconds · Free try-on
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Activity Feed — shows live proof of agent commerce */}
      <section className="border-t border-border/30 bg-muted/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <AgentActivityFeed />
        </div>
      </section>

      {/* Recently Saved — shown when user has saved looks */}
      <RecentlySavedSection />

      {/* Dual-client pitch — supply + demand before LookCrafter */}
      <Reveal>
        <section className="border-t border-border/30">
          <div className="container mx-auto px-4 py-10 md:py-14">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <p className="text-lg md:text-xl font-light tracking-tight text-foreground">
                Sell on WhatsApp?{" "}
                <Link
                  href={CTA_SUPPLY.href}
                  onClick={() =>
                    trackHomepageCta({ cta: "supply", placement: "pitch" })
                  }
                  className="font-bold text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/30"
                >
                  Put your inventory on OnPoint
                </Link>
                {" "}— AI try-on, polaroids, M-Pesa. Agents can buy the same stock.
              </p>
              <p className="text-sm text-muted-foreground">
                Prefer to shop first?{" "}
                <Link
                  href={CTA_SHOP.href}
                  onClick={() =>
                    trackHomepageCta({ cta: "shop", placement: "pitch" })
                  }
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Browse live storefronts
                </Link>
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Craft a Look — interactive lead magnet */}
      <LookCrafter />

      {/* Editorial Stats */}
      <EditorialStats />

      {/* Digital Fashion Showcase */}
      <section className="bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.04),transparent_70%)] border-t border-border/30">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Reveal>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-bold text-accent uppercase tracking-wider mb-4">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Digital Fashion
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                    AI-generated designs.
                    <span className="block text-accent">Own the original.</span>
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    Nia is our first AI curator, generating avant-garde African football culture designs. Try on digital pieces, mint as NFTs, earn royalties.
                  </p>
                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Camera className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Try-on for $0.03</p>
                        <p className="text-xs text-muted-foreground">See how digital pieces look on you before buying</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Sparkles className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Mint as NFT for $0.10</p>
                        <p className="text-xs text-muted-foreground">85% to creator, 15% to platform via 0xSplits</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Wallet className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Earn royalties</p>
                        <p className="text-xs text-muted-foreground">Every resale generates income for the original creator</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <Link
                      href="/s/nia"
                      className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors"
                    >
                      Explore Nia&apos;s collection
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="relative">
                  <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] to-background p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <span className="text-white font-bold text-sm">NIA</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">Nia Digital</p>
                          <p className="text-xs text-muted-foreground">AI Curator · 8 listings</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] font-bold text-success dark:text-emerald-400">Live</span>
                      </div>
                    </div>
                    <NiaPreviewGrid />
                    <div className="flex items-center justify-between pt-3 border-t border-accent/10">
                      <div>
                        <p className="text-xs text-muted-foreground">Royalty split</p>
                        <p className="font-bold text-sm">85 / 15</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">NFT mint</p>
                        <p className="font-bold text-sm">$0.10</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Commerce Section */}
      <section className="bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_60%)] border-t border-border/30">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-4">
                  <Bot className="w-3.5 h-3.5" />
                  Agent Commerce
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                  Same inventory for humans and agents
                </h2>
                <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                  Agents browse the same curator storefronts, try on the same items, and pay via x402 facilitator with gasless USDC on Celo.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid md:grid-cols-3 gap-4">
                {/* x402 Payment Flow */}
                <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-primary/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold">x402 Payment</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Agents sign EIP-3009 authorization. Facilitator settles on-chain (gasless for buyer). Attribution tags on every transaction.
                  </p>
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tokens</p>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium">cUSD</span>
                      <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium">USDC</span>
                    </div>
                  </div>
                </div>

                {/* Digital Fashion */}
                <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-accent/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-accent" />
                    <h3 className="text-sm font-bold">Digital Fashion</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI curators like Nia generate digital-only designs. Try-on renders via Venice API. NFT minting with 85/15 royalty split.
                  </p>
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Pricing</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-primary">$0.03</span>
                      <span className="text-[10px] text-muted-foreground">/ try-on</span>
                    </div>
                  </div>
                </div>

                {/* Attribution & Leaderboard */}
                <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-emerald-500/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-success" />
                    <h3 className="text-sm font-bold">Hackathon Ready</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dual attribution tags on every transaction. Agent registry integration. Live leaderboard tracking.
                  </p>
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tracks</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success text-[10px] font-medium">x402 Payments</span>
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success text-[10px] font-medium">Revenue</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 text-center">
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  Agent integration guide
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            {PRODUCT_NAME}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href={CTA_SHOP.href}
              onClick={() => trackHomepageCta({ cta: "shop", placement: "footer" })}
              className="hover:text-foreground transition-colors"
            >
              Shop
            </Link>
            <Link
              href={CTA_SUPPLY.href}
              onClick={() => trackHomepageCta({ cta: "supply", placement: "footer" })}
              className="hover:text-foreground transition-colors"
            >
              Supply
            </Link>
            <Link
              href={CTA_LAB.href}
              onClick={() => trackHomepageCta({ cta: "lab", placement: "footer" })}
              className="hover:text-foreground transition-colors"
            >
              Lab
            </Link>
            <Link href="/guides" className="hover:text-foreground transition-colors">Guides</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs">Fit before you buy.</p>
        </div>
      </footer>

      {/* Mobile Continue Button — only shows once the hero CTA scrolls out of view */}
      <div
        className={`fixed bottom-4 left-4 right-4 md:hidden z-40 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out ${
          heroCtaInView
            ? "translate-y-24 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
        aria-hidden={heroCtaInView}
      >
        <Link
          href={CTA_SHOP.href}
          onClick={() =>
            trackHomepageCta({ cta: "shop", placement: "mobile_sticky" })
          }
          className="block w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg text-center active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
        >
          {CTA_SHOP.mobileLabel}
        </Link>
      </div>
    </div>
  );
}
