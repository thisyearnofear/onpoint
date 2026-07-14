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
} from "lucide-react";
import { OnPointHeader, OnPointFooter } from "../../components/OnPointHeader";
import { getApiBase } from "../../lib/utils/api-base";
import { PRODUCT_NAME } from "../../lib/brand";
import { useState, useEffect } from "react";

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
    // Fetch live stats from API
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
    <div className="min-h-screen bg-background">
      <OnPointHeader />

      <main className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-4">
            <Wallet className="w-3.5 h-3.5" />
            Transparent Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Pay per try-on.
            <span className="block text-primary">No subscription.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every transaction is USD-pegged via cUSD or USDC on Celo. No gas fees for buyers. Attribution tags on every payment.
          </p>
        </div>

        {/* Platform Stats */}
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Platform Stats</h2>
            {error && (
              <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">Using cached data</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 p-6 rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30">
            <div>
              <div className="text-3xl font-black text-foreground">
                {loading ? <span className="animate-pulse">...</span> : stats.curators}
              </div>
              <div className="text-xs text-muted-foreground">Active curators</div>
            </div>
            <div>
              <div className="text-3xl font-black text-foreground">
                {loading ? <span className="animate-pulse">...</span> : stats.listings}
              </div>
              <div className="text-xs text-muted-foreground">Live listings</div>
            </div>
            <div>
              <div className="text-3xl font-black text-foreground">
                {loading ? <span className="animate-pulse">...</span> : stats.digitalListings}
              </div>
              <div className="text-xs text-muted-foreground">Digital designs</div>
            </div>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Discovery */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Discovery</h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">Free</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Browse curators, storefronts, and listings. No payment required.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Directory access</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Storefront browsing</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Listing details</span>
              </li>
            </ul>
          </div>

          {/* Digital Try-On */}
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-background to-primary/[0.04] p-6 space-y-4 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
              Most Popular
            </div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Digital Try-On</h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">$0.03</span>
              <span className="text-sm text-muted-foreground">/ try-on</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-generated garment designs from digital curators like Nia. Render via Venice API.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>AI render in seconds</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Fit signal + critique</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Similar physical items</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>NFT minting ($0.10)</span>
              </li>
            </ul>
            <div className="pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">80%</span> to digital curator, <span className="font-bold">20%</span> platform
              </p>
            </div>
          </div>

          {/* Physical Try-On */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Physical Try-On</h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">$0.05</span>
              <span className="text-sm text-muted-foreground">/ try-on</span>
            </div>
            <p className="text-sm text-muted-foreground">
              See how real inventory fits before buying. Pay once, buy with confidence.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>AI try-on render</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Size/fit signal</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>WhatsApp brief</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Polaroid share</span>
              </li>
            </ul>
            <div className="pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">95%</span> to curator, <span className="font-bold">5%</span> platform
              </p>
            </div>
          </div>

          {/* Physical Order */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Order</h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">Listing</span>
              <span className="text-sm text-muted-foreground">price</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Buy directly from curator storefronts. WhatsApp or M-Pesa checkout.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Direct purchase</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>WhatsApp checkout</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Attribution on-chain</span>
              </li>
            </ul>
            <div className="pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">95%</span> to curator, <span className="font-bold">5%</span> platform
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Flow */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
              How It Works
            </h2>
            <p className="text-muted-foreground">
              Four steps from browsing to earning attribution
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                icon: <Store className="w-5 h-5" />,
                title: "Browse",
                desc: "Explore curator storefronts and listings"
              },
              {
                step: "2",
                icon: <ImageIcon className="w-5 h-5" />,
                title: "Try-On",
                desc: "Pay $0.03 to render AI try-on"
              },
              {
                step: "3",
                icon: <Wallet className="w-5 h-5" />,
                title: "Pay",
                desc: "Send cUSD or USDC via x402"
              },
              {
                step: "4",
                icon: <Sparkles className="w-5 h-5" />,
                title: "Earn",
                desc: "Receive attribution tags"
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <div className="text-primary">{item.icon}</div>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mb-1">STEP {item.step}</div>
                  <div className="text-lg font-bold mb-1">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.desc}</div>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 -right-3 text-muted-foreground/30">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Agent Revenue Model */}
        <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-primary/[0.03] p-8 mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Agent Revenue Model</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                How agents earn
              </h3>
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Payment methods
              </h3>
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
        </div>

        {/* NFT Contract Details */}
        <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30 p-8 mb-12">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold">NFT Minting</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
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
        </div>

        {/* Attribution */}
        <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-background to-emerald-500/[0.03] p-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold">Attribution Tags</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
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
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            View developer docs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <OnPointFooter />
    </div>
  );
}
