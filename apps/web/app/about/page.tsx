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
              and local pay. Curators bring inventory; humans and agents buy from the same
              catalog — try-on first, WhatsApp/M-Pesa or on-chain checkout.
            </p>
          </div>
        </section>
      </Reveal>

      {/* Mission */}
      <Reveal>
        <section className="border-b border-border py-14 md:py-18">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Our mission</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Fashion commerce in emerging markets runs on WhatsApp and Instagram — not on
              expensive e-commerce platforms built for Western markets. Sellers take photos
              with their phones, post to their status, and manage orders manually through
              messages. It works, but every &ldquo;will this fit?&rdquo; question costs time,
              and every sizing hesitation risks a lost sale.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              OnPoint bridges that gap — and makes the same inventory reachable by AI agents.
              Sellers get a branded storefront with virtual try-on so buyers see fit before
              they commit. Polaroids turn try-ons into shareable marketing. Humans check out
              on WhatsApp/M-Pesa; agents use structured offers and paid try-on on the same
              stock. Fit signal + truthful catalog + local settlement is the product.
            </p>
          </div>
        </section>
      </Reveal>

      {/* How it works — three-pillar */}
      <Reveal>
        <section className="border-b border-border bg-card/50 py-14 md:py-18">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl text-center">Three pillars</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                icon: <Store className="h-6 w-6" />,
                title: "One catalog, two clients",
                body: "Every curator gets /s/yourslug for humans and a machine-readable storefront for agents — same listings, stock, and brand. Inventory can land via WhatsApp: photo in, live SKU out.",
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "Fit rail (try-on)",
                body: "People and agents try before they buy. Size/fit signals cut hesitation; polaroids turn sessions into shareable proof. Digital designs route to similar physical stock.",
              },
              {
                icon: <MessageCircle className="h-6 w-6" />,
                title: "Local + agent settlement",
                body: "Humans close on WhatsApp and M-Pesa. Agents pay via x402/cUSD with curator payouts. Same commerce loop — transport matches the buyer.",
              },
            ].map((pillar) => (
              <div key={pillar.title} className="relative pl-6 border-l-2 border-primary/20">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                  {pillar.icon}
                </div>
                <h3 className="font-bold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Story */}
      <Reveal>
        <section className="border-b border-border py-14 md:py-18">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Our story</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            OnPoint started as a series of hackathon experiments running in parallel — AI
            try-on, Bright Data web intelligence, on-chain agent wallets on Celo, IPFS
            storage through Protocol Labs. Each piece worked in isolation. The challenge
            was turning a collection of demos into a coherent product that actually solves
            a real problem for real sellers.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The breakthrough was the curator primitive — the realization that the same AI
            styling session that serves a shopper also generates structured intelligence
            for the seller: product gaps when the catalog can&rsquo;t match, competitor
            pricing from the open web, demand signals extracted from actual shopper intent.
            Stylists hand customers a branded try-on → polaroid → share → buy loop, and
            every session generates live retail intelligence on the back end.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Today, {PRODUCT_NAME} is live with curators in Kenya across sportswear, streetwear,
            Ankara, vintage, and formal wear — each with their own branded storefront,
            AI try-on, and WhatsApp checkout. We&rsquo;re developer-owned, fee-free,
            and focused entirely on making fashion commerce work for the markets that
            legacy platforms ignore.
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
            constraints: mobile-first, WhatsApp-native, fee-free, and built for the
            seller who hustles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              No platform fees
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              WhatsApp-native
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              AI-powered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              Open-source ethos
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
              href="/curators"
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
