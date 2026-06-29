"use client";

/**
 * TipTokenPicker — segmented control for selecting tip currency.
 *
 * Shown above the tip amount buttons in TipSheet. Defaults to cUSD.
 * When G$ is selected, the TipSheet uses G$-appropriate amounts and
 * the GoodDollar token address from chains.ts.
 */

import React from "react";
import { Coins, Heart } from "lucide-react";

export type TipToken = "cUSD" | "G$";

interface TipTokenPickerProps {
  value: TipToken;
  onChange: (token: TipToken) => void;
  disabled?: boolean;
}

const TOKENS: Array<{
  id: TipToken;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "cUSD",
    label: "cUSD",
    icon: <Heart className="h-3.5 w-3.5" />,
  },
  {
    id: "G$",
    label: "G$ UBI",
    icon: <Coins className="h-3.5 w-3.5" />,
  },
];

export function TipTokenPicker({ value, onChange, disabled }: TipTokenPickerProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-border bg-muted/30 p-0.5 ${
        disabled ? "opacity-50" : ""
      }`}
      role="radiogroup"
      aria-label="Tip currency"
    >
      {TOKENS.map((token) => (
        <button
          key={token.id}
          role="radio"
          aria-checked={value === token.id}
          onClick={() => onChange(token.id)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
            value === token.id
              ? "bg-amber-500/20 text-amber-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {token.icon}
          {token.label}
        </button>
      ))}
    </div>
  );
}
