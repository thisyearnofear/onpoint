"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCartStore } from "../../lib/stores/cart-store";

interface CartDrawerProps {
  onCheckout?: () => void;
}

export function CartDrawer({ onCheckout }: CartDrawerProps) {
  const { items, isOpen, closeCart, removeItem, updateQuantity, clearCart } =
    useCartStore();
  const total = useCartStore((s) => s.total());
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-slate-950 border-l border-white/10 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Cart</h2>
                {itemCount > 0 && (
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-500 text-sm font-medium">
                    Your cart is empty
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    Browse the shop or ask the AI Stylist for recommendations
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    {/* Product image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      <img
                        src={item.product.cover}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.product.category}
                      </p>
                      <p className="text-sm font-bold text-amber-400 mt-1">
                        ${item.product.price}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="w-10 h-10 rounded-full hover:bg-rose-500/20 flex items-center justify-center transition-colors group"
                      >
                        <Trash2 className="w-4 h-4 text-slate-600 group-hover:text-rose-400" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
                        >
                          <Minus className="w-4 h-4 text-slate-400" />
                        </button>
                        <span className="text-sm font-mono text-white w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
                        >
                          <Plus className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-white/10 px-6 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Total</span>
                  <span className="text-2xl font-black text-white">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={onCheckout || closeCart}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full py-6 text-base font-bold gap-2"
                >
                  Checkout
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <button
                  onClick={clearCart}
                  className="w-full text-center text-xs text-slate-600 hover:text-rose-400 transition-colors py-3"
                >
                  Clear cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Cart button — floating icon with item count badge.
 * Place in nav or header to open the cart drawer.
 */
export function CartButton() {
  const openCart = useCartStore((s) => s.openCart);
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <button
      onClick={openCart}
      className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
    >
      <ShoppingBag className="w-5 h-5 text-slate-300" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
}
