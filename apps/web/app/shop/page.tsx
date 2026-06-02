"use client";

import React, { useState, useCallback } from "react";
import { ShopGrid, EngagementBadge } from "@repo/shared-ui";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { FashionItem } from "@onpoint/shared-types";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Sparkles, Globe, Loader2 } from "lucide-react";
import { CartDrawer, CartButton } from "../../components/Shop/CartDrawer";
import { FlyToCartOverlay, type FlyItem } from "../../components/Shop/FlyToCartOverlay";
import { CheckoutModal } from "../../components/Shop/CheckoutModal";
import { useCartStore } from "../../lib/stores/cart-store";
import { useCuratedPicksStore } from "../../lib/stores/curated-picks-store";
import { useStyleContext } from "@/lib/context/StyleContext";

export default function ShopPage() {
  const [selectedItem, setSelectedItem] = useState<FashionItem | null>(null);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [showCheckout, setShowCheckout] = useState(false);
  const [stylistAnalysis, setStylistAnalysis] = useState<any>(null);
  const [flyingItem, setFlyingItem] = useState<FlyItem | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const curatedPicks = useCuratedPicksStore((s) => s.picks);
  const isCurating = useCuratedPicksStore((s) => s.loading);
  const fetchPicks = useCuratedPicksStore((s) => s.fetchPicks);

  const handleFlyComplete = useCallback(() => {
    setFlyingItem(null);
  }, []);
  const { dominantAesthetic, budgetLabel } = useStyleContext();

  // Load stylist analysis from sessionStorage and trigger curated picks
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('stylistAnalysis');
      if (stored) {
        const analysis = JSON.parse(stored);
        setStylistAnalysis(analysis);

        const ctx = analysis.curationContext;
        if (ctx && ctx.takeaways?.length > 0) {
          fetchPicks(ctx);
        }
      }
    }
  }, [fetchPicks]);

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
        {/* Personalization Context Banner */}
        {(dominantAesthetic || budgetLabel) && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>🎯</span>
              {dominantAesthetic && (
                <span>
                  Highlighting <span className="font-semibold text-foreground capitalize">{dominantAesthetic}</span> styles
                </span>
              )}
              {budgetLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
                  {budgetLabel.replace("-", " ")}
                </span>
              )}
            </div>
          </div>
        )}

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

        {/* Curated Agent Picks */}
        {(isCurating || curatedPicks.length > 0) && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                Curated For You
              </h2>
              {isCurating && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching live stores...
                </span>
              )}
            </div>

            {/* Provenance context bar */}
            {curatedPicks.length > 0 && curatedPicks[0]?.provenance && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {curatedPicks[0].provenance.personaLabel && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {curatedPicks[0].provenance.personaLabel}
                  </span>
                )}
                {curatedPicks[0].provenance.goalLabel && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
                    {curatedPicks[0].provenance.goalLabel}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {curatedPicks.length} picks from {curatedPicks.filter(p => p.source === "external").length > 0 ? "live stores + " : ""}catalog
                </span>
              </div>
            )}

            {/* External product groups */}
            {curatedPicks.filter((p) => p.source === "external").length > 0 && (
              <div className="space-y-4 mb-6">
                {curatedPicks
                  .filter((p) => p.source === "external")
                  .map((pick, i) => {
                    const ext = pick.item as { name: string; price: number; source: string; url: string; imageUrl: string };
                    return (
                      <a
                        key={i}
                        href={ext.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all"
                      >
                        {ext.imageUrl && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                            <img
                              src={ext.imageUrl}
                              alt={ext.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{ext.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{pick.reason}</p>
                          {pick.provenance?.matchedTakeaway && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-primary/5 text-muted-foreground border border-primary/10">
                              Matched: {pick.provenance.matchedTakeaway}
                            </span>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-bold text-primary">${ext.price}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {ext.source}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors shrink-0 self-center">
                          Visit →
                        </span>
                      </a>
                    );
                  })}
              </div>
            )}

            {/* Local catalog picks */}
            {curatedPicks.filter((p) => p.source === "local").length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {curatedPicks
                  .filter((p) => p.source === "local")
                  .map((pick) => {
                    const item = pick.item as FashionItem;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          const cardEl = document.querySelector(`[data-pick-id="${item.id}"]`);
                          const sourceRect = cardEl?.getBoundingClientRect();
                          const target = document.querySelector("[data-cart-button]")?.getBoundingClientRect();
                          if (sourceRect && target) {
                            setFlyingItem({
                              imageUrl: item.modelSrc || item.cover,
                              sourceRect,
                              targetRect: target,
                            });
                          }
                          addItem(item);
                        }}
                        data-pick-id={item.id}
                        className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/20 transition-all text-left"
                      >
                        {(item.modelSrc || item.productSrc) && (
                          <div className="aspect-square bg-muted">
                            <img
                              src={item.modelSrc || item.productSrc}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-[11px] text-foreground font-medium truncate">{item.name}</p>
                          <p className="text-[11px] font-bold text-primary">${item.price}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{pick.reason}</p>
                          {pick.provenance?.matchedTakeaway && (
                            <p className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">via {pick.provenance.matchedTakeaway}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Loading skeleton */}
            {isCurating && curatedPicks.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                    <div className="aspect-square bg-muted" />
                    <div className="p-2 space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  data-fly-image
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
                const imageEl = document.querySelector('[data-fly-image]');
                const sourceRect = imageEl?.getBoundingClientRect();
                const target = document.querySelector('[data-cart-button]')?.getBoundingClientRect();
                if (sourceRect && target) {
                  setFlyingItem({
                    imageUrl: selectedItem.modelSrc || selectedItem.cover,
                    sourceRect,
                    targetRect: target,
                  });
                }
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
      {/* Fly-to-cart animation */}
      <FlyToCartOverlay item={flyingItem} onComplete={handleFlyComplete} />

      {/* Cart & Checkout */}
      <CartDrawer onCheckout={() => setShowCheckout(true)} />
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
      />
    </div>
  );
}
