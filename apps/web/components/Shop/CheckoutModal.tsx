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
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <motion.div
              layout
              className="bg-card border border-border rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
            >
              {/* Success state */}
              {result?.success ? (
                <SuccessState result={result} onClose={handleClose} />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="checkout-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Header */}
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 }}
                      className="flex items-center justify-between px-6 py-4 border-b border-border"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-lg font-bold text-foreground">Checkout</h2>
                      </div>
                      <button
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </motion.div>

                    {/* Order summary */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14 }}
                      className="px-6 py-4 space-y-3 max-h-64 overflow-y-auto"
                    >
                      {items.map((item, i) => (
                        <motion.div
                          key={item.product.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.16 + i * 0.04 }}
                        >
                          <CartItemRow item={item} />
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Total */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + items.length * 0.04 }}
                      className="px-6 py-3 border-t border-border flex items-center justify-between"
                    >
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="text-2xl font-black text-foreground">
                        ${total.toFixed(2)}
                      </span>
                    </motion.div>

                    {/* Trust Signals */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.24 + items.length * 0.04 }}
                      className="mx-6 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-medium text-indigo-400">
                          Secure checkout
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-muted-foreground leading-relaxed">
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
                    </motion.div>

                    {/* Error */}
                    {result && !result.success && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        transition={{ duration: 0.25 }}
                        className="mx-6 mb-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-300">
                          {result.error || "Checkout failed. Please try again."}
                        </p>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + items.length * 0.04 }}
                      className="px-6 py-4 space-y-3"
                    >
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
                      <p className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3" />
                        Secure payment via your AI stylist
                      </p>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SuccessState({ result, onClose }: { result: CheckoutResult; onClose: () => void }) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 text-center space-y-6"
    >
      {/* Bouncing checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          damping: 10,
          stiffness: 250,
        }}
        className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto"
      >
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Check className="w-10 h-10 text-emerald-400" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h2 className="text-2xl font-black text-foreground">Order Confirmed!</h2>
        <p className="text-muted-foreground text-sm mt-2">
          Your AI stylist processed your purchase
        </p>
      </motion.div>

      {/* Order details */}
      {result.order && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-muted/30 rounded-xl p-4 text-left space-y-3"
        >
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Order</span>
            <span className="font-mono text-foreground/80">
              {result.order.id.slice(0, 20)}…
            </span>
          </div>
          {result.order.items?.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className="flex justify-between text-xs"
            >
              <span className="text-foreground/80">
                {item.quantity}× {item.name}
              </span>
              <span className="text-foreground font-medium">
                ${item.subtotal.toFixed(2)}
              </span>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 + (result.order.items?.length || 0) * 0.04 }}
            className="border-t border-border pt-2 flex justify-between text-sm"
          >
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-foreground">
              {result.order.totalAmount}
            </span>
          </motion.div>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full py-6 font-bold"
        >
          Continue Shopping
        </Button>
      </motion.div>
    </motion.div>
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
        <img
          src={item.product.cover}
          alt={item.product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium truncate">
          {item.product.name}
        </p>
        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
      </div>
      <p className="text-sm font-bold text-amber-400">
        ${(item.product.price * item.quantity).toFixed(2)}
      </p>
    </div>
  );
}
