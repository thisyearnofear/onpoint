"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Camera,
  Store,
  Bot,
  Image as ImageIcon,
  Wallet,
  Sparkles,
  Zap,
  Eye,
  Crown,
  Rocket,
  Code2,
  HelpCircle,
} from "lucide-react";
import { OnPointLayout } from "../../components/OnPointLayout";
import { getApiBase } from "../../lib/utils/api-base";
import { useState, useEffect } from "react";
import { Accordion, AccordionItem } from "../../components/ui/Accordion";
import { Tabs } from "../../components/ui/Tabs";

interface PlatformStats {
  curators: number;
  listings: number;
  digitalListings: number;
}

export default function PricingPage() {
  const [stats, setStats] = useState<PlatformStats>({ curators: 8, listings: 55, digitalListings: 8 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${getApiBase()}/api/curator/directory?agentPurchasable=1`);
        const data = await response.json();
        const curators = data.curators?.length || 8;
        const listings = data.curators?.reduce((sum: number, c: any) => sum + (c.liveListingCount || 0), 0) || 55;
        const digitalListings = data.curators?.find((c: any) => c.slug === "nia")?.digitalListingCount || 8;
        setStats({ curators, listings, digitalListings });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <OnPointLayout>

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        {/* Hero — short and punchy */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-4">
            <Wallet className="w-3.5 h-3.5" />
            Transparent Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Pay per try-on.
            <span className="block text-primary">No subscription.</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto">
            Try before you buy. USD-pegged via cUSD on Celo. No gas fees for buyers.
          </p>
        </div>

        {/* Platform Stats — compact bar */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-8 py-4 px-6 rounded-xl border border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20">
            {[
              { label: "Curators", value: stats.curators, icon: <Store className="w-4 h-4" /> },
              { label: "Listings", value: stats.listings, icon: <ImageIcon className="w-4 h-4" /> },
              { label: "Digital designs", value: stats.digitalListings, icon: <Sparkles className="w-4 h-4" /> },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary opacity-60">{stat.icon}</span>
                <span className="text-2xl font-black">
                  {loading ? <span className="animate-pulse">...</span> : stat.value}
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
            {error && (
              <span className="text-xs text-amber-600 dark:text-amber-400">cached</span>
            )}
          </div>
        </div>

        {/* Pricing Tiers — 4 cards, cleaner */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {/* Discovery */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-3 hover:border-border/60 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center">
              <Store className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Discovery</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">Free</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Browse curators, storefronts, listings.
            </p>
            <ul className="space-y-1.5 text-sm">
              {["Directory access", "Storefront browsing", "Listing details"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Free Web Try-On — NEW */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-3 hover:border-border/60 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Web Try-On</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">Free</span>
              <span className="text-xs text-muted-foreground">20/day</span>
            </div>
            <p className="text-sm text-muted-foreground">
              See how a style looks on you. AI-generated, rate-limited.
            </p>
            <ul className="space-y-1.5 text-sm">
              {["AI render in seconds", "Style preview", "Share polaroid", "No login required"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-border/20">
              <p className="text-xs text-muted-foreground">
                Shows a <span className="font-semibold">similar look</span> — not the exact garment. Rate-limited per IP.
              </p>
            </div>
          </div>

          {/* Digital Try-On (Agent, Paid) */}
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card to-primary/[0.04] p-6 space-y-3 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
              Most Popular
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Digital Try-On</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">$0.03</span>
              <span className="text-xs text-muted-foreground">/ try-on</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-generated designs from digital curators like Nia.
            </p>
            <ul className="space-y-1.5 text-sm">
              {["AI render in seconds", "Fit signal + critique", "Similar physical items", "NFT minting ($0.10)"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-border/20">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">80%</span> curator / <span className="font-bold">20%</span> platform
              </p>
            </div>
          </div>

          {/* Physical Try-On (Agent, Paid) */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-3 hover:border-border/60 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Physical Try-On</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">$0.05</span>
              <span className="text-xs text-muted-foreground">/ try-on</span>
            </div>
            <p className="text-sm text-muted-foreground">
              See how real inventory fits before buying.
            </p>
            <ul className="space-y-1.5 text-sm">
              {["AI try-on render", "Size/fit signal", "WhatsApp brief", "Polaroid share"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-border/20">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">95%</span> curator / <span className="font-bold">5%</span> platform
              </p>
            </div>
          </div>
        </div>

        {/* Free vs Paid Try-On — Tabbed comparison */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black tracking-tight mb-1">Free vs Paid Try-On</h2>
            <p className="text-sm text-muted-foreground">Why pay? See the difference</p>
          </div>
          <Tabs
            items={[
              {
                id: "free",
                label: "Free (Web)",
                icon: <Eye className="w-4 h-4" />,
                content: (
                  <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.03] to-transparent p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Eye className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Venice SD35 — Text-to-Image</h3>
                        <p className="text-sm text-muted-foreground">Generates "a person matching your description wearing something like this"</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What you get</p>
                        <ul className="space-y-1.5 text-sm">
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>A visual of how the style would look</span></li>
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>Good enough to decide if you like the vibe</span></li>
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>Shareable polaroid card</span></li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Limitations</p>
                        <ul className="space-y-1.5 text-sm">
                          <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0 mt-0.5">—</span><span>Not the actual garment on your actual body</span></li>
                          <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0 mt-0.5">—</span><span>20 try-ons per day per IP</span></li>
                          <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0 mt-0.5">—</span><span>No size/fit signal</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: "paid",
                label: "Paid (Agent)",
                icon: <Crown className="w-4 h-4" />,
                content: (
                  <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Replicate IDM-VTON — Image-Conditioned</h3>
                        <p className="text-sm text-muted-foreground">Places the actual garment on your actual photo</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What you get</p>
                        <ul className="space-y-1.5 text-sm">
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>The exact item on your exact body</span></li>
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>Size/fit signal + critique</span></li>
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>WhatsApp-ready brief to curator</span></li>
                          <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>Shareable polaroid card</span></li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pricing</p>
                        <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Digital (Nia)</span>
                            <span className="font-bold">$0.03</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Physical (curator)</span>
                            <span className="font-bold">$0.05</span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t border-border/20">
                            <span>Payment</span>
                            <span className="font-bold text-primary">cUSD / USDC</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* How It Works — visual flow, kept light */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black tracking-tight mb-1">How It Works</h2>
            <p className="text-sm text-muted-foreground">Browse → try-on → pay → earn</p>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            {[
              { step: "1", icon: <Store className="w-5 h-5" />, title: "Browse", desc: "Explore storefronts" },
              { step: "2", icon: <ImageIcon className="w-5 h-5" />, title: "Try-On", desc: "Free or $0.03+" },
              { step: "3", icon: <Wallet className="w-5 h-5" />, title: "Pay", desc: "cUSD via x402" },
              { step: "4", icon: <Sparkles className="w-5 h-5" />, title: "Earn", desc: "Attribution tags" },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/20">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                    {item.icon}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mb-0.5">STEP {item.step}</div>
                  <div className="text-base font-bold mb-0.5">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-muted-foreground/20">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Technical Details — progressive disclosure via accordion */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-bold">Technical Details</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            For developers and agents. Tap to expand.
          </p>
          <Accordion>
            {/* Agent Revenue */}
            <AccordionItem
              title="Agent Revenue Model"
              subtitle="How agents earn + payment methods"
              icon={<Bot className="w-4 h-4" />}
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    How agents earn
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Agents may add <span className="font-bold">markup on purchases</span> (agent-controlled)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Future: platform shares <span className="font-bold">2.5% of its fee</span> with referring agents via 0xSplits</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Payment methods
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-muted/60 text-sm font-medium">cUSD</span>
                    <span className="px-3 py-1.5 rounded-lg bg-muted/60 text-sm font-medium">USDC (facilitator)</span>
                    <span className="px-3 py-1.5 rounded-lg bg-muted/60 text-sm font-medium">USDT (facilitator)</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    All payments on Celo mainnet (chain ID 42220). Gasless for buyers via EIP-3009.
                  </p>
                </div>
              </div>
            </AccordionItem>

            {/* NFT Minting */}
            <AccordionItem
              title="NFT Minting"
              subtitle="Mint digital fashion as NFTs on Celo"
              icon={<ImageIcon className="w-4 h-4" />}
            >
              <p className="text-sm mb-4">
                Mint digital fashion designs as NFTs on Celo. Royalties split automatically via 0xSplits.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Contract</p>
                  <code className="text-sm font-mono break-all">0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576</code>
                </div>
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Royalty Split</p>
                  <p className="text-sm font-mono">
                    <span className="font-bold text-primary">85%</span> creator / <span className="font-bold">15%</span> platform
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Powered by 0xSplits. Split distribution deferred until Celo support is added. Custodial fallback active.
              </p>
            </AccordionItem>

            {/* Attribution */}
            <AccordionItem
              title="Attribution Tags (ERC-8021)"
              subtitle="On-chain attribution for hackathon credit"
              icon={<Sparkles className="w-4 h-4" />}
            >
              <p className="text-sm mb-4">
                Every transaction carries attribution tags for hackathon leaderboard credit. Agents can append their own code alongside the platform tag.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Platform tag</p>
                  <code className="text-sm font-mono">celo_ce9e004195d5</code>
                </div>
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Hostname tag</p>
                  <code className="text-sm font-mono">celo_aac2acfa60e8</code>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Standard: ERC-8021. Append dataSuffix to your cUSD transfer. Already have your own code? Use <code>toDataSuffix(['your_code', 'celo_ce9e004195d5'])</code>.
              </p>
            </AccordionItem>

            {/* Cost protection */}
            <AccordionItem
              title="Cost Protection & Funnel Tracking"
              subtitle="How we prevent AI cost abuse"
              icon={<HelpCircle className="w-4 h-4" />}
            >
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><span className="font-bold">Rate limits:</span> 5/min, 20/day per IP on all try-on routes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><span className="font-bold">Render cache:</span> 1-hour cache eliminates duplicate AI calls for same photo + listing</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><span className="font-bold">Funnel tracking:</span> every try-on and purchase logged for conversion analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><span className="font-bold">Cheaper text gen:</span> Gemini Flash-Lite for styling tips (7x cheaper)</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Free tier review deadline: 2026-08-15. If conversion &lt; 1%, free tier may be gated behind login.
              </p>
            </AccordionItem>
          </Accordion>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            View developer docs
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="text-muted-foreground/30">·</span>
          <Link
            href="/curators"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse curators
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </OnPointLayout>
  );
}
