"use client";

import { useState } from "react";
import { Loader2, ArrowRight, ImageIcon } from "lucide-react";
import type { SearchResult } from "./AgentSearchBar";

interface Props {
  results: SearchResult[];
  query: string;
  onSelectOrder: (orderId: string, product: SearchResult) => void;
}

export function AgentResults({ results, query, onSelectOrder }: Props) {
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (result: SearchResult) => {
    setCreating(result.product_id);
    setError(null);
    try {
      const offer =
        result.offers?.find((o) => o.available) || result.offers?.[0];
      const r = await fetch("/prava/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          productId: result.product_id,
          variantId: offer?.variant_id,
          merchant: result.merchant,
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || `Quote preparation failed (${r.status})`);
      if (data.orderId) onSelectOrder(data.orderId, result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Quote preparation failed");
    } finally {
      setCreating(null);
    }
  };

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          No results. Try a different style query.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {results.map((r) => {
          const price =
            r.offers?.find((o) => o.available)?.price || r.offers?.[0]?.price;
          const isCreating = creating === r.product_id;
          return (
            <button
              key={r.product_id}
              onClick={() => handleSelect(r)}
              disabled={isCreating}
              className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.98] disabled:opacity-60"
            >
              {/* Image */}
              <div className="relative aspect-[4/5] overflow-hidden bg-muted/40">
                {r.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.image}
                    alt={r.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                {isCreating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="mt-2 text-xs font-semibold">
                      Locking product + quote
                    </p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {r.merchant}
                </p>
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {r.title}
                </p>
                {price != null && (
                  <p className="text-sm font-bold text-foreground">${price}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-primary">
                  Review quote &amp; fit
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
