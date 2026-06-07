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
  TrendingDown,
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

interface PriceDrop {
  name: string;
  source: string;
  url: string;
  image_url?: string;
  newPrice: number;
  oldPrice: number;
  dropPercent: number;
  query: string;
  discoveredAt: string;
  currency?: string;
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

  // Tier 3: Price drops from autonomous commerce
  const [priceDrops, setPriceDrops] = useState<PriceDrop[]>([]);
  const [dropsLoading, setDropsLoading] = useState(false);

  // Auto-buy price threshold preference
  const [autoBuyMaxPrice, setAutoBuyMaxPrice] = useState(0);
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [showAutoBuySettings, setShowAutoBuySettings] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Per-item "Enabled!" feedback animation
  const [justEnabledDropKey, setJustEnabledDropKey] = useState<string | null>(null);

  const handlePerItemAutoBuy = (dropName: string, dropSource: string, price: number) => {
    const key = `${dropName}|${dropSource}`;
    setJustEnabledDropKey(key);
    setTimeout(() => setJustEnabledDropKey(null), 1400);
    updateAutoBuyPrice(price);
  };

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
    setDropsLoading(true);
    try {
      const [matchesRes, dropsRes] = await Promise.all([
        fetch(
          `/api/agent/tasks/matches?userId=${encodeURIComponent(userAddress)}&limit=5`,
        ),
        fetch(
          `/api/agent/tasks/drops?userId=${encodeURIComponent(userAddress)}&limit=10`,
        ),
      ]);

      if (matchesRes.ok) {
        const data = await matchesRes.json();
        if (data.success) {
          setMatches(data.matches || []);
          setPendingSignalCount(data.pendingSignalSuggestions || 0);
        }
      }

      if (dropsRes.ok) {
        const data = await dropsRes.json();
        if (data.success) {
          setPriceDrops(data.drops || []);
        }
      }

      // Fetch auto-buy preferences
      const prefsRes = await fetch(
        `/api/agent/tasks/preferences?userId=${encodeURIComponent(userAddress)}`,
      );
      if (prefsRes.ok) {
        const data = await prefsRes.json();
        if (data.success) {
          setAutoBuyMaxPrice(data.autoBuyMaxPrice || 0);
          setAutoBuyEnabled(data.autoBuyEnabled || false);
        }
      }
    } catch {
      // Agent tasks endpoint may not be available
    } finally {
      setMatchesLoading(false);
      setDropsLoading(false);
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
      setPriceDrops([]);
      setAutoBuyEnabled(false);
      setAutoBuyMaxPrice(0);
    }
  }, [isConnected, address]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWalletData(),
      address ? fetchMarketMatches(address) : Promise.resolve(),
    ]);
  };

  const updateAutoBuyPrice = async (price: number) => {
    if (!address) return;
    setPrefsLoading(true);
    try {
      const res = await fetch('/api/agent/tasks/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address, autoBuyMaxPrice: price }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAutoBuyMaxPrice(data.autoBuyMaxPrice || 0);
          setAutoBuyEnabled(data.autoBuyEnabled || false);
        }
      }
    } catch {
      // Preferences endpoint may not be available
    } finally {
      setPrefsLoading(false);
    }
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

      {/* Hot Deals — Tier 3 autonomous commerce price drops */}
      {isConnected && address && (priceDrops.length > 0 || dropsLoading) && (
        <div className="mx-4 mb-2">
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-foreground text-xs font-bold">
                    Hot Deals
                  </span>
                  <span className="text-muted-foreground text-[10px] block">
                    Price drops the agent found
                  </span>
                </div>
              </div>
            </div>

            {/* Loading skeleton */}
            {dropsLoading && priceDrops.length === 0 && (
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

            {/* Drop items */}
            {priceDrops.length > 0 && (
              <div className="space-y-2">
                {priceDrops.slice(0, 3).map((drop, i) => (
                  <div
                    key={`${drop.name}|${drop.source}|${i}`}
                    className="bg-muted/30 rounded-lg p-2.5 border border-border/50"
                  >
                    <div className="flex items-start gap-2">
                      {drop.image_url ? (
                        <img
                          src={drop.image_url}
                          alt={drop.name}
                          className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <TrendingDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-medium truncate">
                          {drop.name || "Unknown item"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-emerald-300 text-[11px] font-semibold">
                            ${drop.newPrice}
                          </span>
                          <span className="text-muted-foreground text-[10px] line-through">
                            ${drop.oldPrice}
                          </span>
                          <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            ↓{drop.dropPercent}%
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {drop.source || ""}
                          </span>
                        </div>
                        {/* Per-item auto-buy button with enabled feedback */}
                        {(!autoBuyEnabled || justEnabledDropKey === `${drop.name}|${drop.source}`) && (
                          <motion.button
                            onClick={() => {
                              if (!prefsLoading && !justEnabledDropKey) {
                                handlePerItemAutoBuy(drop.name, drop.source, Math.ceil(drop.newPrice));
                              }
                            }}
                            disabled={prefsLoading}
                            initial={justEnabledDropKey === `${drop.name}|${drop.source}` ? { scale: 0.95 } : false}
                            animate={
                              justEnabledDropKey === `${drop.name}|${drop.source}`
                                ? { scale: 1, opacity: [1, 1, 0], transition: { duration: 1.4, times: [0, 0.2, 1] } }
                                : { scale: 1 }
                            }
                            className={`mt-1.5 text-[9px] px-2 py-0.5 rounded-md border transition-colors disabled:opacity-50 ${
                              justEnabledDropKey === `${drop.name}|${drop.source}`
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                : 'bg-emerald-500/15 text-emerald-300/80 border-emerald-500/20 hover:bg-emerald-500/25 hover:text-emerald-300'
                            }`}
                          >
                            {justEnabledDropKey === `${drop.name}|${drop.source}` ? (
                              <span className="flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" />
                                Enabled!
                              </span>
                            ) : (
                              `Auto-buy at $${Math.ceil(drop.newPrice)}`
                            )}
                          </motion.button>
                        )}
                      </div>
                      {drop.url && (
                        <a
                          href={drop.url}
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

            {priceDrops.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                +{priceDrops.length - 3} more deals
              </p>
            )}

            {/* Prompt to enable auto-buy when disabled and deals exist */}
            {!autoBuyEnabled && priceDrops.length > 0 && !dropsLoading && (
              <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingDown className="w-3 h-3 text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-foreground font-medium">
                      Auto-buy is off
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      The agent found {priceDrops.length} deal{priceDrops.length > 1 ? 's' : ''}, but won't buy anything until you set a max price.
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => updateAutoBuyPrice(25)}
                        className="text-[9px] px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-medium"
                      >
                        Enable at $25
                      </button>
                      <button
                        onClick={() => setShowAutoBuySettings(true)}
                        className="text-[9px] px-2.5 py-1 bg-muted/30 text-muted-foreground rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-buy settings toggle */}
            <div className="mt-3 pt-3 border-t border-emerald-500/10">
              <button
                onClick={() => setShowAutoBuySettings(!showAutoBuySettings)}
                className="w-full flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Auto-buy settings
                  {autoBuyEnabled && (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                      ${autoBuyMaxPrice} max
                    </span>
                  )}
                  {!autoBuyEnabled && (
                    <span className="bg-muted/50 text-muted-foreground text-[8px] px-1.5 py-0.5 rounded-full">
                      off
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {showAutoBuySettings ? '▲' : '▼'}
                </span>
              </button>

              {showAutoBuySettings && (
                <div className="mt-2 space-y-2">
                  <p className="text-[9px] text-muted-foreground">
                    Set a max price so the agent can auto-buy price drops without asking.
                    Items above this threshold will still appear as suggestions.
                  </p>

                  {/* Preset price buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 10, 25, 50, 100].map((price) => (
                      <button
                        key={price}
                        disabled={prefsLoading}
                        onClick={() => { setCustomPriceInput(''); updateAutoBuyPrice(price); }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                          autoBuyMaxPrice === price && autoBuyEnabled === (price > 0)
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-muted/30 text-muted-foreground border border-border/50 hover:bg-muted/50'
                        }`}
                      >
                        {price === 0 ? 'Off' : `≤ $${price}`}
                      </button>
                    ))}
                  </div>

                  {/* Custom price input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        value={customPriceInput}
                        onChange={(e) => setCustomPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !prefsLoading) {
                            const val = parseFloat(customPriceInput);
                            if (val > 0) updateAutoBuyPrice(val);
                          }
                        }}
                        placeholder="Custom max price"
                        disabled={prefsLoading}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg pl-5 pr-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/30 disabled:opacity-50"
                      />
                    </div>
                    <button
                      disabled={prefsLoading || !customPriceInput || parseFloat(customPriceInput) <= 0}
                      onClick={() => {
                        const val = parseFloat(customPriceInput);
                        if (val > 0) updateAutoBuyPrice(val);
                      }}
                      className="text-[10px] px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Set
                    </button>
                  </div>

                  {prefsLoading && (
                    <p className="text-[9px] text-emerald-400 animate-pulse">
                      Saving...
                    </p>
                  )}
                </div>
              )}
            </div>
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
