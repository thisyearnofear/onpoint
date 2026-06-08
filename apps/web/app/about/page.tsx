import Link from "next/link";
import type { Metadata } from "next";
import { Palette, Camera, Store, MessageCircle, ArrowRight, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "About | BeOnPoint",
  description:
    "BeOnPoint is a curator-first AI fashion studio — a multiplatform ecosystem for personalized styling, fashion discovery, and digital ownership for emerging-market fashion sellers.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            BeOnPoint
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/curator"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              For Curators
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" />
              Try It Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Palette className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
            Style commerce for{" "}
            <span className="text-primary">everyone.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            BeOnPoint gives fashion sellers in emerging markets a branded storefront
            with AI try-on, WhatsApp checkout, and retail intelligence — no coding,
            no app store, no platform fees.
          </p>
        </div>
      </section>

      {/* Mission */}
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
            BeOnPoint bridges that gap. We give sellers a branded storefront with AI-powered
            virtual try-on so customers can see how items look before they buy. Each try-on
            generates a shareable polaroid — free marketing for the seller. Checkout happens
            on WhatsApp, the channel customers already use. And every session generates
            structured retail intelligence: what&rsquo;s trending, what&rsquo;s missing from
            the catalog, and where the market is moving.
          </p>
        </div>
      </section>

      {/* How it works — three-pillar */}
      <section className="border-b border-border bg-card/50 py-14 md:py-18">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl text-center">Three pillars</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Store className="h-6 w-6" />,
                title: "Curator storefronts",
                body: "Every seller gets a branded /s/yourslug page with their colors, logo, and voice — no coding, no CMS. Inventory is added via WhatsApp: send a photo and the agent creates a live listing.",
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "AI try-on & polaroids",
                body: "Customers upload a photo and see how any item fits their body type. Every try-on generates a branded polaroid they can share — turning customers into brand ambassadors.",
              },
              {
                icon: <MessageCircle className="h-6 w-6" />,
                title: "WhatsApp commerce",
                body: "When a customer wants to buy, they send a structured brief via WhatsApp. The curator confirms stock, collects payment (M-Pesa, bank transfer, cash), and ships. Zero platform fees.",
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {pillar.icon}
                </div>
                <h3 className="mt-4 font-bold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
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
            Today, BeOnPoint is live with curators in Kenya across sportswear, streetwear,
            Ankara, vintage, and formal wear — each with their own branded storefront,
            AI try-on, and WhatsApp checkout. We&rsquo;re developer-owned, fee-free,
            and focused entirely on making fashion commerce work for the markets that
            legacy platforms ignore.
          </p>
        </div>
      </section>

      {/* Team / Identity */}
      <section className="border-b border-border bg-card/50 py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">Built by builders</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            BeOnPoint is an independent, developer-owned project. We believe the best
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

      {/* CTA */}
      <section className="py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Ready to see it in action?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Try the AI styling experience yourself, or apply to open your own storefront.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl"
            >
              <Camera className="h-4 w-4" />
              Try It Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/curator"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-bold transition-colors hover:bg-card"
            >
              <Store className="h-4 w-4" />
              Open a storefront
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            BeOnPoint
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/curator" className="hover:text-foreground transition-colors">For Curators</Link>
            <Link href="/lab" className="hover:text-foreground transition-colors">Try On</Link>
          </div>
          <p className="text-xs">Built for emerging-market fashion commerce.</p>
        </div>
      </footer>
    </main>
  );
}
