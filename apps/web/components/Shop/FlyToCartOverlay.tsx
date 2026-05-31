"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export interface FlyItem {
  imageUrl: string;
  sourceRect: DOMRect;
  /** Optional override — if omitted, the component queries [data-cart-button] */
  targetRect?: DOMRect;
}

interface FlyToCartOverlayProps {
  item: FlyItem | null;
  onComplete: () => void;
}

/**
 * Renders a floating product image that flies from the source card position
 * to the cart button, then disappears. Uses a portal so it's not clipped
 * by any parent overflow/transform context.
 *
 * Usage:
 *   const [flyingItem, setFlyingItem] = useState<FlyItem | null>(null);
 *   // ... on add-to-cart click:
 *   const rect = cardElement.getBoundingClientRect();
 *   const target = document.querySelector("[data-cart-button]")?.getBoundingClientRect();
 *   setFlyingItem({ imageUrl, sourceRect: rect, targetRect: target });
 *   ...
 *   <FlyToCartOverlay item={flyingItem} onComplete={() => setFlyingItem(null)} />
 */
export function FlyToCartOverlay({ item, onComplete }: FlyToCartOverlayProps) {
  if (typeof window === "undefined") return null;

  // Resolve the target rect — either passed in or queried from DOM
  const targetRect =
    item?.targetRect ??
    (document.querySelector("[data-cart-button]")?.getBoundingClientRect() ??
      null);

  if (!item || !targetRect) {
    // If we have an item but no target, complete immediately to avoid blocking
    if (item && !targetRect) {
      // Schedule outside render to avoid setState-in-render
      queueMicrotask(onComplete);
    }
    return null;
  }

  const endX = targetRect.left + targetRect.width / 2 - 16;
  const endY = targetRect.top + targetRect.height / 2 - 16;

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        key={`fly-${item.imageUrl}-${Date.now()}`}
        initial={{
          position: "fixed",
          top: item.sourceRect.top,
          left: item.sourceRect.left,
          width: item.sourceRect.width,
          height: item.sourceRect.height,
          opacity: 1,
          zIndex: 9999,
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 0 24px rgba(99, 102, 241, 0.25)",
        }}
        animate={{
          top: endY,
          left: endX,
          width: 32,
          height: 32,
          opacity: 0.5,
          borderRadius: "50%",
          boxShadow: "0 0 0 0 rgba(99, 102, 241, 0)",
          scale: 0.25,
        }}
        exit={{
          opacity: 0,
          scale: 0,
          transition: { duration: 0.15 },
        }}
        transition={{
          duration: 0.55,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        onAnimationComplete={onComplete}
      >
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
