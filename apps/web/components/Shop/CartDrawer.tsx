"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useCartStore } from "../../lib/stores/cart-store";
import { SafeImage } from "../SafeImage";

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

          {/* Drawer — drag right to close */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="x"
            dragConstraints={{ left: 0, right: 300 }}
            dragElastic={{ left: 0, right: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 120) closeCart();
            }}
            whileDrag={{
              opacity: 0.7,
              scale: 0.97,
              transition: { duration: 0 },
            }}
            className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl"
          >
            {/* Swipe indicator — hinted draggable edge */}
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
              <motion.div
                className="flex items-center justify-center h-14 w-[18px] rounded-full border border-border bg-card/80 backdrop-blur-sm shadow-lg"
                animate={{
                  opacity: [0.5, 0.85, 0.5],
                  scale: [1, 1.06, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ChevronLeft className="w-3 h-3 text-muted-foreground" />
              </motion.div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-foreground">Cart</h2>
                {itemCount > 0 && (
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  {/* Animated SVG illustration */}
                  <div className="relative w-40 h-40 mb-6">
                    {/* Floating decorative elements */}
                    <motion.div
                      className="absolute top-2 right-2 w-3 h-3 rounded-full bg-indigo-500/30"
                      animate={{
                        y: [-6, 6, -6],
                        opacity: [0.4, 0.8, 0.4],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute bottom-8 left-1 w-2.5 h-2.5 rounded-full bg-warning/30"
                      animate={{
                        y: [4, -8, 4],
                        opacity: [0.3, 0.7, 0.3],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5,
                      }}
                    />
                    <motion.div
                      className="absolute top-6 left-0 w-2 h-2 rounded-full bg-success/25"
                      animate={{
                        x: [0, 8, 0],
                        y: [0, -4, 0],
                        opacity: [0.2, 0.6, 0.2],
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1,
                      }}
                    />
                    <motion.div
                      className="absolute bottom-4 right-4 w-1.5 h-1.5 rounded-full bg-rose-500/25"
                      animate={{
                        y: [-3, 5, -3],
                        opacity: [0.3, 0.7, 0.3],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.3,
                      }}
                    />

                    {/* Main shopping bag SVG */}
                    <motion.svg
                      viewBox="0 0 120 120"
                      fill="none"
                      className="w-full h-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {/* Bag body */}
                      <motion.path
                        d="M32 48L36 100C36 104.4 39.6 108 44 108H76C80.4 108 84 104.4 84 100L88 48"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                      {/* Bag handles */}
                      <motion.path
                        d="M44 48V36C44 27.2 51.2 20 60 20C68.8 20 76 27.2 76 36V48"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                      />
                      {/* Vertical crease lines */}
                      <motion.path
                        d="M56 56V92"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="text-slate-700"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
                      />
                      <motion.path
                        d="M64 56V92"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="text-slate-700"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 1 }}
                      />
                      {/* Small item tag */}
                      <motion.circle
                        cx="72"
                        cy="38"
                        r="3"
                        fill="currentColor"
                        className="text-indigo-500/60"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.5, delay: 1.4 }}
                      />
                      {/* Bottom fold line */}
                      <motion.path
                        d="M38 96L82 96"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="text-slate-700"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 1.2 }}
                      />
                    </motion.svg>
                  </div>

                  {/* Message */}
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="text-muted-foreground text-sm font-medium"
                  >
                    Your cart is empty
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="text-muted-foreground/70 text-xs mt-1.5 max-w-[200px]"
                  >
                    Browse the shop or ask the AI Stylist for recommendations
                  </motion.p>
                </div>
              ) : (
                items.map((item, index) => (
                  <SwipeableCartItem
                    key={item.product.id}
                    onDelete={() => removeItem(item.product.id)}
                    index={index}
                  >
                    {/* Product image */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                      <SafeImage
                        sources={[item.product.cover]}
                        alt={item.product.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.product.category}
                      </p>
                      <p className="text-sm font-bold text-amber-400 mt-1">
                        ${item.product.price}
                      </p>
                    </div>

                    {/* Quantity controls with press-and-hold */}
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="w-10 h-10 rounded-full hover:bg-rose-500/20 flex items-center justify-center transition-colors group"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground/50 group-hover:text-rose-400" />
                      </button>

                      <div className="flex items-center gap-2">
                        <PressHoldButton
                          onTrigger={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4 text-muted-foreground" />
                        </PressHoldButton>
                        <span className="text-sm font-mono text-foreground w-8 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <PressHoldButton
                          onTrigger={() => {
                            if (item.quantity < 10) {
                              updateQuantity(item.product.id, item.quantity + 1)
                            }
                          }}
                          aria-label="Increase quantity"
                          maxed={item.quantity >= 10}
                        >
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </PressHoldButton>
                      </div>
                    </div>
                  </SwipeableCartItem>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border px-6 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-black text-foreground">
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
                  className="w-full text-center text-xs text-muted-foreground/50 hover:text-rose-400 transition-colors py-3"
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
/* ─── Swipe-to-delete cart item wrapper ─── */
function SwipeableCartItem({
  children,
  onDelete,
  index,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  index: number;
}) {
  const controls = useAnimation();
  const [revealed, setRevealed] = useState(false);
  const dragStartX = useRef(0);
  const dragOffsetX = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStartX.current = e.clientX;
      dragOffsetX.current = 0;
      setRevealed(false);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const delta = e.clientX - dragStartX.current;
      if (delta > 0) return; // only allow swipe left
      dragOffsetX.current = delta;
      if (delta < -30) setRevealed(true);
      else setRevealed(false);
      controls.start({ x: delta, transition: { duration: 0 } });
    },
    [controls],
  );

  const handlePointerUp = useCallback(() => {
    if (dragOffsetX.current < -60) {
      // Let AnimatePresence handle the exit animation
      onDelete();
    } else {
      controls.start({ x: 0, transition: { type: "spring", damping: 20, stiffness: 300 } });
      setRevealed(false);
    }
  }, [controls, onDelete]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete backdrop revealed on swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-rose-500/20 rounded-xl"
        animate={{
          opacity: revealed ? 1 : 0,
          scale: revealed ? 1 : 0.8,
        }}
        transition={{ duration: 0.15 }}
      >
        <Trash2 className="w-5 h-5 text-rose-400" />
      </motion.div>

      {/* Content */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        transition={{
          type: "spring",
          damping: 26,
          stiffness: 280,
          delay: index * 0.05,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative flex gap-4 p-3 rounded-xl bg-muted/30 border border-border cursor-default touch-pan-y"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ─── Press-and-hold quantity stepper ─── */
function PressHoldButton({
  children,
  onTrigger,
  maxed,
  ...props
}: {
  children: React.ReactNode;
  onTrigger: () => void;
  maxed?: boolean;
  "aria-label"?: string;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use a ref so the interval always calls the latest onTrigger (avoids stale closure)
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (maxed) return;
    // Single click
    onTriggerRef.current();
    // After 400ms hold, start rapid-fire every 100ms
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (maxed) {
          clear();
          return;
        }
        onTriggerRef.current();
      }, 100);
    }, 400);
  }, [maxed, clear]);

  useEffect(() => clear, [clear]);

  return (
    <button
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      disabled={maxed}
      className={`w-10 h-10 rounded-full bg-muted/30 hover:bg-muted flex items-center justify-center transition-colors border border-border select-none ${
        maxed ? "opacity-30 cursor-not-allowed" : "active:bg-muted"
      }`}
      {...(props as React.ComponentProps<"button">)}
    >
      {children}
    </button>
  );
}

export function CartButton() {
  const openCart = useCartStore((s) => s.openCart);
  const itemCount = useCartStore((s) => s.itemCount());
  const lastAddedItem = useCartStore((s) => s.lastAddedItem);
  const clearLastAddedItem = useCartStore((s) => s.clearLastAddedItem);
  const previewKeyRef = useRef(0);

  // Increment key on each new item so same-item re-add re-triggers the animation
  useEffect(() => {
    if (!lastAddedItem) return;
    previewKeyRef.current += 1;
  }, [lastAddedItem]);

  // Auto-dismiss the floating preview after 3 seconds
  useEffect(() => {
    if (!lastAddedItem) return;
    const timer = setTimeout(clearLastAddedItem, 3000);
    return () => clearTimeout(timer);
  }, [lastAddedItem, clearLastAddedItem]);

  return (
    <div className="relative inline-flex items-center">
      {/* Floating preview — appears to the left of the cart button */}
      <AnimatePresence>
        {lastAddedItem && (
          <motion.div
            key={`preview-${lastAddedItem.id}-${previewKeyRef.current}`}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute right-full mr-3 flex items-center gap-2.5 rounded-lg border border-border bg-card/95 backdrop-blur-md px-3 py-1.5 shadow-lg pointer-events-none"
          >
            {/* Thumbnail */}
            <div className="relative w-7 h-7 rounded-md overflow-hidden bg-muted shrink-0">
              <SafeImage
                sources={[lastAddedItem.cover]}
                alt={lastAddedItem.name}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            {/* Name + checkmark */}
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-foreground leading-tight truncate max-w-[120px]">
                {lastAddedItem.name}
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="text-emerald-400">✓</span>
                Added
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        data-cart-button
        onClick={openCart}
        className="relative w-10 h-10 rounded-full bg-muted/30 hover:bg-muted border border-border flex items-center justify-center transition-colors shrink-0"
      >
        <ShoppingBag className="w-5 h-5 text-foreground/80" />
        {itemCount > 0 && (
          <motion.span
            key={itemCount}
            animate={{
              scale: [1, 1.35, 1],
            }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
            }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {itemCount}
          </motion.span>
        )}
      </button>
    </div>
  );
}
