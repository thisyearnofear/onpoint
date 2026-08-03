"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  KeyRound,
  Lock,
  MessageCircle,
  Palette,
  ScanFace,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { trackHomepageCta } from "../../lib/utils/analytics";
import { captureReferralFromURL } from "../../lib/utils/referral";
import { CTA_SHOP, CTA_SUPPLY, HERO, PRODUCT_NAME } from "../../lib/brand";
import { HeroVisual } from "./HeroVisual";
import { AgentFlow } from "../Agent/AgentFlow";
import { PravaEvidenceReceipt } from "../Agent/PravaEvidenceReceipt";

const journey = [
  {
    icon: Search,
    number: "01",
    label: "Product",
    copy: "Find live inventory.",
  },
  { icon: ScanFace, number: "02", label: "Fit", copy: "See it on you." },
  {
    icon: ShieldCheck,
    number: "03",
    label: "Permission",
    copy: "Approve one exact scope.",
  },
  { icon: Clock3, number: "04", label: "Outcome", copy: "Know what happened." },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-border/40 bg-background"
    >
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                The OnPoint rule
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Fit before permission.
              </h2>
            </div>
          </Reveal>

          <div className="mt-9 grid gap-px overflow-hidden rounded-3xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map(({ icon: Icon, number, label, copy }, index) => (
              <Reveal key={label} delay={index * 0.07} className="h-full">
                <article className="group h-full bg-card p-5 transition-colors hover:bg-muted/20 md:p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-primary">
                      {number}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <h3 className="mt-7 text-lg font-bold">{label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <details className="group mx-auto mt-6 max-w-2xl rounded-2xl border border-border/50 bg-muted/15">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Why permission comes after fit
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="border-t border-border/40 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              A shopping agent should not request spend access before the
              shopper has seen the garment and the complete price. OnPoint keeps
              approval hidden until try-on—or an explicit decision to continue
              without it.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section
      id="proof"
      className="scroll-mt-20 border-t border-border/40 bg-muted/15"
    >
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Proof, not promises
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Successful on Prava.
                <br />
                Honest at the merchant boundary.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Prava confirmed the sandbox transaction. When the later merchant
                result became unknowable, OnPoint stopped and said so.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <PravaEvidenceReceipt />
          </Reveal>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <details className="group rounded-2xl border border-border/50 bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4 text-blue-500" />
                  How Linq fits
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="border-t border-border/40 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                Linq carries status in iMessage through signed webhooks, a live
                card and 👍 refresh. Prava’s hosted surface still owns approval.
              </p>
            </details>
            <details className="group rounded-2xl border border-border/50 bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="h-4 w-4 text-amber-500" />
                  The trust rule
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="border-t border-border/40 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                Unknown is a real outcome—not a euphemism for failure, approval
                or decline. A one-time credential is never retried blindly.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformDisclosure() {
  const paths = [
    {
      icon: Users,
      label: "Shoppers",
      copy: "Try on curated inventory.",
      href: "/lab?tab=try-on&from=nia",
    },
    {
      icon: Store,
      label: "Curators",
      copy: "Publish agent-ready supply.",
      href: CTA_SUPPLY.onboardHref,
    },
    {
      icon: Code2,
      label: "Developers",
      copy: "Build on the commerce graph.",
      href: "/developers",
    },
  ];

  return (
    <section className="border-t border-border/40 bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
        <details className="group rounded-3xl border border-border/60 bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden md:px-8">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                More OnPoint
              </p>
              <h2 className="mt-1 text-xl font-bold md:text-2xl">
                One supply graph. More ways in.
              </h2>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-px border-t border-border/50 bg-border/50 md:grid-cols-3">
            {paths.map(({ icon: Icon, label, copy, href }) => (
              <Link
                key={label}
                href={href}
                className="group/link flex items-center gap-3 bg-card p-5 transition-colors hover:bg-muted/25 md:p-6"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold">{label}</h3>
                  <p className="text-xs text-muted-foreground">{copy}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover/link:translate-x-1" />
              </Link>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

export function HeroView() {
  useEffect(() => {
    captureReferralFromURL();
  }, []);

  const heroCtaRef = React.useRef<HTMLDivElement | null>(null);
  const [heroCtaInView, setHeroCtaInView] = React.useState(true);

  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroCtaInView(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),transparent_38%,hsl(var(--accent)/0.05))]" />
        <div className="absolute inset-0 -z-10 opacity-[0.2] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="text-center lg:text-left">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Bot className="h-3.5 w-3.5" />
                  {HERO.eyebrow}
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-[4.1rem]">
                  {HERO.headline}
                  <span className="mt-1 block text-primary">
                    {HERO.headlineAccent}
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={0.16}>
                <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                  {HERO.subcopy}
                </p>
              </Reveal>
              <Reveal delay={0.24}>
                <div
                  ref={heroCtaRef}
                  className="mt-7 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
                >
                  <Link
                    href={CTA_SHOP.href}
                    onClick={() =>
                      trackHomepageCta({ cta: "shop", placement: "hero" })
                    }
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                  >
                    Try the live agent
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#proof"
                    className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    <KeyRound className="h-4 w-4" />
                    See verified proof
                  </a>
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  No payment session before the fit decision.
                </p>
              </Reveal>
            </div>
            <Reveal direction="right" delay={0.1}>
              <HeroVisual />
            </Reveal>
          </div>
        </div>
      </section>

      <section
        id="agent-search"
        className="scroll-mt-20 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_42%)]"
      >
        <div className="container mx-auto px-4 py-14 md:py-20">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <div className="mb-7 text-center">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                  Live UCP discovery
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                  Find the product.
                  <br />
                  Then earn permission.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                  Try “black Alo Yoga leggings under $130.” Search creates no
                  payment session.
                </p>
              </div>
            </Reveal>
            <AgentFlow />
          </div>
        </div>
      </section>

      <HowItWorks />
      <ProofSection />
      <PlatformDisclosure />

      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            {PRODUCT_NAME}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#agent-search" className="hover:text-foreground">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#proof" className="hover:text-foreground">
              Proof
            </a>
            <Link href="/developers" className="hover:text-foreground">
              Developers
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">
            Earn permission. Report truth.
          </p>
        </div>
      </footer>

      <div
        className={`fixed bottom-4 left-4 right-4 z-40 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out md:hidden ${heroCtaInView ? "translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}
        aria-hidden={heroCtaInView}
      >
        <a
          href="#agent-search"
          onClick={() =>
            trackHomepageCta({ cta: "shop", placement: "mobile_sticky" })
          }
          className="block w-full rounded-full bg-primary py-4 text-center font-bold text-white shadow-xl shadow-primary/25 active:scale-[0.98]"
        >
          Try the live agent
        </a>
      </div>
    </div>
  );
}
