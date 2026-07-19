"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Ban,
  Gift,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { useAccount } from "wagmi";
import { GClaimCTA } from "../Curator/GClaimCTA";

type FiatCurrency = "MXN" | "USD" | "EUR";

const FIAT_OPTIONS: { value: FiatCurrency; label: string; symbol: string }[] = [
  { value: "MXN", label: "MXN", symbol: "$" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
];

const SUGGESTED_AMOUNTS: Record<FiatCurrency, string[]> = {
  MXN: ["200", "500", "1000"],
  USD: ["10", "25", "50"],
  EUR: ["10", "25", "50"],
};

interface TopUpQuote {
  quoteId: string;
  fiat: FiatCurrency;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  rate: string;
  fees: string;
  expiresAt: string;
  paymentInstructions?: {
    method: string;
    clabe?: string;
    reference?: string;
    barcodeUrl?: string;
    expiresAt?: string;
  };
  chain: string;
  recipientAddress: string;
}

interface TopUpOrder {
  orderId: string;
  status: string;
  fiat: FiatCurrency;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  recipientAddress: string;
  chain: string;
  createdAt: string;
  expiresAt?: string;
  paymentInstructions?: TopUpQuote["paymentInstructions"];
}

export function AddFundsButton() {
  const { address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"amount" | "quote" | "order" | "done">("amount");
  const [fiat, setFiat] = useState<FiatCurrency>("MXN");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<TopUpQuote | null>(null);
  const [order, setOrder] = useState<TopUpOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showGClaim, setShowGClaim] = useState(false);
  const [gClaimTxHash, setGClaimTxHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("amount");
    setFiat("MXN");
    setAmount("");
    setQuote(null);
    setOrder(null);
    setLoading(false);
    setError(null);
    setCopiedField(null);
    setShowGClaim(false);
    setGClaimTxHash(null);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(reset, 300);
  }, [reset]);

  const handleGetQuote = async () => {
    if (!address || !amount) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          userAddress: address,
          fiatAmount: amount,
          fiat,
          chain: "celo",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to get quote");
      }
      setQuote(data.quote);
      setStep("quote");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!quote) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order",
          quote,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create order");
      }
      setOrder(data.order);
      setStep("order");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const closeLabel = order
    ? order.status === "completed" || order.status === "payment_received"
      ? "Done"
      : "Close"
    : "Cancel";

  return (
    <>
      <Button
        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold"
        onClick={() => setIsOpen(true)}
      >
        <Wallet className="w-4 h-4 mr-2" />
        Add Funds
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-card rounded-t-3xl border-t border-border shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-foreground/20" />
              </div>

              <div className="px-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-bold">Add Funds</h2>
                    <p className="text-muted-foreground text-xs">
                      {step === "amount"
                        ? "Top up with fiat via SPEI / OXXO"
                        : step === "quote"
                          ? "Review your quote"
                          : step === "order"
                            ? "Complete your payment"
                            : step === "done"
                              ? gClaimTxHash
                                ? "G$ UBI claimed"
                                : "Funds added"
                              : "Funds added"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 pb-8 space-y-4">
                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                    <p className="text-rose-300 text-xs">
                      {error.includes("not configured")
                        ? "Fiat onramp is not configured. Set ETHERFUSE_API_KEY to enable."
                        : error}
                    </p>
                  </div>
                )}

                {step === "amount" && (
                  <div className="space-y-4">
                    {!address && (
                      <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-center">
                        <p className="text-amber-200 text-sm">
                          Connect your wallet to add funds
                        </p>
                      </div>
                    )}

                    {/* G$ UBI claim tile */}
                    {address && !showGClaim && (
                      <button
                        onClick={() => setShowGClaim(true)}
                        className="flex w-full items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3 text-left transition-colors hover:bg-success/10"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                          <Gift className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-emerald-300">
                            Claim free G$ UBI
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Free daily GoodDollar on Celo — no fiat needed
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-emerald-400" />
                      </button>
                    )}

                    {address && showGClaim && (
                      <GClaimCTA
                        compact
                        onClaimed={(txHash) => {
                          setGClaimTxHash(txHash);
                          // Transition to unified success step
                          setStep("done");
                          // Auto-close after 4 seconds
                          setTimeout(() => {
                            handleClose();
                          }, 4000);
                        }}
                      />
                    )}

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">
                        Currency
                      </p>
                      <div className="flex gap-2">
                        {FIAT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setFiat(opt.value)}
                            className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                              fiat === opt.value
                                ? "bg-success/10 border-success/30 text-emerald-300"
                                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">
                        Amount
                      </p>
                      <div className="flex items-center gap-1 px-4 py-3 rounded-xl bg-muted/30 border border-border">
                        <span className="text-foreground font-bold text-lg">
                          {FIAT_OPTIONS.find((o) => o.value === fiat)?.symbol}
                        </span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          min="1"
                          className="flex-1 bg-transparent text-foreground text-lg font-bold outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        {SUGGESTED_AMOUNTS[fiat].map((a) => (
                          <button
                            key={a}
                            onClick={() => setAmount(a)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                              amount === a
                                ? "bg-success/10 border-success/30 text-emerald-300"
                                : "bg-muted/20 border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {FIAT_OPTIONS.find((o) => o.value === fiat)?.symbol}
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full bg-success hover:bg-success active:bg-success text-white rounded-full py-4 font-bold"
                      disabled={!address || !amount}
                      loading={loading}
                      loadingIcon={<Loader2 className="w-4 h-4 animate-spin" />}
                      onClick={handleGetQuote}
                    >
                      {loading ? "Getting quote…" : "Get Quote"}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </Button>
                  </div>
                )}

                {step === "quote" && quote && (
                  <div className="space-y-4">
                    <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">You send</span>
                        <span className="text-sm font-bold text-foreground">
                          {FIAT_OPTIONS.find((o) => o.value === quote.fiat)?.symbol}
                          {quote.fiatAmount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">You receive</span>
                        <span className="text-sm font-bold text-emerald-300">
                          ~{quote.cryptoAmount} {quote.cryptoAsset}
                        </span>
                      </div>
                      <div className="border-t border-border/50 pt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Rate</span>
                          <span className="text-foreground">
                            1 {quote.cryptoAsset} ≈ {quote.rate} {quote.fiat}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Fees</span>
                          <span className="text-foreground">{quote.fees} {quote.fiat}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Network</span>
                          <span className="text-foreground capitalize">{quote.chain}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 text-muted-foreground border border-border"
                        onClick={handleClose}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-success hover:bg-success active:bg-success text-white rounded-full font-bold"
                        loading={loading}
                        loadingIcon={<Loader2 className="w-4 h-4 animate-spin" />}
                        onClick={handleCreateOrder}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {step === "order" && order && (
                  <div className="space-y-4">
                    <div className="bg-success/10 border border-success/20 rounded-2xl p-4 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="text-emerald-300 font-bold text-sm">
                        Order Created
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Transfer the exact amount to complete your top-up
                      </p>
                    </div>

                    {order.paymentInstructions && (
                      <div className="space-y-3">
                        {order.paymentInstructions.clabe && (
                          <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                              SPEI CLABE
                            </p>
                            <div className="flex items-center justify-between">
                              <code className="text-sm font-mono text-foreground break-all">
                                {order.paymentInstructions.clabe}
                              </code>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    order.paymentInstructions!.clabe!,
                                    "clabe",
                                  )
                                }
                                className="p-1.5 hover:bg-muted rounded-lg shrink-0 ml-2"
                              >
                                {copiedField === "clabe" ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {order.paymentInstructions.reference && (
                          <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                              Reference
                            </p>
                            <div className="flex items-center justify-between">
                              <code className="text-sm font-mono text-foreground">
                                {order.paymentInstructions.reference}
                              </code>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    order.paymentInstructions!.reference!,
                                    "ref",
                                  )
                                }
                                className="p-1.5 hover:bg-muted rounded-lg shrink-0 ml-2"
                              >
                                {copiedField === "ref" ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground/60 text-center">
                          Funds will be credited automatically once the transfer is detected.
                        </p>
                      </div>
                    )}

                    {!order.paymentInstructions && (
                      <div className="text-center py-4">
                        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Waiting for payment instructions…
                        </p>
                      </div>
                    )}

                    <Button
                      className="w-full bg-success hover:bg-success text-white rounded-full py-4 font-bold"
                      onClick={handleClose}
                    >
                      {closeLabel}
                    </Button>
                  </div>
                )}

                {step === "done" && (
                  <div className="space-y-4">
                    <div className="bg-success/10 border border-success/20 rounded-2xl p-6 text-center space-y-3">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                      <p className="text-emerald-300 font-bold text-lg">
                        {gClaimTxHash ? "G$ Claimed!" : "Funds Added!"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {gClaimTxHash
                          ? "Your daily GoodDollar UBI is now in your wallet on Celo."
                          : "Your top-up is being processed."}
                      </p>
                      {gClaimTxHash && (
                        <a
                          href={`https://celoscan.io/tx/${gClaimTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                        >
                          View on Celoscan
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 pt-1">
                        Closing automatically…
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
