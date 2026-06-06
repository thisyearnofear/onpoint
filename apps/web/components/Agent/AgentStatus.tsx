"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  RefreshCw,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useAccount } from "wagmi";

interface AgentWallet {
  chain: string;
  address: string;
  balance: string;
  chainId: number;
}

interface AgentWalletData {
  agent: {
    name: string;
    description: string;
    capabilities: string[];
  };
  wallets: AgentWallet[];
  addresses: {
    treasury: string;
    operations: string;
    nftMinter: string;
  };
  supportedChains: string[];
}

interface AgentStatusProps {
  compact?: boolean;
  showActions?: boolean;
  onTipClick?: () => void;
}

interface MarketMatch {
  signalId: string;
  score: number;
  reasons: string[];
  matchedAt: string;
  signal: {
    name: string;
    price: number;
    source: string;
    url: string;
    image_url?: string;
    currency: string;
    query: string;
  };
}

const EXPLORER_URLS = [
  { chain: "Celo", url: "https://celoscan.io" },
  { chain: "Base", url: "https://basescan.org" },
  { chain: "ETH", url: "https://etherscan.io" },
  { chain: "Polygon", url: "https://polygonscan.com" },
];

/**
 * AgentStatus - Displays the AI Agent's wallet information
 *
 * This component shows users that the AI Stylist has a self-custodial
 * wallet and can receive payments/tips autonomously.
 */
export function AgentStatus({
  compact = false,
  showActions = true,
  onTipClick,
}: AgentStatusProps) {
  const { address, isConnected } = useAccount();

  const [walletData, setWalletData] = useState<AgentWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Market signal matches from the autonomous agent
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [pendingSignalCount, setPendingSignalCount] = useState(0);

  const fetchWalletData = async () => {
    try {
      const response = await fetch("/api/agent/wallet");
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      }
    } catch (err) {
      console.error("Failed to fetch agent wallet:", err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMarketMatches = async (userAddress: string) => {
    if (!userAddress) return;
    setMatchesLoading(true);
    try {
      const res = await fetch(
        `/api/agent/tasks/matches?userId=${encodeURIComponent(userAddress)}&limit=5`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMatches(data.matches || []);
          setPendingSignalCount(data.pendingSignalSuggestions || 0);
        }
      }
    } catch {
      // Agent tasks endpoint may not be available
    } finally {
      setMatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  // Fetch market matches when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchMarketMatches(address);
    } else {
      setMatches([]);
      setPendingSignalCount(0);
    }
  }, [isConnected, address]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWalletData(),
      address ? fetchMarketMatches(address) : Promise.resolve(),
    ]);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl animate-pulse">
        <div className="w-8 h-8 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-muted rounded w-24" />
          <div className="h-2 bg-muted rounded w-32" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground text-sm font-bold truncate">
            AI Agent Wallet
          </p>
          <p className="text-muted-foreground text-xs truncate">
            {walletData?.wallets[0]?.address?.slice(0, 6)}...
            {walletData?.wallets[0]?.address?.slice(-4)}
          </p>
        </div>
        {showActions && (
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            onClick={onTipClick}
          >
            <Coins className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-foreground font-bold">AI Agent Wallet</h3>
              <p className="text-muted-foreground text-xs">
                Self-custodial • Multi-chain
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="p-4 space-y-3">
        {walletData?.wallets.map((wallet) => (
          <div
            key={wallet.chain}
            className="bg-muted/30 rounded-xl p-4 border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">
                {wallet.chain}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400 text-xs">
                  {parseFloat(wallet.balance) / 1e18 > 0 ? "●" : "○"}
                </span>
                <span className="text-foreground text-xs">
                  {formatBalance(wallet.balance)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-foreground/80 bg-muted rounded-lg px-3 py-2 truncate">
                {wallet.address}
              </code>
              <button
                onClick={() => copyAddress(wallet.address)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                {copiedAddress === wallet.address ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        ))}

      </div>

      {/* Agent Discoveries — proactive market signal matches */}
      {isConnected && address && (matches.length > 0 || matchesLoading) && (
        <div className="mx-4">
          <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-foreground text-xs font-bold">
                    Agent Discoveries
                  </span>
                  <span className="text-muted-foreground text-[10px] block">
                    Found items matching your style
                  </span>
                </div>
              </div>
              {pendingSignalCount > 0 && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingSignalCount} new
                </span>
              )}
            </div>

            {/* Loading skeleton */}
            {matchesLoading && matches.length === 0 && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-muted/30 rounded-lg p-2.5 border border-border/50 animate-pulse"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Match items */}
            {matches.length > 0 && (
              <div className="space-y-2">
                {matches.slice(0, 3).map((match, i) => (
                  <div
                    key={match.signalId || i}
                    className="bg-muted/30 rounded-lg p-2.5 border border-border/50"
                  >
                    <div className="flex items-start gap-2">
                      {match.signal?.image_url ? (
                        <img
                          src={match.signal.image_url}
                          alt={match.signal.name}
                          className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-medium truncate">
                          {match.signal?.name || "Unknown item"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-amber-300 text-[11px] font-semibold">
                            ${match.signal?.price || "?"}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {match.signal?.source || ""}
                          </span>
                        </div>
                        {(match.reasons || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {match.reasons.map((reason: string) => (
                              <span
                                key={reason}
                                className="text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded-full"
                              >
                                {reason.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {match.signal?.url && (
                        <a
                          href={match.signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {matches.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                +{matches.length - 3} more matches
              </p>
            )}
          </div>
        </div>
      )}

      {/* Capabilities */}
      <div className="px-5 pb-4">
        <p className="text-muted-foreground/70 text-[10px] uppercase tracking-wider mb-2">
          Capabilities
        </p>
        <div className="flex flex-wrap gap-2">
          {walletData?.agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="px-2 py-1 text-[10px] bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20"
            >
              {cap.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-4 pb-4 space-y-2">
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold"
            onClick={onTipClick}
          >
            <Coins className="w-4 h-4 mr-2" />
            Tip Agent
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {EXPLORER_URLS.map(({ chain, url }) => (
              <Button
                key={chain}
                variant="outline"
                size="sm"
                className="flex-1 min-w-[80px] border-border text-foreground hover:bg-muted text-[10px]"
                onClick={() =>
                  window.open(
                    `${url}/address/${walletData?.wallets[0]?.address}`,
                    "_blank",
                  )
                }
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {chain}
              </Button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function formatBalance(balance: string): string {
  const value = parseFloat(balance) / 1e18;
  if (value === 0) return "0";
  if (value < 0.001) return "<0.001";
  return value.toFixed(4);
}
