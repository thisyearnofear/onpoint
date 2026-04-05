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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-700 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Shop Collection</h1>
          <CartButton />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* AI Stylist Recommendations Banner */}
        {stylistAnalysis && (
          <div className="mb-8 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Your AI Stylist's Recommendations
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Based on your {stylistAnalysis.bodyType} body type, here's what would look great on you:
                </p>
                {stylistAnalysis.styleRecommendations && stylistAnalysis.styleRecommendations.length > 0 && (
                  <div className="space-y-2">
                    {stylistAnalysis.styleRecommendations.slice(0, 2).map((rec: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-indigo-500 font-bold">✓</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    sessionStorage.removeItem('stylistAnalysis');
                    setStylistAnalysis(null);
                  }}
                  className="mt-4 text-xs text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 space-y-6 animate-bounce-in-up">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {selectedItem.name}
                </h2>
                <p className="text-gray-600 mt-2">{selectedItem.description}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {selectedItem.modelSrc && (
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
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
                <div className="text-sm text-gray-600">Price</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">
                  {selectedItem.tryOnCount || 0}
                </div>
                <div className="text-sm text-gray-600">Try-ons</div>
              </div>
            </div>

            <button
              onClick={() => {
                addItem(selectedItem);
                setSelectedItem(null);
              }}
              className="w-full py-3 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
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
