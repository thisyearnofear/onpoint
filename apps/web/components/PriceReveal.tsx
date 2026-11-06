"use client";

import { useState } from "react";
import { localPriceLabel } from "../lib/fx";

interface PriceRevealProps {
  /** KES-denominated amount; hidden until the viewer asks for it. */
  kesAmount: number;
  label?: string;
  className?: string;
}

/**
 * Tap-to-reveal price — shows an approximate local-currency conversion.
 * Nothing here is purchasable yet; the reveal exists so a price only
 * appears when a viewer signals "what would this cost?"
 */
export function PriceReveal({ kesAmount, label = "See price", className = "" }: PriceRevealProps) {
  const [shown, setShown] = useState(false);
  if (shown) {
    const local = localPriceLabel(kesAmount, navigator.language);
    return (
      <span className={className} title="Approximate local price">
        KES {kesAmount.toLocaleString()} {local}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShown(true);
      }}
    >
      {label}
    </button>
  );
}
