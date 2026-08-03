"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
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
import { LiveCommerceProof } from "./LiveCommerceProof";

const journey = [
  {
    icon: Search,
    number: "01",
    label: "Product",
    title: "Discover what is actually available",
    copy: "Search live Prava UCP inventory across real merchants, with current variants and prices.",
  },
  {
    icon: ScanFace,
    number: "02",
    label: "Fit",
    title: "Check the garment before permission",
    copy: "Try it on with your photo—or explicitly continue without one. Approval stays locked until you decide.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    label: "Permission",
    title: "Approve an exact commercial scope",
    copy: "See item, shipping, tax and the requested ceiling before Prava creates a permission session.",
  },
  {
    icon: Clock3,
    number: "04",
    label: "Outcome",
    title: "Know exactly what happened",
    copy: "Credentials stay server-side. Success, decline and unknown outcomes remain visibly different.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-border/40 bg-background"
    >
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
                  How it works
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                  Permission is a step.
                  <br />
                  Not a footnote.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:justify-self-end md:text-lg">
                Most shopping agents collapse intent, approval and payment into
                one opaque action. OnPoint makes each boundary visible and
                reversible until permission is granted.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border/60 bg-border/60 md:grid-cols-2 lg:grid-cols-4">
            {journey.map(
              ({ icon: Icon, number, label, title, copy }, index) => (
                <Reveal key={label} delay={index * 0.08} className="h-full">
                  <article className="group h-full bg-card p-6 transition-colors hover:bg-muted/20 md:p-7">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary">
                        {number} / {label.toUpperCase()}
                      </span>
                      <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <h3 className="mt-8 text-lg font-bold leading-snug">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {copy}
                    </p>
                  </article>
                </Reveal>
              ),
            )}
          </div>
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
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
                Verifiable proof
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                A successful Prava transaction.
                <br />
                An honest merchant boundary.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                Prava confirmed that{" "}
                <span className="font-mono text-foreground">
                  Creds_Generated
                </span>{" "}
                counts as a successful sandbox transaction. The later merchant
                checkout became unknowable, so OnPoint stopped safely and said
                exactly that.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
            <Reveal>
              <PravaEvidenceReceipt />
            </Reveal>
            <div className="space-y-5">
              <Reveal delay={0.08}>
                <aside className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                      Live Linq
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold">
                    Commerce status in the conversation
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Signed Linq webhooks, message-native status cards and a 👍
                    status refresh are independently validated. Approval still
                    happens on Prava’s hosted surface.
                  </p>
                  <div className="mt-5 border-t border-border/50 pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Live send · signed webhook · deduplicated events
                  </div>
                </aside>
              </Reveal>

              <Reveal delay={0.14}>
                <aside className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] p-6">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Lock className="h-4 w-4" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                      Trust rule
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-relaxed">
                    Unknown is a real outcome—not a euphemism for failure,
                    approval or decline.
                  </p>
                </aside>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  const paths = [
    {
      icon: Users,
      label: "For shoppers",
      title: "Try on curated inventory",
      copy: "Use OnPoint’s fitting room and continue through local WhatsApp and M-Pesa commerce.",
      href: "/lab?tab=try-on&from=nia",
      cta: "Open fitting room",
    },
    {
      icon: Store,
      label: "For curators",
      title: "Turn inventory into agent-ready supply",
      copy: "Publish a storefront, accept local orders and expose the same catalog to software agents.",
      href: CTA_SUPPLY.onboardHref,
      cta: "Create storefront",
    },
    {
      icon: Code2,
      label: "For developers",
      title: "Build on the commerce graph",
      copy: "Browse inventory, run paid try-ons and complete controlled transactions through documented APIs.",
      href: "/developers",
      cta: "Read developer docs",
    },
  ];

  return (
    <section className="border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
                Built on OnPoint
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                One supply graph. Three ways in.
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Agent commerce is the new front door. The existing shopper,
              curator and developer products remain underneath it.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {paths.map(({ icon: Icon, label, title, copy, href, cta }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-3xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </p>
                <h3 className="mt-2 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {copy}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  {cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
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
        <div className="absolute inset-0 -z-10 opacity-[0.22] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="container mx-auto px-4 py-14 md:py-20 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="text-center lg:text-left">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Bot className="h-3.5 w-3.5" />
                  {HERO.eyebrow}
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl">
                  {HERO.headline}
                  <span className="mt-1 block text-primary">
                    {HERO.headlineAccent}
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                  {HERO.subcopy}
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div
                  ref={heroCtaRef}
                  className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start"
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
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-border bg-background/70 px-7 text-base font-bold backdrop-blur transition-colors hover:bg-muted/60"
                  >
                    <KeyRound className="h-4 w-4" />
                    See sandbox proof
                  </a>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <div className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:justify-start">
                  {[
                    "Live UCP",
                    "Binding quote",
                    "Exact scope",
                    "Truthful outcome",
                  ].map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Check className="h-3 w-3 text-primary" />
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal direction="right" delay={0.12}>
              <HeroVisual />
            </Reveal>
          </div>
        </div>
        <LiveCommerceProof />
      </section>

      <section
        id="agent-search"
        className="scroll-mt-20 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_42%)]"
      >
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live product discovery
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Start with the product.
                  <br />
                  Earn the permission.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Search real Prava UCP inventory. Try “black Alo Yoga leggings
                  under $130” to replay the verified discovery path without
                  initiating a payment session.
                </p>
              </div>
            </Reveal>
            <AgentFlow />
          </div>
        </div>
      </section>

      <HowItWorks />
      <ProofSection />
      <PlatformSection />

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
            <Link href="/about" className="hover:text-foreground">
              About
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
        className={`fixed bottom-4 left-4 right-4 z-40 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out md:hidden ${
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
          className="block w-full rounded-full bg-primary py-4 text-center font-bold text-white shadow-xl shadow-primary/25 active:scale-[0.98]"
        >
          Try the live agent
        </a>
      </div>
    </div>
  );
}
