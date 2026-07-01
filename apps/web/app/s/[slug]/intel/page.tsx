"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  ShoppingBag,
  Share2,
  Camera,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Search,
  DollarSign,
  Target,
  Zap,
  Package,
  ArrowUpRight,
} from "lucide-react";

interface FunnelStats {
  pageViews: number;
  tryOns: number;
  shares: number;
  buyClicks: number;
}

interface MarketSignal {
  type: string;
  description: string;
  source?: string;
  confidence?: number;
  data?: Record<string, unknown>;
}

interface MarketProduct {
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  source: string;
  sourceUrl?: string;
}

interface IntelligenceData {
  query: string;
  products: MarketProduct[];
  signals: MarketSignal[];
  partnerIntegrations: Array<{
    partner: string;
    status: string;
    description?: string;
  }>;
  memory: {
    repeatedIntentCount: number;
    knownGapCount: number;
    rememberedRetailers: string[];
    lastSeenAt: string;
  };
}

const SEARCH_QUERIES = [
  "Arsenal home jersey 2025",
  "Chelsea away kit",
  "Real Madrid football shirt",
  "Liverpool home jersey",
  "Barcelona football kit",
];

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="pl-5 border-l-2 border-primary/20">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function SignalCard({ signal }: { signal: MarketSignal }) {
  const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
    product_gap: { icon: Package, color: "#ef4444", label: "Product Gap" },
    competitor_price: { icon: DollarSign, color: "#f59e0b", label: "Competitor Price" },
    retailer_availability: { icon: ShoppingBag, color: "#3b82f6", label: "Retailer" },
    trend_match: { icon: TrendingUp, color: "#22c55e", label: "Trend" },
    recommended_action: { icon: Zap, color: "#8b5cf6", label: "Action" },
  };

  const config = typeConfig[signal.type] || { icon: AlertTriangle, color: "#6b7280", label: signal.type };
  const Icon = config.icon;

  return (
    <div className="pl-5 border-l-2 border-primary/20">
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${config.color}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: config.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{signal.description}</p>
          {signal.source && (
            <p className="mt-2 text-xs text-muted-foreground">
              Source: {signal.source}
              {signal.confidence ? ` · ${Math.round(signal.confidence * 100)}% confidence` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CuratorIntelPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [funnel, setFunnel] = useState<FunnelStats>({ pageViews: 0, tryOns: 0, shares: 0, buyClicks: 0 });
  const [funnelLoading, setFunnelLoading] = useState(true);

  const [intel, setIntel] = useState<IntelligenceData | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string>(SEARCH_QUERIES[0] ?? "");
  const [customQuery, setCustomQuery] = useState("");

  useEffect(() => {
    setFunnelLoading(true);
    fetch(`/api/curator/analytics/funnel?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFunnel(data);
      })
      .catch(() => {})
      .finally(() => setFunnelLoading(false));
  }, [slug]);

  const fetchIntel = useCallback(async (query: string) => {
    setIntelLoading(true);
    setIntelError(null);
    try {
      const res = await fetch("/api/market-intelligence/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          curatorSlug: slug,
          maxResults: 8,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIntel(data);
    } catch (err) {
      setIntelError(err instanceof Error ? err.message : "Failed to load intelligence");
    } finally {
      setIntelLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchIntel(activeQuery);
  }, [activeQuery, fetchIntel]);

  const conversionRate = funnel.pageViews > 0
    ? ((funnel.buyClicks / funnel.pageViews) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/s/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Storefront
            </Link>
            <span className="text-border">|</span>
            <span className="text-sm font-bold capitalize">{slug} Intelligence</span>
          </div>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            OnPoint
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">Retail Intelligence</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Live market signals from {slug}&apos;s storefront visitors. See what customers want,
            what the market offers, and where your catalog has gaps.
          </p>
        </div>

        {/* WhatsApp comparison banner */}
        <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                This is the data you lose on WhatsApp.
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                On WhatsApp alone, you don&apos;t know how many people viewed your items,
                how many tried them on, or how many shared them with friends. OnPoint shows
                you the full funnel — so you know what&apos;s working and what&apos;s not.
              </p>
            </div>
          </div>
        </div>

        {/* Funnel stats */}
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Storefront Funnel
            <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
              OnPoint only
            </span>
          </h2>
          {funnelLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard icon={Eye} label="Page Views" value={funnel.pageViews} color="#3b82f6" />
                <StatCard icon={Camera} label="Try-Ons" value={funnel.tryOns} color="#8b5cf6" />
                <StatCard icon={Share2} label="Shares" value={funnel.shares} color="#22c55e" />
                <StatCard icon={MousePointerClick} label="Buy Clicks" value={funnel.buyClicks} color="#f59e0b" />
                <StatCard icon={TrendingUp} label="Conversion" value={`${conversionRate}%`} color="#ef4444" />
              </div>
              {/* WhatsApp comparison row */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <span>
                  On WhatsApp alone, all of these would be <span className="font-bold text-muted-foreground">0</span>.
                  You&apos;d have no idea how many people looked, tried, or shared — only who actually messaged you.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Market intelligence */}
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Search className="h-4 w-4" />
            Market Signals
          </h2>

          {/* Query selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {SEARCH_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setActiveQuery(q)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeQuery === q
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Custom query */}
          <div className="mb-6 flex gap-2">
            <input
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Search any product to see market signals..."
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customQuery.trim()) {
                  setActiveQuery(customQuery.trim());
                  setCustomQuery("");
                }
              }}
            />
            <button
              onClick={() => {
                if (customQuery.trim()) {
                  setActiveQuery(customQuery.trim());
                  setCustomQuery("");
                }
              }}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {intelLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Searching the live web for &quot;{activeQuery}&quot;...
              </p>
            </div>
          ) : intelError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
              <p className="mt-2 text-sm font-medium text-destructive">{intelError}</p>
              <button
                onClick={() => fetchIntel(activeQuery)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : intel ? (
            <div className="space-y-6">
              {/* Signals */}
              {intel.signals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Signals ({intel.signals.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {intel.signals.map((signal, i) => (
                      <SignalCard key={`${signal.type}-${i}`} signal={signal} />
                    ))}
                  </div>
                </div>
              )}

              {/* Market products */}
              {intel.products.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Market Products ({intel.products.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {intel.products.map((product, i) => (
                      <div
                        key={`${product.source}-${i}`}
                        className="overflow-hidden rounded-lg border border-border"
                      >
                        {product.imageUrl && (
                          <div className="aspect-square bg-muted">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-bold">
                              {product.currency} {product.price.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">{product.source}</span>
                          </div>
                          {product.sourceUrl && (
                            <a
                              href={product.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              View <ArrowUpRight className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memory & partner status */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="pl-5 border-l-2 border-primary/20">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Retail Memory
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Repeated intent</p>
                      <p className="font-bold">{intel.memory.repeatedIntentCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Known gaps</p>
                      <p className="font-bold">{intel.memory.knownGapCount}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Tracked retailers</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {intel.memory.rememberedRetailers.length > 0 ? (
                          intel.memory.rememberedRetailers.map((r) => (
                            <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">None yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pl-5 border-l-2 border-primary/20">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Partner Integrations
                  </h3>
                  <div className="mt-3 space-y-2">
                    {intel.partnerIntegrations.map((p) => (
                      <div key={p.partner} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{p.partner}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : p.status === "ready"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommended actions */}
              {intel.signals
                .filter((s) => s.type === "recommended_action")
                .map((action, i) => (
                  <div
                    key={`action-${i}`}
                    className="rounded-lg border border-primary/30 bg-primary/5 p-5"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <Target className="h-4 w-4" />
                      <p className="text-xs font-bold uppercase tracking-wider">Recommended Action</p>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed">{action.description}</p>
                  </div>
                ))}

              {intel.products.length === 0 && intel.signals.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No signals found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different search query or check back later.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <h2 className="text-lg font-bold">Ready to act on these signals?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Stock what customers are searching for. Update your listings via WhatsApp chat-ops.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href={`/s/${slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <ShoppingBag className="h-4 w-4" />
              View Storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
