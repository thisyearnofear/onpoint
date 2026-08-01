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
      {/* Search */}
      <div id="agent-search">
        <AgentSearchBar onResults={handleResults} />
      </div>

      {/* Results */}
      {searched && !orderId && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {results.length > 0
              ? `${results.length} brand ${results.length === 1 ? "item" : "items"} found via Prava UCP`
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
