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
} from "lucide-react";
import { Button } from "@repo/ui/button";

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
  const [walletData, setWalletData] = useState<AgentWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-xl animate-pulse">
        <div className="w-8 h-8 rounded-full bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-700 rounded w-24" />
          <div className="h-2 bg-slate-700 rounded w-32" />
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
          <p className="text-white text-sm font-bold truncate">
            AI Agent Wallet
          </p>
          <p className="text-slate-400 text-xs truncate">
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
      className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-2xl border border-white/10 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">AI Agent Wallet</h3>
              <p className="text-slate-400 text-xs">
                Self-custodial • Multi-chain
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-white"
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
            className="bg-white/5 rounded-xl p-4 border border-white/5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs uppercase tracking-wider">
                {wallet.chain}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400 text-xs">
                  {parseFloat(wallet.balance) / 1e18 > 0 ? "●" : "○"}
                </span>
                <span className="text-white text-xs">
                  {formatBalance(wallet.balance)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-slate-300 bg-black/30 rounded-lg px-3 py-2 truncate">
                {wallet.address}
              </code>
              <button
                onClick={() => copyAddress(wallet.address)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copiedAddress === wallet.address ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Capabilities */}
      <div className="px-5 pb-4">
        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">
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
                className="flex-1 min-w-[80px] border-white/10 text-white hover:bg-white/5 text-[10px]"
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
