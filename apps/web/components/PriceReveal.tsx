"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_CURRENCIES, formatKesAs, getPreferredCurrency, setPreferredCurrency } from "../lib/fx";

interface PriceRevealProps {
  /** KES-denominated amount; hidden until the viewer asks for it. */
  kesAmount: number;
  label?: string;
  className?: string;
}

/**
 * Tap-to-reveal price — shows KES plus an approximate conversion in the
 * viewer's currency. The currency selector doubles as the app's currency
 * preference: pick once here and every reveal remembers it (this device).
 */
export function PriceReveal({ kesAmount, label = "See price", className = "" }: PriceRevealProps) {
  const [shown, setShown] = useState(false);
  const [currency, setCurrency] = useState("USD");

  // Post-mount read keeps SSR + hydration identical; preference applies on tap.
  useEffect(() => {
    setCurrency(getPreferredCurrency(navigator.language));
  }, []);

  if (shown) {
    const local = formatKesAs(kesAmount, currency, navigator.language);
    return (
      <span className={className} title="Approximate local price">
        KES {kesAmount.toLocaleString()} ≈{local}{" "}
        <select
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setPreferredCurrency(e.target.value);
          }}
          className="cursor-pointer rounded border-none bg-transparent text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          aria-label="Display currency"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
