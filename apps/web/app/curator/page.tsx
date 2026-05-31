import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Camera,
  MessageCircle,
  ChartNoAxesCombined,
  Share2,
  Sparkles,
  Store,
  Shirt,
  Palette,
  TrendingUp,
  Users,
  Globe,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Become a Curator | OnPoint",
  description:
    "Turn your fashion eye into a storefront. Get AI try-on, branded polaroids, WhatsApp checkout, and analytics — free to join.",
};

// ── Archetype definitions ──────────────────────────────

interface CuratorArchetype {
  id: string;
  title: string;
  tagline: string;
  description: string;
  emoji: string;
  color: string;
  accent: string;
  verticals: string[];
  exampleItems: string[];
  valueProps: string[];
  whyOnPoint: string;
  stats: {
    label: string;
    value: string;
  }[];
}

const ARCHETYPES: CuratorArchetype[] = [
  {
    id: "sportswear",
    title: "Sportswear Stylist",
    tagline: "Kits, jerseys, athletic gear — your local game is global.",
    description:
      "You source and sell football kits, training gear, and matchday fits. Your customers know what they want but need help with sizing, printing, and the latest drops.",
    emoji: "⚽",
    color: "#22c55e",
    accent: "#16a34a",
    verticals: ["football", "sportswear", "premier-league"],
    exampleItems: [
      "Arsenal 2024/25 home kit",
      "Liverpool away with name & number",
      "Training shorts & socks bundle",
    ],
    valueProps: [
      "AI try-on so customers see the fit before asking",
      "Club crest & season auto-resolved from text commands",
      "Print variants (name, number) reflected in pricing",
    ],
    whyOnPoint:
      "Your customers already ask 'how does it fit?' and 'can you print #7?' OnPoint gives them try-on and instant briefs — you just confirm stock and collect payment.",
    stats: [
      { label: "Avg. try-ons per visit", value: "4.2" },
      { label: "WhatsApp conversion", value: "68%" },
      { label: "Time to first listing", value: "30s" },
    ],
  },
  {
    id: "streetwear",
    title: "Streetwear Curator",
    tagline: "Sneakers, drops, and fits that move culture.",
    description:
      "You hustle sneaker releases, limited drops, and streetwear staples. Your edge is knowing what's next — but your customers need to see how it looks on them before they cop.",
    emoji: "👟",
    color: "#a855f7",
    accent: "#7c3aed",
    verticals: ["streetwear", "sneakers", "retro"],
    exampleItems: [
      "Limited edition sneaker drop",
      "Vintage basketball jersey",
      "Tech fleece & cargo set",
    ],
    valueProps: [
      "Polaroid share cards that make every item post-worthy",
      "Cross-curator discovery when you're out of stock",
      "Intel alerts on what your audience is searching for",
    ],
    whyOnPoint:
      "Your brand lives on Instagram and WhatsApp — not a website you maintain. OnPoint gives you a storefront that feels like your brand, with try-on that closes the 'will this fit?' hesitation.",
    stats: [
      { label: "Share rate", value: "23%" },
      { label: "Avg. session time", value: "4m 12s" },
      { label: "Items per curator", value: "18" },
    ],
  },
  {
    id: "ankara",
    title: "Ankara & African Print Curator",
    tagline: "Bold prints, occasion wear, and cultural fashion.",
    description:
      "You work with Ankara, Kente, Kitenge, and other African prints — making custom pieces for weddings, graduations, and celebrations. Every piece is unique and every customer needs to see the drape.",
    emoji: "🧵",
    color: "#eab308",
    accent: "#ca8a04",
    verticals: ["ankara", "african-print", "occasion"],
    exampleItems: [
      "Custom Ankara blazer (occasion wear)",
      "Kente stole for graduation ceremony",
      "Kitenge matching set (top + wrap skirt)",
    ],
    valueProps: [
      "AI try-on shows how the print drapes on their body type",
      "WhatsApp brief captures all custom details in one message",
      "Polaroid cards make every commission shareable",
    ],
    whyOnPoint:
      "Every piece is made-to-order, which means every inquiry needs back-and-forth on fabric, fit, and style. OnPoint replaces 5 WhatsApp messages with one try-on and brief — you go straight to cutting fabric.",
    stats: [
      { label: "Brief-to-order rate", value: "72%" },
      { label: "Avg. piece value", value: "KES 4,500" },
      { label: "Returning customers", value: "41%" },
    ],
  },
  {
    id: "vintage",
    title: "Vintage & Thrift Curator",
    tagline: "One-of-a-kind pieces that need the right home.",
    description:
      "You hunt vintage, thrift, and deadstock — curating pieces that no one else has. The challenge is selling the vibe without the customer trying it on.",
    emoji: "📻",
    color: "#f97316",
    accent: "#d97706",
    verticals: ["vintage", "thrift", "retro"],
    exampleItems: [
      "90s denim jacket (deadstock)",
      "Vintage band tee (rare print)",
      "Thrifted leather tote",
    ],
    valueProps: [
      "Try-on eliminates the biggest hesitation: 'will this look good on me?'",
      "Polaroid assets make every listing shareable on IG",
      "No-size-fits-all? Mark items as single-size with stock=1",
    ],
    whyOnPoint:
      "You source unique pieces that need to be seen on a body to sell. OnPoint turns every listing into a virtual fitting experience — your customers try it on from home, and you ship when they confirm.",
    stats: [
      { label: "Try-on to inquiry", value: "55%" },
      { label: "Sell-through rate", value: "3.2×" },
      { label: "Avg. listing views", value: "142" },
    ],
  },
  {
    id: "tailor",
    title: "Tailor & Formalwear Specialist",
    tagline: "Bespoke fits that start with measurements, not luck.",
    description:
      "You make suits, kaftans, agbadas, and formal wear. Every customer needs measurements, fabric selection, and style consultation — high touch, high value, high hesitation.",
    emoji: "✂️",
    color: "#6366f1",
    accent: "#4f46e5",
    verticals: ["tailoring", "formal", "occasion"],
    exampleItems: [
      "Bespoke linen suit (wedding season)",
      "Kaftan with custom embroidery",
      "Agbada set with matching cap",
    ],
    valueProps: [
      "Style profile captures measurements, preferences, and body type",
      "Brief-to-curator flow replaces 5-10 WhatsApp messages",
      "Polaroid past work as shareable portfolio",
    ],
    whyOnPoint:
      "Your business runs on consultations — each taking 30+ minutes before a single stitch. OnPoint captures the brief, style preference, and body profile upfront. You walk into the fitting with everything you need.",
    stats: [
      { label: "Avg. order value", value: "KES 8,200" },
      { label: "Brief detail score", value: "89%" },
      { label: "Repeat custom rate", value: "53%" },
    ],
  },
  {
    id: "luxury",
    title: "Luxury & Premium Reseller",
    tagline: "High-end pieces that demand discretion and trust.",
    description:
      "You resell luxury handbags, watches, and designer pieces — authentic, curated, and premium. Your customers care about condition, authenticity, and how it looks styled.",
    emoji: "💎",
    color: "#f43f5e",
    accent: "#e11d48",
    verticals: ["luxury", "high-fashion", "accessories"],
    exampleItems: [
      "Pre-owned Chanel flap bag",
      "Limited edition watch",
      "Designer sunglasses (spring collection)",
    ],
    valueProps: [
      "Private storefront with your brand's look and feel",
      "Style memory recommends across your catalog per customer",
      "Analytics dashboard shows what's getting attention",
    ],
    whyOnPoint:
      "Your customers aren't browsing open markets — they buy from you because of your eye and your access. OnPoint gives them a private showroom with try-on context, so they see how that bag works with their wardrobe before they commit.",
    stats: [
      { label: "Avg. item value", value: "KES 22,000" },
      { label: "Inquiry conversion", value: "31%" },
      { label: "Share-to-visit rate", value: "4.1×" },
    ],
  },
];

// ── Benefits cards ─────────────────────────────────────

interface Benefit {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: <Store className="h-5 w-5" />,
    title: "Your branded storefront",
    body: "Get /s/yourname with your colors, logo, and voice — no coding, no CMS, no app store.",
  },
  {
    icon: <Camera className="h-5 w-5" />,
    title: "AI try-on for every item",
    body: "Customers see how pieces look on their body before they buy. Fewer sizing questions, faster yeses.",
  },
  {
    icon: <Share2 className="h-5 w-5" />,
    title: "Shareable polaroid assets",
    body: "Every try-on generates a branded polaroid. Customers share to Instagram — you get free reach.",
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "WhatsApp checkout",
    body: "Orders come through as ready-to-act briefs on WhatsApp. You confirm stock, they pay, you ship.",
  },
  {
    icon: <ChartNoAxesCombined className="h-5 w-5" />,
    title: "Funnel analytics",
    body: "See share → visit → try-on → buy rates per item. Know what's working without guessing.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "30-second inventory via chat",
    body: "Text '+' and a photo — the agent creates a listing with sizes, pricing, and stock. No dashboard.",
  },
];

// ── How it works steps ──────────────────────────────────

const STEPS = [
  {
    step: 1,
    title: "Tell us about you",
    body: "Your name, what you sell, your brand colors — 30 seconds, no credit card.",
  },
  {
    step: 2,
    title: "Get your storefront",
    body: "You get a branded /s/yourslug page with try-on, polaroid sharing, and WhatsApp checkout built in.",
  },
  {
    step: 3,
    title: "Add inventory via chat",
    body: "Send '+' and a photo to our WhatsApp agent. It creates a live listing; you set the price and sizes.",
  },
  {
    step: 4,
    title: "Share & sell",
    body: "Share your link. Customers try on, send briefs, and buy on WhatsApp — you handle fulfilment your way.",
  },
];

// ── Archetype gradient backgrounds ──────────────────────

function ArchetypeGradient({ color, accent }: { color: string; accent: string }) {
  return (
    <div
      className="absolute inset-0 rounded-2xl opacity-[0.03] pointer-events-none"
      style={{
        background: `linear-gradient(135deg, ${color}, ${accent})`,
      }}
    />
  );
}

// ── Page ────────────────────────────────────────────────

export default function CuratorLandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold"
          >
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            BeOnPoint
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/curator/onboard"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Apply now
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Store className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
              Turn your style eye
              <span className="block text-primary">into a storefront.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Get a branded page with AI try-on, polaroid sharing, WhatsApp checkout,
              and analytics — free to create, zero platform fees.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/curator/onboard"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl"
              >
                <Sparkles className="h-4 w-4" />
                Create your storefront
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/s/wanja"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-bold transition-colors hover:bg-card"
              >
                <Store className="h-4 w-4" />
                See an example
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                Free to create
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                30-second setup
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                Zero platform fees
              </span>
            </div>
          </div>

          {/* ── Live stats bar ── */}
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { icon: Store, value: "5+", label: "Curators on platform", color: "text-primary" },
              { icon: Shirt, value: "120+", label: "Live listings", color: "text-emerald-500" },
              { icon: TrendingUp, value: "68%", label: "WhatsApp conversion", color: "text-amber-500" },
              { icon: Globe, value: "Kenya", label: "Active market", color: "text-sky-500" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-card p-4 text-center"
              >
                <stat.icon className={`mx-auto h-5 w-5 ${stat.color}`} />
                <p className="mt-2 text-xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Archetypes ── */}
      <section className="border-b border-border py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Curator profiles
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Built for your vertical
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Whether you sell kits or kaftans, OnPoint adapts to how you work.
              Pick your lane — everything else is handled.
            </p>
          </div>

          <div className="mt-10 space-y-6">
            {ARCHETYPES.map((archetype) => (
              <div
                key={archetype.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg"
              >
                <ArchetypeGradient color={archetype.color} accent={archetype.accent} />

                <div className="relative z-10 p-6 md:p-8">
                  {/* Header row */}
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${archetype.color}20, ${archetype.accent}20)`,
                        }}
                      >
                        {archetype.emoji}
                      </div>
                      <div>
                        <h3 className="text-xl font-black tracking-tight">
                          {archetype.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {archetype.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Stats badges */}
                    <div className="flex flex-wrap gap-2">
                      {archetype.stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-center"
                        >
                          <p
                            className="text-sm font-black"
                            style={{ color: archetype.color }}
                          >
                            {stat.value}
                          </p>
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Content grid */}
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        {archetype.description}
                      </p>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Example items
                        </p>
                        <ul className="mt-2 space-y-1">
                          {archetype.exampleItems.map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Check
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: archetype.color }}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Why OnPoint
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {archetype.whyOnPoint}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          What you get
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {archetype.valueProps.map((vp) => (
                            <li
                              key={vp}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              {vp}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Vertical tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {archetype.verticals.map((v) => (
                          <span
                            key={v}
                            className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {v.replaceAll("-", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                    <Link
                      href="/curator/onboard"
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${archetype.color}, ${archetype.accent})`,
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Create {archetype.title.split(" ")[0]} storefront
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/s/wanja`}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      See an example →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="border-b border-border bg-gradient-to-b from-card to-background py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              Every curator gets
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              One storefront. Everything you need to sell more with less back-and-forth.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {benefit.icon}
                </div>
                <h3 className="mt-4 font-bold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {benefit.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-b border-border py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              You do the selling.
              <span className="block text-primary">We handle the tech.</span>
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {STEPS.map(({ step, title, body }) => (
              <div
                key={step}
                className="relative rounded-xl border border-border bg-card p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                  {step}
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
                {step < STEPS.length && (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 md:block">
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What curators say ── */}
      <section className="border-b border-border bg-card/50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              First curator
            </p>
            <h2 className="mt-4 text-2xl font-black tracking-tight md:text-3xl">
              What Wanja says
            </h2>
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-lg font-black text-emerald-500">
                W
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">Wanja</p>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    Sportswear Stylist
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground italic">
                  &ldquo;My customers used to send me screenshots from other apps and ask
                  'will this fit?' — now they try it on themselves and send me a ready brief.
                  I just check stock and collect payment.&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Nairobi, Kenya
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Shirt className="h-3.5 w-3.5 text-emerald-500" />
                    18 live listings
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                    WhatsApp checkout
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Store className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight md:text-4xl">
              Ready to open your storefront?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Free to create. No credit card. Takes 30 seconds.
              Join Wanja and start selling with AI-powered try-on today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/curator/onboard"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl"
              >
                <Sparkles className="h-5 w-5" />
                Create your storefront
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/s/wanja"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-8 py-4 text-base font-bold transition-colors hover:bg-card"
              >
                <Store className="h-5 w-5" />
                See Wanja's storefront
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Free to create
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                No platform fees
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                WhatsApp checkout
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                AI try-on included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            BeOnPoint
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/curator/onboard" className="hover:text-foreground transition-colors">
              Apply
            </Link>
            <Link href="/s/wanja" className="hover:text-foreground transition-colors">
              Example storefront
            </Link>
          </div>
          <p className="text-xs">No platform fees. Always.</p>
        </div>
      </footer>
    </main>
  );
}
