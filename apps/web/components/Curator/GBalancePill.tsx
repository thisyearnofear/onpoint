"use client";

/**
 * GBalancePill — persistent G$ balance indicator.
 *
 * Shows the connected wallet's GoodDollar G$ balance with a 30-second
 * cache (via getGBalanceSnapshot). Automatically hides when:
 *   - Wallet is not connected
 *   - Not on Celo
 *   - Balance is zero (first-time users)
 *
 * Clicking the pill opens the claim CTA inline (collapsible).
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Gift, Loader2, ChevronDown } from "lucide-react";
import { celo } from "../../config/chains";
import { getGBalanceSnapshot, formatGAmount } from "@repo/gooddollar";
import { GClaimCTA } from "./GClaimCTA";
import type { Address } from "viem";

interface GBalancePillProps {
  className?: string;
}

export function GBalancePill({ className }: GBalancePillProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const isOnCelo = chainId === celo.id;

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !isOnCelo || !publicClient || !address) {
      setBalance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getGBalanceSnapshot(
        publicClient,
        address as Address,
        "celo",
      );
      setBalance(snap.balance);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, isOnCelo, publicClient, address]);

  // Fetch on mount and when connection/chain changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Refresh after a claim
  useEffect(() => {
    if (claimed) {
      // Wait a moment for the tx to settle, then refresh
      const timer = setTimeout(() => fetchBalance(), 3000);
      return () => clearTimeout(timer);
    }
  }, [claimed, fetchBalance]);

  // Auto-refresh every 30s (matches cache TTL)
  useEffect(() => {
    if (!isConnected || !isOnCelo) return;
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [isConnected, isOnCelo, fetchBalance]);

  // Hide when not connected, not on Celo, or balance is zero
  if (!isConnected || !isOnCelo) return null;
  if (!loading && balance !== null && balance === 0n && !expanded) return null;

  const displayBalance = balance !== null ? formatGAmount(balance) : null;

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10"
        title="GoodDollar G$ balance"
      >
        <Gift className="h-3.5 w-3.5" />
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span>{displayBalance ?? "0.00 G$"}</span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50">
          <div className="rounded-xl border border-border bg-card p-3 shadow-xl">
            <GClaimCTA
              onClaimed={() => {
                setClaimed(true);
                fetchBalance();
              }}
            />
            <p className="mt-2 text-[10px] text-muted-foreground">
              GoodDollar is free daily UBI on Celo. Claim once per day.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
