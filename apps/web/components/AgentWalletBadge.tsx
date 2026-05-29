"use client";

import React, { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";

interface WalletData {
  chain: string;
  address: string;
  balance: string;
}

/**
 * AgentWalletBadge — compact wallet balance display for the header.
 * Fetches agent wallet info on mount and shows the combined balance
 * across all supported chains. Clicking opens the settings tab.
 */
export function AgentWalletBadge() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchWallet() {
      try {
        const res = await fetch("/api/agent/wallet");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setWallets(data.wallets || []);
        }
      } catch {
        // Silently fail — wallet is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWallet();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (wallets.length === 0) return null;

  // Compute total balance across chains (simplified — all balances in wei)
  const totalBalance = wallets.reduce((sum, w) => {
    try {
      return sum + Number(w.balance);
    } catch {
      return sum;
    }
  }, 0);

  // Show if there's any meaningful balance (> 0.001 of any token)
  if (totalBalance === 0) return null;

  // Determine the primary chain to display (we know wallets[0] exists — guarded by wallets.length check above)
  const primary = wallets[0]!;

  return (
    <button
      onClick={() => {
        // Navigate to settings tab via URL parameter
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "settings");
        window.history.pushState(null, "", url.toString());
        window.dispatchEvent(new CustomEvent("onpoint:navigate", { detail: "settings" }));
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={`Agent wallet — ${primary.chain}: ${primary.address.slice(0, 6)}...${primary.address.slice(-4)}`}
    >
      <Wallet className="w-3.5 h-3.5 text-primary" />
      <span>{primary.chain}</span>
      <span className="text-foreground font-bold">
        {formatBalance(primary.balance)}
      </span>
      {wallets.length > 1 && (
        <span className="text-[10px] text-muted-foreground">
          +{wallets.length - 1}
        </span>
      )}
    </button>
  );
}

function formatBalance(balance: string): string {
  try {
    const wei = BigInt(balance);
    if (wei === BigInt(0)) return "0";
    // Convert wei to a readable format
    const divisor = BigInt(10) ** BigInt(18);
    const whole = wei / divisor;
    const remainder = wei % divisor;
    const decimals = remainder.toString().padStart(18, "0").slice(0, 4);
    const formatted = `${whole}.${decimals}`;
    // Remove trailing zeros
    return formatted.replace(/\.?0+$/, "");
  } catch {
    return "0";
  }
}
