"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Loader2,
  ExternalLink,
  ShoppingBag,
  AlertCircle,
  Shield,
  Wallet,
  Info,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCartStore, type CartItem } from "../../lib/stores/cart-store";

interface CheckoutResult {
  success: boolean;
  order?: {
    id: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    totalAmount: string;
    txHash: string;
    chain: string;
    explorerUrl: string;
  };
  approvalRequired?: boolean;
  error?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, clearCart } = useCartStore();
  const total = useCartStore((s) => s.total());
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const handleCheckout = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/agent/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          chain: "celo",
        }),
      });

      const data: CheckoutResult = await response.json();
      setResult(data);

      if (data.success) {
        clearCart();
      }
    } catch {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setResult(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
              {/* Success state */}
              {result?.success ? (
                <div className="p-8 text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 200,
                    }}
                    className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto"
                  >
                    <Check className="w-10 h-10 text-emerald-400" />
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-black text-white">
                      Order Confirmed
                    </h2>
                    <p className="text-slate-400 text-sm mt-2">
                      Your purchase has been processed on {result.order?.chain}
                    </p>
                  </div>

                  {result.order && (
                    <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Order ID</span>
                        <span className="font-mono text-slate-300">
                          {result.order.id}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Total</span>
                        <span className="font-bold text-white">
                          {result.order.totalAmount}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Transaction</span>
                        <a
                          href={result.order.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleClose}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full py-6 font-bold"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-lg font-bold text-white">Checkout</h2>
                    </div>
                    <button
                      onClick={handleClose}
                      disabled={isProcessing}
                      className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* Order summary */}
                  <div className="px-6 py-4 space-y-3 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <CartItemRow key={item.product.id} item={item} />
                    ))}
                  </div>

                  {/* Total */}
                  <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-sm text-slate-400">Total</span>
                    <span className="text-2xl font-black text-white">
                      ${total.toFixed(2)}
                    </span>
                  </div>

                  {/* Trust Signals */}
                  <div className="mx-6 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-300">
                        Secure checkout
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        Your AI stylist handles payment automatically.
                        Purchases under{" "}
                        <span className="text-amber-400 font-bold">
                          $5 auto-approve
                        </span>
                        . Larger purchases require your confirmation.
                      </div>
                    </div>
                    {total > 5 && (
                      <div className="flex items-center gap-2 text-amber-400 text-[10px]">
                        <AlertCircle className="w-3 h-3" />
                        <span>Approval required for this purchase</span>
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {result && !result.success && (
                    <div className="mx-6 mb-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-300">
                        {result.error || "Checkout failed. Please try again."}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-6 py-4 space-y-3">
                    <Button
                      onClick={handleCheckout}
                      disabled={isProcessing || items.length === 0}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full py-6 text-base font-bold disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        `Pay $${total.toFixed(2)}`
                      )}
                    </Button>
                    <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      Secure payment via your AI stylist
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
        <img
          src={item.product.cover}
          alt={item.product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">
          {item.product.name}
        </p>
        <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
      </div>
      <p className="text-sm font-bold text-amber-400">
        ${(item.product.price * item.quantity).toFixed(2)}
      </p>
    </div>
  );
}
