"use client";

import { useState, useCallback } from "react";
import { AgentSearchBar } from "./AgentSearchBar";
import type { SearchResult } from "./AgentSearchBar";
import { AgentResults } from "./AgentResults";
import { AgentCheckoutCard } from "./AgentCheckoutCard";

interface Props {
  onOrderConfirmed?: () => void;
}

/**
 * The agent flow: search → results → mutating checkout card.
 * Lives on the homepage as a native section — not a demo page.
 */
export function AgentFlow({ onOrderConfirmed }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleResults = useCallback((r: SearchResult[], q: string) => {
    setResults(r);
    setQuery(q);
    setSearched(true);
    setOrderId(null);
  }, []);

  const handleSelectOrder = useCallback((id: string) => {
    setOrderId(id);
    // Scroll the card into view
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
      <ol className="mx-auto grid max-w-lg grid-cols-4 gap-2" aria-label="Agent checkout steps">
        {["Product", "Fit", "Permission", "Outcome"].map((step, index) => (
          <li key={step} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-primary/25 bg-primary/[0.04] text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {/* Search */}
      <div id="agent-search-form">
        <AgentSearchBar onResults={handleResults} />
      </div>

      {/* Results */}
      {searched && !orderId && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {results.length > 0
              ? `${results.length} live ${results.length === 1 ? "product" : "products"} · Prava UCP discovery`
              : "No items found"}
          </p>
          <AgentResults results={results} query={query} onSelectOrder={handleSelectOrder} />
        </div>
      )}

      {/* Checkout card */}
      {orderId && (
        <div id="agent-card">
          <AgentCheckoutCard orderId={orderId} onConfirmed={handleConfirmed} onReset={handleReset} />
        </div>
      )}
    </div>
  );
}
