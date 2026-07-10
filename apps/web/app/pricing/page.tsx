"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  X,
  Sparkles,
  ArrowLeft,
  Zap,
  Shield,
  Crown,
  Star,
  Loader2,
  CreditCard,
  Wallet,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

interface TierConfig {
  tier: string;
  name: string;
  price: number;
  stylists: string;
  critiques: string;
  features: string[];
  highlighted?: boolean;
}

const TIERS: TierConfig[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    stylists: "3 stylists",
    critiques: "1 per session",

    features: [
      "Miranda Priestly — honest, editorial critique",
      "Edina Monsoon — bold, hilarious roasts",
      "John Shaft — cool, confident style advice",
      "Basic fit & color analysis",
      "Shareable style polaroid",
    ],
  },
  {
    tier: "basic",
    name: "Plus",
    price: 9.99,
    stylists: "All 6 stylists",
    critiques: "Unlimited",

    features: [
      "All 3 Free stylists, plus:",
      "Anna Wintour — luxury, high-fashion editorials",
      "Virgil Abloh — streetwear, sneaker culture",
      "Stella McCartney — sustainable, eco-conscious",
      "Unlimited critique sessions",
      "Download full style reports",
      "Email reports to yourself",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 19.99,
    stylists: "All 6 stylists",
    critiques: "Unlimited",

    features: [
      "Everything in Plus, plus:",
      "Priority AI processing (faster results)",
      "External marketplace search & price compare",
      "NFT minting for style polaroids",
      "500 actions per day for agent shopping",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    tier: "concierge",
    name: "Concierge",
    price: 49.99,
    stylists: "All 6 + personal",
    critiques: "Unlimited",

    features: [
      "Everything in Pro, plus:",
      "Personal stylist consultation (monthly)",
      "White-glove AI styling service",
      "Exclusive brand access & early drops",
      "Custom NFT collections",
      "Unlimited agent actions",
      "Dedicated support",
    ],
  },
];

const FEATURE_COMPARISON = [
  { feature: "Stylists Available", free: "3", basic: "All 6", pro: "All 6", concierge: "All 6 + Personal" },
  { feature: "Critique Sessions", free: "1/analysis", basic: "Unlimited", pro: "Unlimited", concierge: "Unlimited" },
  { feature: "Style Reports", free: "Basic", basic: "Full download", pro: "Full + Email", concierge: "White-glove" },
  { feature: "Style Polaroid", free: "✓", basic: "✓", pro: "✓", concierge: "✓" },
  { feature: "External Search", free: "—", basic: "—", pro: "✓", concierge: "✓" },
  { feature: "NFT Minting", free: "—", basic: "—", pro: "✓", concierge: "✓" },
  { feature: "Priority Processing", free: "—", basic: "—", pro: "✓", concierge: "✓" },
  { feature: "Personal Stylist", free: "—", basic: "—", pro: "—", concierge: "Monthly" },
  { feature: "Exclusive Brands", free: "—", basic: "—", pro: "—", concierge: "✓" },
];

interface SubscriptionData {
  userId: string;
  tier: string;
  status: string;
  hasTrial: boolean;
  canStartTrial: boolean;
  subscription?: {
    tier: string;
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  };
  usage?: {
    actionsCount: number;
    spentAmount: string;
  };
}

export default function PricingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Fetch current subscription
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch("/api/auth/subscription");
        if (res.ok) {
          const data = await res.json();
          setSubscription(data);
        }
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  const currentTier = subscription?.subscription?.tier || subscription?.tier || "free";

  const handleStartTrial = async () => {
    setActionLoading("trial");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trial", durationDays: 14 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start trial");
      setSuccess("14-day Pro trial started! Enjoy premium features.");
      // Refresh subscription data
      const subRes = await fetch("/api/auth/subscription");
      if (subRes.ok) setSubscription(await subRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start trial");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setActionLoading(`upgrade-${tier}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", tier, paymentMethod: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upgrade");
      setSuccess(`Upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`);
      const subRes = await fetch("/api/auth/subscription");
      if (subRes.ok) setSubscription(await subRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upgrade");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading("cancel");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", immediate: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");
      setSuccess("Subscription will cancel at end of billing period.");
      const subRes = await fetch("/api/auth/subscription");
      if (subRes.ok) setSubscription(await subRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setActionLoading("reactivate");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reactivate");
      setSuccess("Subscription reactivated!");
      const subRes = await fetch("/api/auth/subscription");
      if (subRes.ok) setSubscription(await subRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setActionLoading(null);
    }
  };

  const annualMultiplier = billingCycle === "annual" ? 10 : 1; // 2 months free on annual

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Crown className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                OnPoint Premium
              </span>
            </div>
          </div>

          {!user && !authLoading && (
            <Button
              onClick={() => router.push("/auth/login")}
              variant="outline"
              size="sm"
            >
              Sign in to subscribe
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Error / Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center justify-between"
            >
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-400/70 hover:text-green-400">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Plan Banner */}
        {currentTier !== "free" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 border border-primary/20"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Current Plan: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Status: {subscription?.subscription?.status || "Active"}
                    {subscription?.subscription?.cancelAtPeriodEnd && " (Cancels at period end)"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!subscription?.subscription?.cancelAtPeriodEnd && currentTier !== "free" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={actionLoading === "cancel"}
                    className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                  >
                    {actionLoading === "cancel" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Cancel
                  </Button>
                )}
                {subscription?.subscription?.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReactivate}
                    disabled={actionLoading === "reactivate"}
                    className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                  >
                    {actionLoading === "reactivate" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Reactivate
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Audience split */}
        <div className="mb-10 grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              For shoppers &amp; stylists
            </p>
            <h2 className="text-lg font-black tracking-tight mb-2">Premium plans below</h2>
            <p className="text-sm text-muted-foreground">
              Unlock more AI stylists, reports, and optional agent actions. Try-on on curator storefronts stays free.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              For curators (supply)
            </p>
            <h2 className="text-lg font-black tracking-tight mb-2">Storefront is free</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Branded `/s/your-slug`, AI try-on for your customers, WhatsApp/M-Pesa checkout — no platform subscription required.
            </p>
            <Link
              href="/curator"
              className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
            >
              Add your inventory
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Shopper{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              plans
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
            Stylist unlocks and agent action quotas for people shopping the fit rail — not curator storefront fees.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual{" "}
              <span className="text-[10px] font-bold text-accent">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {TIERS.map((tier, index) => {
            const isCurrentPlan = currentTier === tier.tier;
            const isUpgrade = TIERS.findIndex(t => t.tier === currentTier) < index;
            const isDowngrade = TIERS.findIndex(t => t.tier === currentTier) > index;
            const annualPrice = tier.price * annualMultiplier;

            return (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
                  tier.highlighted
                    ? "border-primary/40 shadow-xl shadow-primary/10 bg-card scale-105 z-10"
                    : "border-border bg-card hover:shadow-lg hover:border-primary/20"
                } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
              >
                {/* Highlighted Badge */}
                {tier.highlighted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                )}
                {tier.highlighted && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  </div>
                )}

                <div className="p-6 space-y-6">
                  {/* Tier Icon & Name */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tier.tier === "free" ? "bg-muted" :
                      tier.tier === "basic" ? "bg-blue-500/10" :
                      tier.tier === "pro" ? "bg-primary/10" :
                      "bg-accent/10"
                    }`}>
                      {tier.tier === "free" ? <Star className="w-5 h-5 text-muted-foreground" /> :
                       tier.tier === "basic" ? <Sparkles className="w-5 h-5 text-blue-400" /> :
                       tier.tier === "pro" ? <Rocket className="w-5 h-5 text-primary" /> :
                       <Crown className="w-5 h-5 text-accent" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{tier.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{tier.tier} tier</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black">${billingCycle === "annual" ? (tier.price * 10).toFixed(0) : tier.price.toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground">/{billingCycle === "annual" ? "year" : "mo"}</span>
                    </div>
                    {billingCycle === "annual" && tier.price > 0 && (
                      <p className="text-xs text-accent mt-1">
                        ${tier.price}/mo billed annually (2 months free)
                      </p>
                    )}
                  </div>

                  {/* Stylist count + critique limit */}
                  <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stylists</span>
                      <span className="font-bold text-foreground">{tier.stylists}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Critiques</span>
                      <span className="font-bold text-foreground">{tier.critiques}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                        <span className={`${feature.includes("plus:") || feature.includes("Everything") ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      disabled
                      className="w-full border-primary/30 text-primary"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : tier.tier === "free" ? (
                    <Button
                      variant="outline"
                      disabled={isCurrentPlan}
                      className="w-full"
                    >
                      Free Forever
                    </Button>
                  ) : subscription?.canStartTrial && tier.tier === "pro" ? (
                    <Button
                      onClick={handleStartTrial}
                      disabled={actionLoading === "trial"}
                      className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold"
                    >
                      {actionLoading === "trial" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Start 14-Day Free Trial
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(tier.tier)}
                      disabled={actionLoading === `upgrade-${tier.tier}`}
                      variant={tier.highlighted ? "default" : "outline"}
                      className={`w-full ${
                        tier.highlighted
                          ? "bg-gradient-to-r from-primary to-accent text-white font-semibold"
                          : ""
                      }`}
                    >
                      {actionLoading === `upgrade-${tier.tier}` ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : isUpgrade ? (
                        <Rocket className="w-4 h-4 mr-2" />
                      ) : null}
                      {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Subscribe"}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-card/80 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-wider">Full Feature Comparison</span>
            </div>
            <motion.div
              animate={{ rotate: showComparison ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </button>

          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-2xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Feature</th>
                        {TIERS.map((tier) => (
                          <th key={tier.tier} className={`p-3 font-medium text-center ${
                            tier.highlighted ? "text-primary" : "text-muted-foreground"
                          }`}>
                            {tier.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FEATURE_COMPARISON.map((row, i) => (
                        <tr key={i} className={`border-b border-border/50 ${
                          i % 2 === 0 ? "bg-card" : "bg-muted/20"
                        }`}>
                          <td className="p-3 font-medium">{row.feature}</td>
                          <td className="p-3 text-center text-muted-foreground">{row.free}</td>
                          <td className="p-3 text-center text-muted-foreground">{row.basic}</td>
                          <td className={`p-3 text-center font-medium ${
                            row.pro === "✓" ? "text-green-400" : "text-muted-foreground"
                          }`}>{row.pro}</td>
                          <td className={`p-3 text-center ${
                            row.concierge === "✓" ? "text-green-400" : "text-muted-foreground"
                          }`}>{row.concierge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="group rounded-2xl border border-border bg-card overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <span className="font-medium text-sm">What stylists are included in each plan?</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                Free includes 3 core stylists: Miranda (honest), Edina (roast), and Shaft (hype). Plus and above unlock all 6, including Anna Wintour (luxury), Virgil Abloh (streetwear), and Stella McCartney (sustainable).
              </div>
            </details>
            <details className="group rounded-2xl border border-border bg-card overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <span className="font-medium text-sm">Can I cancel anytime?</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                Yes. You can cancel anytime — your access continues until the end of your billing period. No questions asked.
              </div>
            </details>
            <details className="group rounded-2xl border border-border bg-card overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <span className="font-medium text-sm">How does the free trial work?</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                Start a 14-day free trial of Pro with full access to all 6 stylists, unlimited critiques, and priority AI processing. No credit card required.
              </div>
            </details>
            <details className="group rounded-2xl border border-border bg-card overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <span className="font-medium text-sm">What payment methods are accepted?</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                We accept credit/debit cards (Stripe), crypto (ETH/cUSD via Celo/Superfluid), and Apple Pay. Enterprise invoicing is available for Concierge plans.
              </div>
            </details>
          </div>
        </div>

        {/* Credit Card / Wallet Icons */}
        <div className="flex items-center justify-center gap-6 mt-12 text-muted-foreground">
          <CreditCard className="w-5 h-5" />
          <Wallet className="w-5 h-5" />
          <span className="text-xs">Secure payments via Stripe</span>
        </div>
      </main>
    </div>
  );
}
