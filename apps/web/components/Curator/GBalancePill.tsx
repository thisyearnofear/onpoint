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

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Gift, Loader2, ChevronDown, Sparkles } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const isOnCelo = chainId === celo.id;
  const isZeroBalance = !loading && balance !== null && balance === 0n;

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

  // Click-outside-to-close
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  // Hide when not connected or not on Celo
  if (!isConnected || !isOnCelo) return null;

  const displayBalance = balance !== null ? formatGAmount(balance) : null;

  return (
    <div className={`relative ${className ?? ""}`} ref={containerRef}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          isZeroBalance
            ? "border-success/40 bg-success/10 text-emerald-300 hover:bg-success/15 animate-pulse"
            : "border-success/20 bg-success/5 text-emerald-300 hover:bg-success/10"
        }`}
        title="GoodDollar G$ balance"
      >
        {isZeroBalance ? (
          <Sparkles className="h-3.5 w-3.5" />
        ) : (
          <Gift className="h-3.5 w-3.5" />
        )}
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isZeroBalance ? (
          <span>Claim G$</span>
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
