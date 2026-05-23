"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  X,
  Crown,
  ArrowLeft,
  Zap,
  Shield,
  Star,
  Loader2,
  CreditCard,
  Wallet,
  Rocket,
  Sparkles,
  Clock,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Receipt,
  Calendar,
  Activity,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { usePremiumStatus } from "@/hooks/use-premium-status";

// ============================================
// Tier Configuration (mirrors subscription-service.ts)
// ============================================

interface TierConfig {
  tier: string;
  name: string;
  price: number;
  dailyLimit: string;
  perActionLimit: string;
  autonomyThreshold: string;
  actionsPerDay: string;
  features: string[];
  highlighted?: boolean;
}

const TIERS: TierConfig[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    dailyLimit: "$10/day",
    perActionLimit: "$5/action",
    autonomyThreshold: "$1 auto-approve",
    actionsPerDay: "10",
    features: [
      "Basic style analysis",
      "Product catalog search",
      "Manual approval for purchases",
      "10 actions per day",
    ],
  },
  {
    tier: "basic",
    name: "Basic",
    price: 9.99,
    dailyLimit: "$50/day",
    perActionLimit: "$25/action",
    autonomyThreshold: "$5 auto-approve",
    actionsPerDay: "50",
    features: [
      "Advanced style analysis",
      "Autonomous purchases up to $5",
      "Product recommendations",
      "Purchase history",
      "50 actions per day",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 29.99,
    dailyLimit: "$500/day",
    perActionLimit: "$100/action",
    autonomyThreshold: "$25 auto-approve",
    actionsPerDay: "500",
    features: [
      "Premium style analysis with AI",
      "Autonomous purchases up to $25",
      "External marketplace search",
      "Priority support",
      "NFT minting",
      "500 actions per day",
    ],
    highlighted: true,
  },
  {
    tier: "concierge",
    name: "Concierge",
    price: 99.99,
    dailyLimit: "$5,000/day",
    perActionLimit: "$1,000/action",
    autonomyThreshold: "$100 auto-approve",
    actionsPerDay: "∞",
    features: [
      "White-glove AI styling service",
      "Autonomous purchases up to $100",
      "Unlimited external search",
      "Personal stylist consultation",
      "Exclusive brand access",
      "Custom NFT collections",
      "Unlimited actions",
    ],
  },
];

// ============================================
// Data Types
// ============================================

interface SubscriptionData {
  userId: string;
  tier: string;
  status: string;
  hasTrial: boolean;
  canStartTrial: boolean;
  subscription?: {
    tier: string;
    status: string;
    currentPeriodStart: number;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
    paymentMethod: string;
  };
  usage?: {
    actionsCount: number;
    spentAmount: string;
    periodStart: number;
    periodEnd: number;
  };
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: "confirmed" | "pending" | "failed";
  txHash?: string;
  chain?: string;
  explorerUrl?: string;
  createdAt: number;
}

// ============================================
// Helpers
// ============================================

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAmount(amount: string): string {
  try {
    const wei = BigInt(amount);
    const dollars = Number(wei) / 1e18;
    return `$${dollars.toFixed(2)}`;
  } catch {
    return "$0.00";
  }
}

function getDaysRemaining(endTs: number): number {
  return Math.max(0, Math.ceil((endTs - Date.now()) / 86400000));
}

function getTierPrice(tier: string): number {
  return TIERS.find((t) => t.tier === tier)?.price ?? 0;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "trialing":
      return "text-green-400";
    case "past_due":
      return "text-amber-400";
    case "canceled":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past Due";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

function getTierIcon(tier: string) {
  switch (tier) {
    case "free":
      return Star;
    case "basic":
      return Zap;
    case "pro":
      return Rocket;
    case "concierge":
      return Crown;
    default:
      return Star;
  }
}

function getTierGradient(tier: string): string {
  switch (tier) {
    case "free":
      return "from-muted to-muted/50";
    case "basic":
      return "from-blue-500/20 to-blue-600/10";
    case "pro":
      return "from-primary/20 to-accent/20";
    case "concierge":
      return "from-accent/20 to-yellow-500/20";
    default:
      return "from-muted to-muted/50";
  }
}

function getTierIconColor(tier: string): string {
  switch (tier) {
    case "free":
      return "text-muted-foreground";
    case "basic":
      return "text-blue-400";
    case "pro":
      return "text-primary";
    case "concierge":
      return "text-accent";
    default:
      return "text-muted-foreground";
  }
}

// ============================================
// Main Page Component
// ============================================

export default function AccountSubscriptionPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const { isPremium, tier: liveTier, loading: premiumLoading, refresh: refreshPremium } = usePremiumStatus();

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "usage" | "history">("plan");

  // Fetch subscription data
  useEffect(() => {
    async function fetchData() {
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
    fetchData();
  }, []);

  // Fetch order/receipt history
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/agent/receipts?limit=10");
        if (res.ok) {
          const data = await res.json();
          // Handle both array and { receipts: [] } response shapes
          const items = Array.isArray(data) ? data : data.receipts || [];
          if (items.length > 0) {
            setOrders(items);
          }
        }
      } catch {
        // Silently fail — orders are non-critical
      } finally {
        setOrdersLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Derive current state
  const currentTier = subscription?.subscription?.tier || subscription?.tier || "free";
  const currentStatus = subscription?.subscription?.status || "active";
  const cancelAtPeriodEnd = subscription?.subscription?.cancelAtPeriodEnd || false;
  const periodEnd = subscription?.subscription?.currentPeriodEnd || 0;
  const periodStart = subscription?.subscription?.currentPeriodStart || 0;
  const daysRemaining = periodEnd ? getDaysRemaining(periodEnd) : 0;
  const usage = subscription?.usage;

  const tierConfig = TIERS.find((t) => t.tier === currentTier);
  const TierIcon = getTierIcon(currentTier);

  const currentTierIndex = TIERS.findIndex((t) => t.tier === currentTier);

  // ============================================
  // Actions
  // ============================================

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
      const subRes = await fetch("/api/auth/subscription");
      if (subRes.ok) setSubscription(await subRes.json());
      refreshPremium();
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
      refreshPremium();
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
      refreshPremium();
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
      refreshPremium();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStripeCheckout = async (tier: string) => {
    setActionLoading(`stripe-${tier}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "premium_session",
          returnUrl: `${window.location.origin}/account/subscription`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // Stripe Customer Portal
  // ============================================

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || "Failed to open billing portal");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (authLoading || (loading && premiumLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your subscription...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <Crown className="w-12 h-12 text-primary mx-auto opacity-50" />
          <h2 className="text-2xl font-bold">Sign in to manage your subscription</h2>
          <p className="text-muted-foreground">
            Create an account or sign in to view your plan, usage, and billing history.
          </p>
          <Button
            onClick={() => router.push("/auth/login")}
            className="bg-gradient-to-r from-primary to-accent text-white font-semibold"
          >
            Sign In
          </Button>
          <div>
            <Link href="/pricing" className="text-sm text-primary hover:underline">
              View pricing plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Subscription</span>
            </div>
          </div>

          <Link href="/pricing">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              View All Plans
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Error / Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
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
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess(null)} className="text-green-400/70 hover:text-green-400">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-8 p-1 rounded-xl bg-muted/50 border border-border w-fit">
          {[
            { id: "plan" as const, label: "Your Plan", icon: Crown },
            { id: "usage" as const, label: "Usage", icon: Activity },
            { id: "history" as const, label: "History", icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ============================================ */}
          {/* TAB 1: Your Plan */}
          {/* ============================================ */}
          {activeTab === "plan" && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Current Plan Hero Card */}
              <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${getTierGradient(currentTier)} p-6 md:p-8`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-3xl rounded-full -mr-24 -mt-24" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-background/80 flex items-center justify-center`}>
                      <TierIcon className={`w-7 h-7 ${getTierIconColor(currentTier)}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-black text-foreground">
                          {tierConfig?.name || "Free"} Plan
                        </h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          getStatusColor(currentStatus)
                        } bg-${currentStatus === "active" ? "green" : currentStatus === "past_due" ? "amber" : "red"}-500/10`}>
                          {getStatusLabel(currentStatus)}
                        </span>
                        {cancelAtPeriodEnd && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-400 bg-amber-500/10 uppercase tracking-wider">
                            Canceling
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentTier === "free"
                          ? "Free tier — upgrade to unlock autonomous features"
                          : `$${getTierPrice(currentTier).toFixed(2)}/month — ${tierConfig?.actionsPerDay} actions per day`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status actions */}
                    {currentTier !== "free" && !cancelAtPeriodEnd && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={actionLoading === "cancel"}
                        className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                      >
                        {actionLoading === "cancel" ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <X className="w-3 h-3 mr-1" />
                        )}
                        Cancel
                      </Button>
                    )}
                    {cancelAtPeriodEnd && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReactivate}
                        disabled={actionLoading === "reactivate"}
                        className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                      >
                        {actionLoading === "reactivate" ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Reactivate
                      </Button>
                    )}
                    {currentTier === "free" && subscription?.canStartTrial && (
                      <Button
                        onClick={handleStartTrial}
                        disabled={actionLoading === "trial"}
                        className="bg-gradient-to-r from-primary to-accent text-white font-semibold"
                        size="sm"
                      >
                        {actionLoading === "trial" ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1" />
                        )}
                        Start 14-Day Trial
                      </Button>
                    )}
                  </div>
                </div>

                {/* Billing period info */}
                {periodEnd > 0 && (
                  <div className="relative z-10 mt-6 flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {currentTier === "free"
                          ? `Started ${formatDate(periodStart)}`
                          : `Billing period: ${formatDate(periodStart)} — ${formatDate(periodEnd)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {cancelAtPeriodEnd
                          ? "Access until period end"
                          : daysRemaining > 0
                          ? `${daysRemaining} days remaining`
                          : "Period ending soon"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-4 h-4" />
                      <span className="capitalize">
                        {subscription?.subscription?.paymentMethod
                          ? `${subscription.subscription.paymentMethod}`
                          : "Manual"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Cards — All Tiers */}
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Compare Plans
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TIERS.map((tier, index) => {
                    const isCurrentPlan = currentTier === tier.tier;
                    const isUpgrade = currentTierIndex < index;
                    const isDowngrade = currentTierIndex > index;

                    return (
                      <motion.div
                        key={tier.tier}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`relative rounded-xl border overflow-hidden transition-all duration-300 ${
                          isCurrentPlan
                            ? "ring-2 ring-primary border-primary/30 bg-card"
                            : tier.highlighted && !isCurrentPlan
                            ? "border-primary/20 bg-card hover:shadow-lg hover:border-primary/30"
                            : "border-border bg-card hover:border-border/80"
                        }`}
                      >
                        {tier.highlighted && !isCurrentPlan && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent" />
                        )}

                        <div className="p-4 space-y-4">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                tier.tier === "free" ? "bg-muted" :
                                tier.tier === "basic" ? "bg-blue-500/10" :
                                tier.tier === "pro" ? "bg-primary/10" :
                                "bg-accent/10"
                              }`}>
                                {tier.tier === "free" ? <Star className="w-4 h-4 text-muted-foreground" /> :
                                 tier.tier === "basic" ? <Zap className="w-4 h-4 text-blue-400" /> :
                                 tier.tier === "pro" ? <Rocket className="w-4 h-4 text-primary" /> :
                                 <Crown className="w-4 h-4 text-accent" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm">{tier.name}</h4>
                                <p className="text-[10px] text-muted-foreground">${tier.price > 0 ? `${tier.price.toFixed(2)}/mo` : "Free"}</p>
                              </div>
                            </div>
                            {isCurrentPlan && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary rounded-full uppercase">
                                Current
                              </span>
                            )}
                          </div>

                          {/* Limits */}
                          <div className="space-y-1 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Daily limit</span>
                              <span className="font-medium text-foreground">{tier.dailyLimit}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Auto-approve</span>
                              <span className="font-medium text-foreground">{tier.autonomyThreshold}</span>
                            </div>
                          </div>

                          {/* Features */}
                          <ul className="space-y-1">
                            {tier.features.slice(0, 3).map((feature, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                                <span className="text-muted-foreground line-clamp-1">{feature}</span>
                              </li>
                            ))}
                            {tier.features.length > 3 && (
                              <li className="text-[10px] text-muted-foreground pl-5">
                                +{tier.features.length - 3} more
                              </li>
                            )}
                          </ul>

                          {/* Action */}
                          {isCurrentPlan ? (
                            <Button variant="outline" disabled className="w-full text-xs h-8 border-primary/30 text-primary">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Current Plan
                            </Button>
                          ) : tier.tier === "free" ? (
                            <Button variant="outline" disabled className="w-full text-xs h-8">
                              Free Forever
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleUpgrade(tier.tier)}
                              disabled={actionLoading === `upgrade-${tier.tier}`}
                              variant={tier.highlighted ? "default" : "outline"}
                              size="sm"
                              className={`w-full text-xs h-8 ${
                                tier.highlighted
                                  ? "bg-gradient-to-r from-primary to-accent text-white font-semibold"
                                  : ""
                              }`}
                            >
                              {actionLoading === `upgrade-${tier.tier}` ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : isUpgrade ? (
                                <Rocket className="w-3 h-3 mr-1" />
                              ) : null}
                              {isUpgrade ? "Upgrade" : "Downgrade"}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Proceed to Stripe checkout */}
              {currentTier === "free" && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground mb-3">
                    Prefer to subscribe with credit card? Start with a free trial or go straight to paid.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TIERS.filter(t => t.tier !== "free").map((tier) => (
                      <Button
                        key={tier.tier}
                        variant="outline"
                        size="sm"
                        onClick={() => handleStripeCheckout(tier.tier)}
                        disabled={actionLoading === `stripe-${tier.tier}`}
                      >
                        {actionLoading === `stripe-${tier.tier}` ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <CreditCard className="w-3 h-3 mr-1" />
                        )}
                        {tier.name} — ${tier.price.toFixed(2)}/mo
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================ */}
          {/* TAB 2: Usage */}
          {/* ============================================ */}
          {activeTab === "usage" && (
            <motion.div
              key="usage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold mb-1">Usage This Period</h2>
                <p className="text-sm text-muted-foreground">
                  {periodStart && periodEnd
                    ? `${formatDate(periodStart)} — ${formatDate(periodEnd)}`
                    : "Current billing period"}
                </p>
              </div>

              {usage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Actions Count */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Actions Used</p>
                          <p className="text-xs text-muted-foreground">Agent actions this period</p>
                        </div>
                      </div>
                      <span className="text-2xl font-black">{usage.actionsCount}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>0</span>
                        <span>Limit: {tierConfig?.actionsPerDay || "∞"}/day</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (usage.actionsCount / (parseInt(tierConfig?.actionsPerDay || "10")) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spending */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Amount Spent</p>
                          <p className="text-xs text-muted-foreground">Total agent spending</p>
                        </div>
                      </div>
                      <span className="text-2xl font-black">{formatAmount(usage.spentAmount)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>$0</span>
                        <span>Limit: {tierConfig?.dailyLimit || "$10/day"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-400 transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (Number(BigInt(usage.spentAmount)) / 1e18) / (parseFloat(tierConfig?.dailyLimit?.replace(/[$,]/g, "") || "10")) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tier Info */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                        <TierIcon className={`w-4 h-4 ${getTierIconColor(currentTier)}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Plan Limits</p>
                        <p className="text-xs text-muted-foreground">Your {tierConfig?.name} plan</p>
                      </div>
                    </div>
                    <div className="pt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily spending limit</span>
                        <span className="font-medium">{tierConfig?.dailyLimit || "$10/day"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Per-action limit</span>
                        <span className="font-medium">{tierConfig?.perActionLimit || "$5/action"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto-approve threshold</span>
                        <span className="font-medium">{tierConfig?.autonomyThreshold || "$1"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Actions per day</span>
                        <span className="font-medium">{tierConfig?.actionsPerDay || "10"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Status */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Subscription Status</p>
                        <p className="text-xs text-muted-foreground">Current period details</p>
                      </div>
                    </div>
                    <div className="pt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-medium ${getStatusColor(currentStatus)}`}>
                          {getStatusLabel(currentStatus)}
                          {cancelAtPeriodEnd && " (Canceled)"}
                        </span>
                      </div>
                      {periodEnd > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Days remaining</span>
                          <span className="font-medium">{daysRemaining} days</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trial available</span>
                        <span className={`font-medium ${subscription?.canStartTrial ? "text-green-400" : "text-muted-foreground"}`}>
                          {subscription?.canStartTrial ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No usage data yet. Start using your agent to see stats here.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================ */}
          {/* TAB 3: History */}
          {/* ============================================ */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold mb-1">Payment & Order History</h2>
                <p className="text-sm text-muted-foreground">
                  Recent transactions and subscription changes
                </p>
              </div>

              {/* Subscription Timeline */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Subscription Timeline
                </h3>
                <div className="space-y-3">
                  {/* Current Period */}
                  {periodStart > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-green-400 ring-2 ring-green-400/20" />
                        <div className="w-0.5 flex-1 bg-border mt-1" />
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium">
                          {currentTier === "free" ? "Account Created" : `${tierConfig?.name} Plan Started`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(periodStart)}</p>
                      </div>
                    </div>
                  )}

                  {/* Cancel event */}
                  {cancelAtPeriodEnd && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
                        <div className="w-0.5 flex-1 bg-border mt-1" />
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium">Canceled — ends {formatDate(periodEnd)}</p>
                        <p className="text-xs text-muted-foreground">Access continues until period end</p>
                      </div>
                    </div>
                  )}

                  {/* Next Event */}
                  {periodEnd > 0 && !cancelAtPeriodEnd && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/30 ring-2 ring-muted-foreground/10" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {currentTier === "free" ? "Upgrade available" : "Next billing — renews"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(periodEnd)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Orders List */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Recent Orders
                </h3>

                {orders.length === 0 && !ordersLoading ? (
                  <div className="text-center py-6">
                    <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No orders yet. Your agent purchases will appear here.</p>
                  </div>
                ) : ordersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            order.status === "confirmed"
                              ? "bg-green-500/10"
                              : order.status === "failed"
                              ? "bg-red-500/10"
                              : "bg-amber-500/10"
                          }`}>
                            {order.status === "confirmed" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : order.status === "failed" ? (
                              <X className="w-4 h-4 text-red-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{order.items[0]?.name || `Order #${order.id.slice(0, 8)}`}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.items.length} item{order.items.length !== 1 ? "s" : ""} — {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${order.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{order.currency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link to full receipts */}
              <div className="text-center">
                <Link href="/api/agent/receipts" className="text-sm text-primary hover:underline">
                  View all receipts
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Billing & Payment Methods Section */}
        <div className="mt-12 pt-6 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              <span>Secure payments via Stripe</span>
              <Wallet className="w-4 h-4 ml-2" />
              <span>Crypto payments via Celo</span>
            </div>
            <Link href="/pricing" className="text-xs text-primary hover:underline">
              View full pricing details
            </Link>
          </div>

          {/* Stripe Customer Portal */}
          <div className="mt-4 p-5 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-bold">Billing & Payment Methods</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your payment methods, update billing info, view invoices,
                  and change your subscription plan directly via Stripe.
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenBillingPortal}
              disabled={portalLoading}
              variant="default"
              size="sm"
              className="shrink-0 bg-gradient-to-r from-primary to-accent text-white font-semibold"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-1.5" />
              )}
              Manage Billing
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
