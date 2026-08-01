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

// Seed rows so the feed reads as a living stream before real flows land.
const SEED_ITEMS: FeedItem[] = [
  {
    id: "seed-1",
    action: "purchase",
    label: "Agent placed order",
    detail: "Wanja · Arsenal 24/25 Home Kit (M)",
    amount: "$19.23",
    timestamp: Date.now() - 2 * 60_000,
    live: false,
  },
  {
    id: "seed-2",
    action: "try_on",
    label: "Try-on rendered",
    detail: "Nia Digital · Jersey Dress · IDM-VTON",
    amount: "$0.03",
    timestamp: Date.now() - 5 * 60_000,
    live: false,
  },
  {
    id: "seed-3",
    action: "purchase",
    label: "Agent placed order",
    detail: "Grace · Manchester United Away Kit (L)",
    amount: "$22.50",
    timestamp: Date.now() - 12 * 60_000,
    live: false,
  },
  {
    id: "seed-4",
    action: "session",
    label: "Scoped card issued",
    detail: "Celo · gasless USDC · x402",
    amount: "—",
    timestamp: Date.now() - 18 * 60_000,
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
  const [items, setItems] = useState<FeedItem[]>(SEED_ITEMS);
  const [isLive, setIsLive] = useState(false); // true once a real flow is seen

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/prava/orders/recent?limit=12");
      if (!r.ok) return;
      const data = await r.json();
      const orders: PravaOrder[] = data.orders || [];
      if (!orders.length) return;

      const liveItems = orders.flatMap(orderToItems);
      if (liveItems.length) setIsLive(true);

      setItems(() => {
        // Merge: live items first (they sort by recency), seeds fill in after.
        const merged = [...liveItems, ...SEED_ITEMS];
        merged.sort((a, b) => b.timestamp - a.timestamp);
        return merged.slice(0, 8);
      });
    } catch {
      // network hiccup — keep seeds
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [poll]);

  const latest = items[0];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Live agent feed</h3>
            <p className="text-xs text-muted-foreground">
              Autonomous commerce happening right now
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {isLive ? "Live" : "Streaming"}
          </span>
        </div>
      </div>

      {/* Stream */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="divide-y divide-border/40">
          {items.map((item, i) => {
            const isLatest = latest?.id === item.id && i === 0;
            return (
              <div
                key={item.id}
                className={`group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                  isLatest ? "bg-primary/[0.03]" : ""
                }`}
              >
                {/* action icon */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50 transition-transform group-hover:scale-105">
                  {ACTION_ICON[item.action]}
                </div>

                {/* text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    {item.live && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        Prava
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>

                {/* amount + time */}
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
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 bg-muted/20 px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">
            <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" />
            Each purchase uses a single-use, merchant-locked, amount-scoped card
            credential
          </p>
        </div>
      </div>
    </div>
  );
}
