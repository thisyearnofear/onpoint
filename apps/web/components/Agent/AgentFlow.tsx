"use client";

import { useState, useCallback } from "react";
import {
  Check,
  Circle,
  ReceiptText,
  ScanFace,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AgentSearchBar } from "./AgentSearchBar";
import type { SearchResult } from "./AgentSearchBar";
import { AgentResults } from "./AgentResults";
import { AgentCheckoutCard } from "./AgentCheckoutCard";

interface Props {
  onOrderConfirmed?: () => void;
}

interface MissionProgress {
  state: string;
  hasTryOn: boolean;
}

const missionSteps = [
  { label: "Product", icon: Search },
  { label: "Fit", icon: ScanFace },
  { label: "Permission", icon: ShieldCheck },
  { label: "Outcome", icon: ReceiptText },
];

function progressIndex(
  selectedProduct: SearchResult | null,
  progress: MissionProgress | null,
) {
  if (!selectedProduct) return 0;
  if (!progress) return 1;

  if (
    [
      "credential_ready",
      "checking_out",
      "checkout_unknown",
      "confirmed",
      "sandbox_completed",
      "sandbox_declined",
      "self_check_completed",
      "failed",
    ].includes(progress.state)
  ) {
    return 3;
  }

  if (
    ["creating_session", "awaiting_approval", "approved"].includes(
      progress.state,
    )
  ) {
    return 2;
  }

  return 1;
}

function MissionRail({
  query,
  product,
  progress,
}: {
  query: string;
  product: SearchResult | null;
  progress: MissionProgress | null;
}) {
  const activeIndex = progressIndex(product, progress);
  const activeOffer =
    product?.offers?.find((offer) => offer.available) || product?.offers?.[0];

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
            Live shopping mission
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {product?.title || query || "Tell OnPoint what to find"}
          </p>
        </div>
        {product && (
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-xs font-semibold">{product.merchant}</p>
              {activeOffer?.price != null && (
                <p className="text-xs text-muted-foreground">
                  ${activeOffer.price}
                </p>
              )}
            </div>
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt=""
                className="h-11 w-9 rounded-lg border border-border/50 object-cover"
              />
            )}
          </div>
        )}
      </div>

      <ol
        className="grid grid-cols-4 px-3 py-4 sm:px-5"
        aria-label="Agent checkout progress"
      >
        {missionSteps.map(({ label, icon: Icon }, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={label}
              className="relative flex flex-col items-center gap-2"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-[0.9rem] h-px w-full transition-colors duration-500 ${
                    complete || active ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-500 ${
                  complete
                    ? "border-primary bg-primary text-white"
                    : active
                      ? "border-primary bg-background text-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.1)]"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {complete ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              <span
                className={`text-[10px] font-semibold sm:text-xs ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The agent flow: search → results → fit → scoped permission → truthful outcome.
 * The mission rail keeps the selected product visible throughout the journey.
 */
export function AgentFlow({ onOrderConfirmed }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(
    null,
  );
  const [progress, setProgress] = useState<MissionProgress | null>(null);
  const [searched, setSearched] = useState(false);

  const handleResults = useCallback((r: SearchResult[], q: string) => {
    setResults(r);
    setQuery(q);
    setSearched(true);
    setOrderId(null);
    setSelectedProduct(null);
    setProgress(null);
  }, []);

  const handleSelectOrder = useCallback((id: string, product: SearchResult) => {
    setOrderId(id);
    setSelectedProduct(product);
    setProgress(null);
    setTimeout(() => {
      document.getElementById("agent-card")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }, []);

  const handleReset = useCallback(() => {
    setOrderId(null);
    setResults([]);
    setSearched(false);
    setQuery("");
    setSelectedProduct(null);
    setProgress(null);
    document.getElementById("agent-search")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  const handleConfirmed = useCallback(() => {
    onOrderConfirmed?.();
  }, [onOrderConfirmed]);

  return (
    <div className="space-y-6">
      <MissionRail
        query={query}
        product={selectedProduct}
        progress={progress}
      />

      {!orderId && (
        <div id="agent-search-form">
          <AgentSearchBar onResults={handleResults} />
        </div>
      )}

      {searched && !orderId && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {results.length > 0
              ? `${results.length} live ${results.length === 1 ? "product" : "products"} · Prava UCP discovery`
              : "No items found"}
          </p>
          <AgentResults
            results={results}
            query={query}
            onSelectOrder={handleSelectOrder}
          />
        </div>
      )}

      {orderId && (
        <div id="agent-card">
          <AgentCheckoutCard
            orderId={orderId}
            selectedProduct={selectedProduct}
            onProgressChange={setProgress}
            onConfirmed={handleConfirmed}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  );
}
