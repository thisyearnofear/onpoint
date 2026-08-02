"use client";

import React, { useEffect } from "react";
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
import { HeroVisual } from "./HeroVisual";
import { LookCrafter } from "./LookCrafter";
import { EditorialStats } from "./EditorialStats";
import { RecentlySavedSection } from "./RecentlySavedSection";
import { AgentActivityFeed } from "../AgentActivityFeed";
import { AgentFlow } from "../Agent/AgentFlow";
import { LiveCommerceProof } from "./LiveCommerceProof";
import { NiaPreviewGrid } from "./NiaPreviewGrid";

/**
 * HowItWorks — the 3-step "try on before you buy" explainer content.
 * Extracted so the home page can render it open on desktop and as a
 * collapsed <details> accordion on mobile (progressive disclosure: shoppers
 * see merchandise first, the story on demand).
 */
function HowItWorks() {
  return (
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
          <h3 className="text-lg font-bold mb-2 flex items-center justify-center gap-2">
            Order via WhatsApp
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
  );
}

export function HeroView() {
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-sm font-medium">
                      <Check className="w-4 h-4" />
                      Free · No wallet required
                    </span>
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
                    How try-on works
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black text-primary">1-2-3</div>
                    <div className="flex-1 text-xs text-muted-foreground leading-relaxed">
                      Upload a photo, see yourself in the outfit, then order via WhatsApp. No wallet needed to start.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">✓ Free try-on</span>
                    <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">✓ Fit signal</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">→ WhatsApp order</span>
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

      {/* Agent flow — the front door. Search live UCP products, try on, and
          open a scoped Prava payment session inline. */}
      <section id="agent-search" className="scroll-mt-20 border-t border-border/30 bg-gradient-to-b from-background to-muted/10">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-3">
                <Bot className="w-3.5 h-3.5" />
                Agent Commerce
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                Search, try on, and prepare checkout — via API
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search a style. The agent discovers live products, tries them on you, and prepares a scoped Prava session for your approval.
              </p>
            </div>
            <AgentFlow />
          </div>
        </div>
      </section>

      {/* How It Works — desktop: always open. Mobile: collapsed <details>
          (progressive disclosure — shoppers see items first, the story on demand). */}
      <section className="hidden lg:block border-t border-border/30 bg-background">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <HowItWorks />
        </div>
      </section>
      <details className="group lg:hidden border-t border-border/30 bg-background">
        <summary className="container mx-auto px-4 py-5 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-base font-bold">How it works — try on before you buy</span>
          <ArrowRight className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="container mx-auto px-4 pb-12">
          <HowItWorks />
        </div>
      </details>

      {/* Agent Activity Feed — shows live proof of agent commerce */}
      <section className="border-t border-border/30 bg-muted/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <AgentActivityFeed />
        </div>
      </section>

      {/* Recently Saved — shown when user has saved looks */}
      <RecentlySavedSection />

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

      {/* Style Explorer — secondary interactive, not a hero feature.
          Lives below the digital fashion showcase for users who want
          to play with vibes and personas before trying real inventory. */}
      <LookCrafter />

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
        <a
          href="#agent-search"
          onClick={() =>
            trackHomepageCta({ cta: "shop", placement: "mobile_sticky" })
          }
          className="block w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg text-center active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
        >
          Try the agent
        </a>
      </div>
    </div>
  );
}
