"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShopGrid } from "@repo/shared-ui";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { FashionItem } from "@onpoint/shared-types";
import { ShoppingBag, Sparkles, Camera, Globe } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCartStore } from "../../lib/stores/cart-store";
import { CheckoutModal } from "./CheckoutModal";
import { CartDrawer, CartButton } from "./CartDrawer";
import { fetchAgentApi } from "../../lib/utils/agent-api";
import { Product3DCard } from "./Product3DCard";
import { RichProductCard, RichProductGroup } from "./RichProductCard";
import type { ProductResult } from "@onpoint/shared-types";
import {
  fashionItemToTryOnSelection,
  setPendingTryOnSelection,
} from "../../lib/utils/try-on-selection";

interface InlineShopProps {
  onTryOn?: (item?: FashionItem) => void;
}

/** Get AI-recommended items based on session history stored in sessionStorage */
function getRecommendedItems(): { item: FashionItem; reason: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = sessionStorage.getItem("stylistAnalysis");
    if (!stored) return [];
    const analysis = JSON.parse(stored);
    const recs: string[] = analysis.styleRecommendations || analysis.styleAdjustments || [];
    const keywords = recs.join(" ").toLowerCase();

    return CANVAS_ITEMS.filter((item) => {
      const text = `${item.name} ${item.description} ${item.category}`.toLowerCase();
      return keywords.split(/\s+/).some((w: string) => w.length > 3 && text.includes(w));
    }).slice(0, 4).map((item) => {
      // Find the recommendation that matched this item
      const matchedRec = recs.find((r) => {
        const rLower = r.toLowerCase();
        return rLower.includes(item.category.toLowerCase()) ||
          rLower.includes(item.name.toLowerCase().split(" ")[0] || "");
      });
      return {
        item,
        reason: matchedRec || `Complements your ${item.category} style`,
      };
    });
  } catch {
    return [];
  }
}

interface ExternalFind {
  description: string;
  amount: string;
  source?: string;
  externalUrl?: string;
  products?: ProductResult[];
}

export function InlineShop({ onTryOn }: InlineShopProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [recommended, setRecommended] = useState<{ item: FashionItem; reason: string }[]>([]);
  const [externalFinds, setExternalFinds] = useState<ExternalFind[]>([]);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    setRecommended(getRecommendedItems());

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
          }));
        setExternalFinds(externals);
      })
      .catch(() => {});
  }, []);

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

      {/* AI Picks — unified section: web results first, then catalog matches */}
      {(externalFinds.length > 0 || recommended.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Your AI Picks
            </h3>
          </div>

          {/* Web-discovered products (real prices, multiple retailers) */}
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

          {/* Catalog matches from session analysis */}
          {recommended.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recommended.map(({ item, reason }) => (
                <Product3DCard
                  key={item.id}
                  imageUrl={item.modelSrc || item.cover}
                  name={item.name}
                  price={item.price}
                  badge="AI Pick"
                  reason={reason}
                  onClick={() => {
                    setPendingTryOnSelection(fashionItemToTryOnSelection(item));
                    addItem(item);
                    onTryOn?.(item);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No picks yet — nudge to try on */}
      {externalFinds.length === 0 && recommended.length === 0 && (
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
          // Add to cart on click
          setPendingTryOnSelection(fashionItemToTryOnSelection(item));
          addItem(item);
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

      <CartDrawer onCheckout={() => setShowCheckout(true)} />
      <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
    </motion.div>
  );
}
