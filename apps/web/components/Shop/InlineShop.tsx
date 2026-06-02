"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ShopGrid } from "@repo/shared-ui";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { FashionItem } from "@onpoint/shared-types";
import { Sparkles, Camera, Globe, Loader2 } from "lucide-react";
import { PanelSkeleton } from "../ui/PanelSkeleton";
import { Button } from "@repo/ui/button";
import { useCartStore } from "../../lib/stores/cart-store";
import { CheckoutModal } from "./CheckoutModal";
import { CartDrawer, CartButton } from "./CartDrawer";
import { FlyToCartOverlay, type FlyItem } from "./FlyToCartOverlay";
import { fetchAgentApi } from "../../lib/utils/agent-api";
import { RichProductGroup } from "./RichProductCard";
import { ExternalPickCard, LocalPickCard, ProvenanceBar } from "./CuratedPickCard";
import type { ProductResult } from "@onpoint/shared-types";
import type { MarketSignal } from "@onpoint/shared-types";
import { useCuratedPicksStore } from "../../lib/stores/curated-picks-store";
import {
  fashionItemToTryOnSelection,
  setPendingTryOnSelection,
} from "../../lib/utils/try-on-selection";
import {
  productResultToExternalProduct,
  saveMarketIntelSnapshot,
} from "../../lib/utils/market-intelligence-storage";

interface InlineShopProps {
  onTryOn?: (item?: FashionItem) => void;
}

interface ExternalFind {
  description: string;
  amount: string;
  source?: string;
  externalUrl?: string;
  products?: ProductResult[];
  marketSignals?: MarketSignal[];
  metadata?: {
    marketSignals?: MarketSignal[];
  };
}

export function InlineShop({ onTryOn }: InlineShopProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [externalFinds, setExternalFinds] = useState<ExternalFind[]>([]);
  const [flyingItem, setFlyingItem] = useState<FlyItem | null>(null);
  const flyCallbackRef = useRef<(() => void) | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const [isLoading, setIsLoading] = useState(true);
  const curatedPicks = useCuratedPicksStore((s) => s.picks);
  const isCurating = useCuratedPicksStore((s) => s.loading);
  const fetchPicks = useCuratedPicksStore((s) => s.fetchPicks);

  const handleFlyComplete = useCallback(() => {
    flyCallbackRef.current?.();
    flyCallbackRef.current = null;
    setFlyingItem(null);
  }, []);

  useEffect(() => {
    // Fetch accepted external search results from agent suggestions
    fetchAgentApi("/api/agent/suggestion?agentId=onpoint-stylist")
      .then((res) => (res.ok ? res.json() : { suggestions: [] }))
      .then((data) => {
        const externals = (data.suggestions || [])
          .filter(
            (s: any) =>
              s.actionType === "external_search" &&
              s.status === "accepted" &&
              s.externalUrl,
          )
          .slice(0, 4)
          .map((s: any) => ({
            description: s.description,
            amount: s.amount,
            source: s.source,
            externalUrl: s.externalUrl,
            products: s.products,
            marketSignals: s.marketSignals || s.metadata?.marketSignals,
          }));
        setExternalFinds(externals);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Fetch curated picks from session curation context
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("stylistAnalysis");
      if (stored) {
        try {
          const analysis = JSON.parse(stored);
          const ctx = analysis.curationContext;
          if (ctx && ctx.takeaways?.length > 0) {
            fetchPicks(ctx);
          }
        } catch {
          // sessionStorage parse failure is non-fatal
        }
      }
    }
  }, [fetchPicks]);

  useEffect(() => {
    const find = externalFinds.find(
      (item) => item.products?.length && item.marketSignals?.length,
    );
    if (!find?.products || !find.marketSignals) return;

    const query = find.marketSignals[0]?.query || find.description;
    saveMarketIntelSnapshot({
      query,
      products: find.products.map((product, index) =>
        productResultToExternalProduct(product, index, query),
      ),
      signals: find.marketSignals,
    });
  }, [externalFinds]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <PanelSkeleton variant="shop" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shop</h2>
          <p className="text-muted-foreground text-sm">
            Curated pieces your AI stylist recommends
          </p>
        </div>
        <CartButton />
      </div>

      {/* AI Picks — curated picks + web-discovered products */}
      {(externalFinds.length > 0 || curatedPicks.length > 0 || isCurating) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Your AI Picks
            </h3>
            {isCurating && (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching live stores...
              </span>
            )}
          </div>

          {/* Provenance context bar */}
          {curatedPicks.length > 0 && (
            <ProvenanceBar
              provenance={curatedPicks[0]?.provenance}
              pickCount={curatedPicks.length}
              hasExternal={curatedPicks.some((p) => p.source === "external")}
            />
          )}

          {/* Curated picks from session context */}
          {curatedPicks.length > 0 && (
            <div className="space-y-4">
              {curatedPicks
                .filter((p) => p.source === "external")
                .map((pick, i) => (
                  <ExternalPickCard key={`ext-${i}`} pick={pick} position={i} compact />
                ))}
              {curatedPicks.filter((p) => p.source === "local").length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {curatedPicks
                    .filter((p) => p.source === "local")
                    .map((pick) => {
                      const item = pick.item as FashionItem;
                      return (
                        <LocalPickCard
                          key={item.id}
                          pick={pick}
                          onClick={(clickedItem) => {
                            setPendingTryOnSelection(fashionItemToTryOnSelection(clickedItem));
                            addItem(clickedItem);
                            onTryOn?.(clickedItem);
                          }}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Loading skeleton for curated picks */}
          {isCurating && curatedPicks.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-1.5 space-y-1.5">
                    <div className="h-2.5 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Web-discovered products from live session suggestions */}
          {externalFinds.length > 0 && (
            <div className="space-y-4">
              {externalFinds.map((find, i) => (
                find.products && find.products.length > 0 ? (
                  <RichProductGroup
                    key={i}
                    title={find.description}
                    products={find.products}
                  />
                ) : (
                  <a
                    key={i}
                    href={find.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-3 rounded-xl border border-primary/10 bg-card hover:border-primary/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2">{find.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-primary">{find.amount}</span>
                        {find.source && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {find.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                      Visit →
                    </span>
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* No picks yet — nudge to try on */}
      {externalFinds.length === 0 && curatedPicks.length === 0 && !isCurating && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3">
          <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Try on a look first — your AI stylist will recommend items based on your style.
          </p>
          {onTryOn && (
            <Button variant="outline" size="sm" onClick={() => onTryOn()} className="rounded-full">
              Start Try-On
            </Button>
          )}
        </div>
      )}

      {/* Full Catalog */}
      <ShopGrid
        items={CANVAS_ITEMS}
        onItemClick={(item) => {
          // Fly-to-cart from the clicked card
          const cardEl = document.querySelector(
            `article[data-transition-item-id="${item.id}"]`,
          );
          const sourceRect = cardEl?.getBoundingClientRect();
          const target = document
            .querySelector("[data-cart-button]")
            ?.getBoundingClientRect();
          if (sourceRect && target) {
            setFlyingItem({
              imageUrl: item.modelSrc || item.cover,
              sourceRect,
              targetRect: target,
            });
            flyCallbackRef.current = () => {
              setPendingTryOnSelection(fashionItemToTryOnSelection(item));
              addItem(item);
            };
          } else {
            // Fallback: add directly if card or cart button not found
            setPendingTryOnSelection(fashionItemToTryOnSelection(item));
            addItem(item);
          }
        }}
        showFilters
        showStats
        enableMobileCarousel
      />

      {/* Try On CTA — floating, shown when any item is in cart */}
      {onTryOn && (
        <div className="rounded-2xl border border-dashed border-primary/20 p-4 text-center bg-primary/5">
          <p className="text-sm text-muted-foreground mb-2">
            Want to see how these look on you?
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTryOn()}
            className="rounded-full border-primary/30 text-primary"
          >
            <Camera className="w-4 h-4 mr-1.5" />
            Try On with AI
          </Button>
        </div>
      )}

      <FlyToCartOverlay item={flyingItem} onComplete={handleFlyComplete} />
      <CartDrawer onCheckout={() => setShowCheckout(true)} />
      <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
    </motion.div>
  );
}
