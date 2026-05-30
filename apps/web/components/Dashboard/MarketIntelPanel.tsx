"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  BrainCircuit,
  Clock,
  ExternalLink,
  Loader2,
  Radar,
  Search,
  Sparkles,
  Store,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type {
  ExternalProduct,
  MarketPartnerIntegration,
  MarketSignal,
  RetailSignalMemory,
} from "@onpoint/shared-types";
import {
  loadMarketIntelSnapshot,
  saveMarketIntelSnapshot,
  type StoredMarketIntel,
} from "../../lib/utils/market-intelligence-storage";

const DEFAULT_QUERY = "black cropped blazer";
const QUICK_QUERIES = ["black cropped blazer", "red loafers", "linen summer dress"];

const signalLabels: Record<string, string> = {
  product_gap: "Product Gap",
  competitor_price: "Competitor Price",
  retailer_availability: "Retailer Availability",
  trend_match: "Trend Match",
  recommended_action: "Recommended Action",
};

const signalStyles: Record<string, string> = {
  product_gap: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  competitor_price: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  retailer_availability: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  trend_match: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  recommended_action: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

interface MarketIntelResponse {
  products: ExternalProduct[];
  signals: MarketSignal[];
  partnerIntegrations?: MarketPartnerIntegration[];
  memory?: RetailSignalMemory;
}

function compactPrice(value?: number, currency = "USD") {
  if (!value || value <= 0) return null;
  return `${currency} ${Math.round(value)}`;
}

function priceRange(signals: MarketSignal[]) {
  const priceSignal = signals.find((signal) => signal.type === "competitor_price");
  if (!priceSignal?.title) return "—";
  return priceSignal.title.replace(/^Comparable price range:\s*/i, "");
}

function provenanceLabel(signal: MarketSignal) {
  if (signal.type === "competitor_price") return "Bright Data SERP · Google Shopping";
  if (signal.type === "retailer_availability") return `Bright Data · ${signal.source}`;
  if (signal.type === "product_gap") return "OnPoint catalog fallback";
  return signal.source.replace(/_/g, " ");
}

function formatTimestamp(value?: string) {
  if (!value) return "now";
  try {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "now";
  }
}

const partnerStatusStyles: Record<string, string> = {
  sent: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  ready: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  skipped: "border-border bg-muted text-muted-foreground",
  failed: "border-amber-500/20 bg-amber-500/10 text-amber-300",
};

export function MarketIntelPanel() {
  const [query, setQuery] = React.useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = React.useState(DEFAULT_QUERY);
  const [result, setResult] = React.useState<MarketIntelResponse | null>(null);
  const [shopperSnapshot, setShopperSnapshot] = React.useState<StoredMarketIntel | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runSearch = React.useCallback(async (nextQuery: string) => {
    const cleanQuery = nextQuery.trim();
    if (cleanQuery.length < 2) return;

    setLoading(true);
    setError(null);
    setActiveQuery(cleanQuery);

    try {
      const response = await fetch("/api/market-intelligence/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanQuery, limit: 4 }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
      saveMarketIntelSnapshot({
        query: cleanQuery,
        products: data.products || [],
        signals: data.signals || [],
        partnerIntegrations: data.partnerIntegrations || [],
        memory: data.memory,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const stored = loadMarketIntelSnapshot();
    if (stored) {
      setShopperSnapshot(stored);
      setQuery(stored.query);
      setActiveQuery(stored.query);
      setResult({
        products: stored.products,
        signals: stored.signals,
        partnerIntegrations: stored.partnerIntegrations || [],
        memory: stored.memory,
      });
      return;
    }

    runSearch(DEFAULT_QUERY);
  }, [runSearch]);

  const signals = result?.signals ?? [];
  const products = result?.products ?? [];
  const partnerIntegrations = result?.partnerIntegrations ?? [];
  const memory = result?.memory;
  const primaryAction = signals.find((signal) => signal.type === "recommended_action");
  const productGapCount = signals.filter((signal) => signal.type === "product_gap").length;
  const retailerCount = new Set(
    signals
      .filter((signal) => signal.type === "retailer_availability")
      .map((signal) => signal.source),
  ).size;
  const summaryCards = [
    {
      label: "Product Gaps",
      value: productGapCount,
      icon: Radar,
    },
    {
      label: "Price Range",
      value: priceRange(signals),
      icon: TrendingUp,
    },
    {
      label: "Retailers Found",
      value: retailerCount,
      icon: Store,
    },
    {
      label: "Next Action",
      value: primaryAction ? "Ready" : "Pending",
      icon: Sparkles,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Radar className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Retail GTM Intelligence</span>
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            Live market signals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Search shopper intent and see the product gaps, competitor prices, and actions OnPoint can hand to a Curator.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Live web evidence via Bright Data SERP + Web Unlocker, with AI/ML API briefs, Cognee memory, and TriggerWare workflows.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch(query);
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground md:w-64"
            placeholder="Search product intent"
          />
          <button
            onClick={() => runSearch(query)}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-60"
            aria-label="Run market intelligence search"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {shopperSnapshot && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Using latest shopper intent:</span>
          <span className="rounded-full bg-background px-2 py-1 text-xs font-semibold text-primary">
            {shopperSnapshot.query}
          </span>
          <span className="text-xs text-muted-foreground">
            captured {formatTimestamp(shopperSnapshot.updatedAt)}
          </span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {QUICK_QUERIES.map((item) => (
          <button
            key={item}
            onClick={() => {
              setQuery(item);
              runSearch(item);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeQuery === item
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <card.icon className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="truncate text-lg font-black text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Signals</h3>
            </div>
            <span className="text-xs text-muted-foreground">{signals.length} found</span>
          </div>

          <div className="space-y-3">
            {loading && !signals.length ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))
            ) : signals.length > 0 ? (
              signals.map((signal) => (
                <article key={signal.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${signalStyles[signal.type] ?? "border-border bg-muted text-muted-foreground"}`}>
                      {signalLabels[signal.type] ?? signal.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.round(signal.confidence * 100)}% confidence
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(signal.createdAt)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{signal.title}</h4>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-primary">
                    {provenanceLabel(signal)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.evidence}</p>
                  <p className="mt-2 text-xs font-medium text-foreground">{signal.action}</p>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No signals yet. Run a live web search to create market intelligence.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Next Action</h3>
            </div>
            <p className="text-sm text-foreground">
              {primaryAction?.action ?? "Run a search to generate a Curator-facing merchandising action."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Agent Memory</h3>
              </div>
              {memory && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {memory.repeatedIntentCount}x intent
                </span>
              )}
            </div>
            {memory ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Cognee-ready memory for <span className="font-semibold text-foreground">{memory.query}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-background/40 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider">Known Gaps</p>
                    <p className="mt-1 text-sm font-black text-foreground">{memory.knownGapCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider">Retailers</p>
                    <p className="mt-1 text-sm font-black text-foreground">{memory.rememberedRetailers.length}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a search to create retail signal memory.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Partner Actions</h3>
              </div>
              <span className="text-xs text-muted-foreground">{partnerIntegrations.length}</span>
            </div>
            <div className="space-y-2">
              {partnerIntegrations.map((integration) => (
                <div key={integration.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{integration.label}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${partnerStatusStyles[integration.status] ?? partnerStatusStyles.ready}`}>
                      {integration.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{integration.summary}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{integration.evidence}</p>
                </div>
              ))}
              {!loading && partnerIntegrations.length === 0 && (
                <p className="text-sm text-muted-foreground">No partner action generated yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">Live Products</h3>
              <span className="text-xs text-muted-foreground">{products.length}</span>
            </div>
            <div className="space-y-3">
              {products.map((product) => (
                <a
                  key={product.id}
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-border bg-background/40 p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.source}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xs font-medium text-primary">
                    {compactPrice(product.price) ?? "Price unavailable"}
                  </p>
                </a>
              ))}
              {!loading && products.length === 0 && (
                <p className="text-sm text-muted-foreground">No live products returned.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
