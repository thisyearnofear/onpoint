"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, type Address } from "viem";
import { celo } from "viem/chains";
import { AGENT_WALLET, getTokenAddress } from "../../config/chains";
import { fetchAgentApi } from "../../lib/utils/agent-api";
import { TipTokenPicker, type TipToken } from "./TipTokenPicker";

interface TipSheetProps {
  isOpen: boolean;
  onClose: () => void;
  agentAddress?: string;
  /** Session score (0-10) gates available tip amounts */
  score?: number;
}

/**
 * cUSD ERC-20 contract on Celo mainnet.
 * Kept as fallback — the canonical source is getTokenAddress("cUSD", "celo")
 * from chains.ts, but TipModal runs on Celo only.
 */
const CUSD_ADDRESS = "0x765DE8164458C172EE097029dfb482Ff182ad001" as const;

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Score-gated tip configuration per token.
 * G$ is ~$0.0001, so G$ amounts are ~1000x larger than cUSD equivalents.
 * `usd` field gives users a frame of reference for G$ amounts.
 */
const TIP_CONFIGS: Record<TipToken, {
  low: { amounts: readonly { amount: string; label: string; icon: string; usd?: string }[]; headline: string; subtext: string };
  standard: { amounts: readonly { amount: string; label: string; icon: string; usd?: string }[]; headline: string; subtext: string };
  premium: { amounts: readonly { amount: string; label: string; icon: string; usd?: string }[]; headline: string; subtext: string };
}> = {
  cUSD: {
    low: {
      amounts: [],
      headline: "Thanks for trying!",
      subtext: "Better luck next session",
    },
    standard: {
      amounts: [
        { amount: "0.1", label: "Thanks!", icon: "🙏" },
        { amount: "0.25", label: "Great!", icon: "👏" },
        { amount: "0.5", label: "Amazing!", icon: "🔥" },
      ],
      headline: "Say Thanks",
      subtext: "Great session with your stylist",
    },
    premium: {
      amounts: [
        { amount: "0.5", label: "Great!", icon: "👏" },
        { amount: "1.0", label: "Amazing!", icon: "🔥" },
        { amount: "2.0", label: "Superstar!", icon: "⭐" },
      ],
      headline: "Elite Style Session!",
      subtext: "Your stylist nailed it — celebrate!",
    },
  },
  "G$": {
    low: {
      amounts: [],
      headline: "Thanks for trying!",
      subtext: "Better luck next session",
    },
    standard: {
      amounts: [
        { amount: "1000", label: "Thanks!", icon: "🙏", usd: "~$0.10" },
        { amount: "2500", label: "Great!", icon: "👏", usd: "~$0.25" },
        { amount: "5000", label: "Amazing!", icon: "🔥", usd: "~$0.50" },
      ],
      headline: "Tip in G$ UBI",
      subtext: "Support your stylist with GoodDollar",
    },
    premium: {
      amounts: [
        { amount: "5000", label: "Great!", icon: "👏", usd: "~$0.50" },
        { amount: "10000", label: "Amazing!", icon: "🔥", usd: "~$1.00" },
        { amount: "20000", label: "Superstar!", icon: "⭐", usd: "~$2.00" },
      ],
      headline: "Elite Style Session!",
      subtext: "Celebrate with G$ UBI — GoodDollar on Celo",
    },
  },
};

/**
 * Get tip configuration based on session score and selected token.
 */
function getTipConfig(token: TipToken, score?: number) {
  const cfg = TIP_CONFIGS[token];
  if (!score) return cfg.standard;
  if (score >= 8) return cfg.premium;
  if (score >= 5) return cfg.standard;
  return cfg.low;
}

/**
 * Default agent wallet (from chains config).
 */
const DEFAULT_AGENT_ADDRESS = AGENT_WALLET;

/**
 * Resolve the ERC-20 token address for the selected tip token on Celo.
 */
function resolveTokenAddress(token: TipToken): Address {
  if (token === "G$") {
    const gd = getTokenAddress("GOOD_DOLLAR", "celo");
    if (gd) return gd;
    // Fallback — should never happen on Celo
    throw new Error("G$ token not available on Celo");
  }
  return CUSD_ADDRESS;
}

/**
 * TipSheet - Bottom sheet for post-session tipping
 *
 * Design:
 * - Progressive disclosure: single CTA → expands to amounts
 * - Score-gated: amounts adapt to session quality
 * - Token picker: cUSD or G$ (GoodDollar UBI)
 * - Inline feedback: success shown in-place, no state transition
 * - Real on-chain ERC-20 transfer via wagmi
 */
export function TipSheet({
  isOpen,
  onClose,
  agentAddress,
  score,
}: TipSheetProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [selectedToken, setSelectedToken] = useState<TipToken>("cUSD");
  const [isExpanded, setIsExpanded] = useState(false);
  const [sentAmount, setSentAmount] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<TipToken | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    writeContract,
    isPending: isWritePending,
    data: hash,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const config = useMemo(
    () => getTipConfig(selectedToken, score),
    [selectedToken, score],
  );
  const showTipPrompt = config.amounts.length > 0;

  const isProcessing = isWritePending || isConfirming;

  // When the on-chain tx confirms, record it server-side
  React.useEffect(() => {
    if (isConfirmed && hash && sentAmount && sentToken && connectedAddress) {
      setTxHash(hash);
      // Fire-and-forget: record the confirmed tip on the server
      fetchAgentApi("/api/agent/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: sentAmount,
          chain: "celo",
          token: sentToken,
          fromAddress: connectedAddress,
          txHash: hash,
        }),
      }).catch(console.error);
    }
  }, [isConfirmed, hash, sentAmount, sentToken, connectedAddress]);

  const handleQuickTip = useCallback(
    (amount: string) => {
      if (!isConnected || !connectedAddress) return;
      setLocalError(null);
      resetWrite();

      const recipient = (agentAddress || DEFAULT_AGENT_ADDRESS) as Address;

      let tokenAddress: Address;
      try {
        tokenAddress = resolveTokenAddress(selectedToken);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Token not available",
        );
        return;
      }

      writeContract(
        {
          address: tokenAddress,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [recipient, parseEther(amount)],
          chainId: celo.id,
        },
        {
          onSuccess: () => {
            setSentAmount(amount);
            setSentToken(selectedToken);
          },
          onError: (err) => {
            console.error("Tip transfer failed:", err);
            const errMsg = (err as { message?: string; shortMessage?: string }).message ?? "";
            const errShort = (err as { shortMessage?: string }).shortMessage ?? "";
            const insufficientGd =
              selectedToken === "G$" &&
              (errMsg.includes("insufficient") ||
                errShort.includes("insufficient"));
            setLocalError(
              err.message?.includes("User rejected")
                ? "Transaction cancelled"
                : insufficientGd
                  ? "Transfer failed — make sure you have enough G$ and CELO for gas. Claim your daily G$ UBI first!"
                  : `Transfer failed — make sure you have enough ${selectedToken} and CELO for gas`,
            );
          },
        },
      );
    },
    [
      connectedAddress,
      isConnected,
      resetWrite,
      agentAddress,
      selectedToken,
      writeContract,
    ],
  );

  const handleClose = () => {
    setIsExpanded(false);
    setSentAmount(null);
    setSentToken(null);
    setTxHash(null);
    setLocalError(null);
    resetWrite();
    onClose();
  };

  if (!isOpen) return null;

  const tokenLabel = sentToken ?? selectedToken;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Bottom Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-card rounded-t-3xl border-t border-border shadow-2xl"
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-foreground/20" />
          </div>

          {/* Header */}
          <div className="px-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-foreground font-bold">{config.headline}</h2>
                <p className="text-muted-foreground text-xs">{config.subtext}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-8">
            {/* Wallet status */}
            {!isConnected && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center mb-4">
                <p className="text-amber-600 dark:text-amber-200 text-sm">
                  Connect your wallet to send tips
                </p>
              </div>
            )}

            {/* Error display */}
            {localError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-center mb-4">
                <p className="text-rose-600 dark:text-rose-300 text-sm">{localError}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {sentAmount && txHash ? (
                /* Inline success feedback with tx link */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">Tip sent on-chain!</p>
                    <p className="text-muted-foreground text-xs">
                      {sentAmount} {tokenLabel} on Celo
                    </p>
                    <a
                      href={`https://celoscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 text-[10px] inline-flex items-center gap-1 mt-1 hover:underline"
                    >
                      View transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </motion.div>
              ) : isProcessing ? (
                /* Processing state */
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4"
                >
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="text-foreground font-medium">
                      {isWritePending
                        ? "Confirm in your wallet…"
                        : "Waiting for confirmation…"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {sentAmount || "…"} {tokenLabel} on Celo
                    </p>
                  </div>
                </motion.div>
              ) : !showTipPrompt ? (
                /* No tip prompt for low scores */
                <motion.div
                  key="no-tip"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4"
                >
                  <p className="text-muted-foreground text-sm">
                    Keep practicing — your stylist will get you there!
                  </p>
                </motion.div>
              ) : isExpanded ? (
                /* Expanded: token picker + amount selection */
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  {/* Token picker */}
                  <div className="flex justify-center">
                    <TipTokenPicker
                      value={selectedToken}
                      onChange={setSelectedToken}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {config.amounts.map((tip) => (
                      <button
                        key={`${selectedToken}-${tip.amount}`}
                        onClick={() => handleQuickTip(tip.amount)}
                        disabled={!isConnected || isProcessing}
                        className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-muted/30 border border-border hover:bg-muted hover:border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-2xl">{tip.icon}</span>
                        <span className="text-foreground font-bold">
                          {tip.amount} {selectedToken}
                        </span>
                        {tip.usd && (
                          <span className="text-emerald-400/60 text-[10px] font-medium">
                            {tip.usd}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {tip.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-muted-foreground/70 text-xs">
                    Tips sent on-chain to the stylist&apos;s wallet on Celo
                    {selectedToken === "G$" && " · Claim G$ UBI daily in Add Funds"}
                  </p>
                </motion.div>
              ) : (
                /* Collapsed: single CTA (progressive disclosure) */
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <button
                    onClick={() => setIsExpanded(true)}
                    disabled={!isConnected}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Heart className="w-5 h-5" />
                    Say Thanks
                  </button>
                  <p className="text-center text-muted-foreground/50 text-[10px]">
                    Tip in cUSD or G$ UBI · Powered by GoodDollar on Celo
                  </p>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        localStorage.setItem("onpoint-tip-dismissed", "1");
                      }
                      handleClose();
                    }}
                    className="w-full text-center text-muted-foreground/40 hover:text-muted-foreground/60 text-[10px] transition-colors pt-1"
                  >
                    Not now — don&apos;t auto-show tips
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * @deprecated Use TipSheet instead - kept for backward compatibility
 */
export const TipModal = TipSheet;
