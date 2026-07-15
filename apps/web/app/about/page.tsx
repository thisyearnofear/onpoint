"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  MessageCircle,
  Palette,
  Store,
} from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { ComingSoonBadge } from "../../components/ui/ComingSoonBadge";
import { OnPointHeader, OnPointFooter } from "../../components/OnPointHeader";
import { PRODUCT_NAME } from "../../lib/brand";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <OnPointHeader />

      {/* Hero */}
      <Reveal>
        <section className="border-b border-border bg-gradient-to-b from-card to-background">
          <div className="mx-auto max-w-3xl px-4 py-16 md:py-20 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Palette className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
              Fit before you buy —{" "}
              <span className="text-primary">for people and agents.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              OnPoint is the execution layer for fashion intent that needs fit, real stock,
              and local pay. Curators bring inventory; humans and agents buy from the same catalog.
            </p>
          </div>
        </section>
      </Reveal>

      {/* Mission — one paragraph, not two */}
      <Reveal>
        <section className="border-b border-border py-14 md:py-18">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Our mission</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Fashion commerce in emerging markets runs on WhatsApp and Instagram — not on
              expensive e-commerce platforms built for Western markets. Every &ldquo;will this fit?&rdquo;
              question costs time, and every sizing hesitation risks a lost sale. OnPoint bridges
              that gap with AI try-on, polaroid sharing, and structured agent commerce on the same
              inventory. Fit signal + truthful catalog + local settlement is the product.
            </p>
          </div>
        </section>
      </Reveal>

      {/* How it works — three pillars, tighter copy */}
      <Reveal>
        <section className="border-b border-border bg-card/50 py-14 md:py-18">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl text-center">Three pillars</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                icon: <Store className="h-6 w-6" />,
                title: "One catalog, two clients",
                body: "Every curator gets a storefront for humans and a machine-readable API for agents — same listings, stock, and brand.",
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "Fit rail (try-on)",
                body: "Try before you buy. Size/fit signals cut hesitation; polaroids turn sessions into shareable proof.",
              },
              {
                icon: <MessageCircle className="h-6 w-6" />,
                title: "Local + agent settlement",
                body: "Humans close on WhatsApp and M-Pesa. Agents pay via x402/cUSD with curator payouts.",
                badge: <ComingSoonBadge size="xs" label="WhatsApp API" />,
              },
            ].map((pillar) => (
              <div key={pillar.title} className="relative pl-6 border-l-2 border-primary/20">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                  {pillar.icon}
                </div>
                <h3 className="font-bold flex items-center gap-2">
                  {pillar.title}
                  {pillar.badge}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Story — condensed from 3 paragraphs to 1 */}
      <Reveal>
        <section className="border-b border-border py-14 md:py-18">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Our story</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            OnPoint started as hackathon experiments — AI try-on, on-chain agent wallets on Celo,
            IPFS storage. The breakthrough was the curator primitive: the same AI styling session
            that serves a shopper also generates structured intelligence for the seller. Today,
            {" "}{PRODUCT_NAME} is live with curators in Kenya across sportswear, streetwear, Ankara,
            vintage, and formal wear. We&rsquo;re developer-owned, fee-free, and focused on making
            fashion commerce work for the markets that legacy platforms ignore.
          </p>
        </div>
      </section>
      </Reveal>

      {/* Team / Identity */}
      <Reveal>
        <section className="border-b border-border bg-card/50 py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">Built by builders</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            {PRODUCT_NAME} is an independent, developer-owned project. We believe the best
            tools for emerging-market commerce come from builders who understand the
            constraints: mobile-first, fee-free, and built for the seller who hustles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              No subscription fees
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              AI-powered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              Open-source ethos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              On Celo blockchain
            </span>
          </div>
        </div>
      </section>
      </Reveal>

      {/* CTA */}
      <Reveal>
        <section className="py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Ready to see it in action?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Browse live storefronts and try on, or onboard inventory into the supply graph.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/lab?tab=try-on&from=nia"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl"
            >
              <Camera className="h-4 w-4" />
              Try on & shop
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/curator/onboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-bold transition-colors hover:bg-card"
            >
              <Store className="h-4 w-4" />
              Add your inventory
            </Link>
          </div>
        </div>
      </section>
      </Reveal>

      {/* Footer */}
      <OnPointFooter />
    </main>
  );
}
