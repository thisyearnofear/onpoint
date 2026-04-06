"use client";

import React, { useState } from "react";
import { ShopGrid, EngagementBadge } from "@repo/shared-ui";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { FashionItem } from "@onpoint/shared-types";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { CartDrawer, CartButton } from "../../components/Shop/CartDrawer";
import { CheckoutModal } from "../../components/Shop/CheckoutModal";
import { useCartStore } from "../../lib/stores/cart-store";

export default function ShopPage() {
  const [selectedItem, setSelectedItem] = useState<FashionItem | null>(null);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [showCheckout, setShowCheckout] = useState(false);
  const [stylistAnalysis, setStylistAnalysis] = useState<any>(null);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  // Load stylist analysis from sessionStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('stylistAnalysis');
      if (stored) {
        setStylistAnalysis(JSON.parse(stored));
      }
    }
  }, []);

  const handleItemClick = (item: FashionItem) => {
    setSelectedItem(item);
  };

  const handleLike = (itemId: string, liked: boolean) => {
    const newLiked = new Set(likedItems);
    if (liked) {
      newLiked.add(itemId);
    } else {
      newLiked.delete(itemId);
    }
    setLikedItems(newLiked);
  };

  const handleShare = (item: FashionItem) => {
    // Implement share logic
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: item.description,
        url: `${window.location.origin}/shop`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Shop Collection</h1>
          <CartButton />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* AI Stylist Recommendations Banner */}
        {stylistAnalysis && (
          <div className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/30 rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">
                    Your AI Agent is Shopping for You
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full uppercase">
                    Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Based on your {stylistAnalysis.bodyType} body type analysis, your agent recommends:
                </p>
                {stylistAnalysis.styleRecommendations && stylistAnalysis.styleRecommendations.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {stylistAnalysis.styleRecommendations.slice(0, 2).map((rec: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold">✓</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground">
                    💳 Agent wallet ready • $5-$5K spend limits
                  </div>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('stylistAnalysis');
                      setStylistAnalysis(null);
                    }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Featured Metrics */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <EngagementBadge
            type="trending"
            tryOnCount={CANVAS_ITEMS.reduce(
              (sum, item) => sum + (item.tryOnCount || 0),
              0,
            )}
            rating={4.7}
            animated
          />
          <EngagementBadge
            type="viral"
            tryOnCount={
              CANVAS_ITEMS.length > 0
                ? Math.max(...CANVAS_ITEMS.map((item) => item.tryOnCount || 0))
                : 0
            }
            mintCount={12}
            animated
          />
        </div>

        {/* Shop Grid with Mobile Carousel & Enhanced Cards */}
        <ShopGrid
          items={CANVAS_ITEMS}
          onItemClick={handleItemClick}
          onLike={handleLike}
          onShare={handleShare}
          showFilters={true}
          showStats={true}
          enableMobileCarousel={true}
        />
      </div>

      {/* Detail Modal (Optional) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl max-w-2xl w-full p-8 space-y-6 animate-bounce-in-up border border-border">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-foreground">
                  {selectedItem.name}
                </h2>
                <p className="text-muted-foreground mt-2">{selectedItem.description}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ✕
              </button>
            </div>

            {selectedItem.modelSrc && (
              <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                <img
                  src={selectedItem.modelSrc}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  ${selectedItem.price}
                </div>
                <div className="text-sm text-muted-foreground">Price</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">
                  {selectedItem.tryOnCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">Try-ons</div>
              </div>
            </div>

            <button
              onClick={() => {
                addItem(selectedItem);
                setSelectedItem(null);
              }}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Add to Cart — ${selectedItem.price}
            </button>
          </div>
        </div>
      )}
      {/* Cart & Checkout */}
      <CartDrawer onCheckout={() => setShowCheckout(true)} />
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
      />
    </div>
  );
}
