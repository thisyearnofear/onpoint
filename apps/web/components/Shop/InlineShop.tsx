"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShopGrid } from "@repo/shared-ui";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { FashionItem } from "@onpoint/shared-types";
import { ShoppingBag, Sparkles, Camera } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCartStore } from "../../lib/stores/cart-store";
import { CheckoutModal } from "./CheckoutModal";
import { CartDrawer, CartButton } from "./CartDrawer";

interface InlineShopProps {
  onTryOn?: () => void;
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

export function InlineShop({ onTryOn }: InlineShopProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [recommended, setRecommended] = useState<{ item: FashionItem; reason: string }[]>([]);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    setRecommended(getRecommendedItems());
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

      {/* AI Recommendations — only shown when session data exists */}
      {recommended.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Recommended for You
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recommended.map(({ item, reason }) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className="group relative rounded-xl overflow-hidden border border-primary/20 bg-card hover:border-primary/40 transition-all text-left"
              >
                {item.modelSrc && (
                  <div className="aspect-square bg-muted">
                    <img
                      src={item.modelSrc}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    💡 {reason}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">${item.price}</span>
                    <ShoppingBag className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-primary/90 text-white text-[8px] font-bold">
                  AI Pick
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No recommendations — nudge to try on */}
      {recommended.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3">
          <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Try on a look first — your AI stylist will recommend items based on your style.
          </p>
          {onTryOn && (
            <Button variant="outline" size="sm" onClick={onTryOn} className="rounded-full">
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
            onClick={onTryOn}
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
