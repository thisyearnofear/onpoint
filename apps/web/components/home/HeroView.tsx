"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Code2,
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
import { CTA_PLAY, CTA_SUPPLY, PRODUCT_NAME } from "../../lib/brand";
import { WardrobeWorkspace } from "../wardrobe/WardrobeWorkspace";
import { HomeSections } from "./HomeSections";
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
  const footerRef = React.useRef<HTMLElement | null>(null);
  const [hideCtaPill, setHideCtaPill] = React.useState(true);

  useEffect(() => {
    const targets = [
      heroCtaRef.current,
      document.getElementById("try-it"),
      document.getElementById("agent-search"),
      footerRef.current,
    ].filter(Boolean) as Element[];
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (ents) => {
        for (const e of ents) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setHideCtaPill(visible.size > 0);
      },
      { threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div ref={heroCtaRef}>
        <WardrobeWorkspace />
      </div>

      <HomeSections />

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

      <footer ref={footerRef} className="border-t border-border/60 py-8">
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
        className={`fixed bottom-4 left-1/2 z-40 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out md:hidden ${hideCtaPill ? "translate-y-24 opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-hidden={hideCtaPill}
      >
        <Link
          href={CTA_PLAY.href}
          onClick={() =>
            trackHomepageCta({ cta: "play", placement: "mobile_sticky" })
          }
          className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-6 text-center text-sm font-bold text-white shadow-xl shadow-primary/25 active:scale-[0.98]"
        >
          {CTA_PLAY.mobileLabel} ›
        </Link>
      </div>
    </div>
  );
}
