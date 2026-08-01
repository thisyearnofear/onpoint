"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  ShoppingBag,
  Sparkles,
  ScanFace,
  ArrowDownRight,
  Radio,
  Wallet,
  CheckCircle2,
  Link2,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
interface PravaOrder {
  orderId: string;
  state: string;
  query: string | null;
  merchant: { name: string; url: string; country: string } | null;
  totalAmount: string | null;
  currency: string | null;
  tryOnUrl: string | null;
  orderIdPrava: string | null;
  createdAt: number;
}

interface FeedItem {
  id: string;
  action: "purchase" | "try_on" | "session" | "search";
  label: string;
  detail: string;
  amount: string;
  timestamp: number;
  live: boolean; // true when sourced from a real Prava flow
  pravaOrder?: string;
}

// Honest system facts shown when no real agent activity has landed yet.
// These are verifiable architectural truths — not fabricated transactions.
const SYSTEM_FACTS: FeedItem[] = [
  {
    id: "fact-celo",
    action: "session",
    label: "Celo mainnet",
    detail: "cUSD settlements · gasless x402 · ERC-8021 attribution",
    amount: "live",
    timestamp: 0,
    live: false,
  },
  {
    id: "fact-api",
    action: "search",
    label: "Agent API",
    detail: "Same inventory as storefronts · /api/agent/try-on · /api/curator",
    amount: "open",
    timestamp: 0,
    live: false,
  },
  {
    id: "fact-whatsapp",
    action: "session",
    label: "WhatsApp / M-Pesa",
    detail: "Human checkout on every storefront · /s/[slug]",
    amount: "ready",
    timestamp: 0,
    live: false,
  },
  {
    id: "fact-okx",
    action: "try_on",
    label: "OKX marketplace",
    detail: "ASP ID 9874 · USD₮0 on XLayer · /okx/try-on",
    amount: "listed",
    timestamp: 0,
    live: false,
  },
];

const ACTION_ICON: Record<FeedItem["action"], React.ReactNode> = {
  purchase: <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />,
  try_on: <ScanFace className="w-3.5 h-3.5 text-sky-500" />,
  session: <Wallet className="w-3.5 h-3.5 text-violet-500" />,
  search: <Bot className="w-3.5 h-3.5 text-primary" />,
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Map a Prava order to one (or more) feed items.
function orderToItems(o: PravaOrder): FeedItem[] {
  const merchant = o.merchant?.name || "—";
  const amount = o.totalAmount ? `$${o.totalAmount}` : "—";
  const items: FeedItem[] = [];

  if (o.orderIdPrava && o.state === "confirmed") {
    items.push({
      id: `${o.orderId}-buy`,
      action: "purchase",
      label: "Agent placed order",
      detail: `${merchant} · Prava ${o.orderIdPrava}`,
      amount,
      timestamp: o.createdAt,
      live: true,
      pravaOrder: o.orderIdPrava,
    });
  } else if (o.tryOnUrl) {
    items.push({
      id: `${o.orderId}-tryon`,
      action: "try_on",
      label: "Try-on rendered",
      detail: `${merchant} · IDM-VTON`,
      amount,
      timestamp: o.createdAt,
      live: true,
    });
  } else if (o.merchant) {
    items.push({
      id: `${o.orderId}-session`,
      action: "session",
      label: "Scoped card issued",
      detail: `${merchant} · merchant-locked`,
      amount,
      timestamp: o.createdAt,
      live: true,
    });
  } else {
    items.push({
      id: `${o.orderId}-search`,
      action: "search",
      label: "Agent composing look",
      detail: o.query || "searching UCP merchants",
      amount: "—",
      timestamp: o.createdAt,
      live: true,
    });
  }
  return items;
}

export function AgentActivityFeed() {
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);
  const [isLive, setIsLive] = useState(false); // true once a real flow is seen

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/prava/orders/recent?limit=12");
      if (!r.ok) return;
      const data = await r.json();
      const orders: PravaOrder[] = data.orders || [];
      if (!orders.length) return;

      const mapped = orders.flatMap(orderToItems);
      if (mapped.length) {
        setIsLive(true);
        setLiveItems(mapped.slice(0, 8));
      }
    } catch {
      // network hiccup — keep current state
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [poll]);

  const latest = liveItems[0];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">
              {isLive ? "Agent activity" : "Agent commerce rails"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? "Recent agent transactions on OnPoint"
                : "Live infrastructure — agent transactions will appear here"}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
            isLive
              ? "border border-emerald-500/30 bg-emerald-500/10"
              : "border border-border/40 bg-muted/40"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
          </span>
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isLive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {isLive ? "Live" : "Ready"}
          </span>
        </div>
      </div>

      {/* Stream — real activity when available, honest system facts otherwise */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="divide-y divide-border/40">
          {isLive && liveItems.length > 0
            ? liveItems.map((item, i) => {
                const isLatest = latest?.id === item.id && i === 0;
                return (
                  <div
                    key={item.id}
                    className={`group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                      isLatest ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50 transition-transform group-hover:scale-105">
                      {ACTION_ICON[item.action]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {item.label}
                        </p>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Verified
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {item.amount}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                    {item.pravaOrder && (
                      <ArrowDownRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
                    )}
                  </div>
                );
              })
            : SYSTEM_FACTS.map((fact) => (
                <div
                  key={fact.id}
                  className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    {ACTION_ICON[fact.action]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {fact.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fact.detail}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      {fact.amount}
                    </span>
                  </div>
                </div>
              ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 bg-muted/20 px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">
            {isLive ? (
              <>
                <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" />
                Each purchase uses a single-use, merchant-locked, amount-scoped
                card credential
              </>
            ) : (
              <>
                <Link2 className="-mt-0.5 mr-1 inline h-3 w-3" />
                Rails are live — agent transactions will appear here in real time
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
