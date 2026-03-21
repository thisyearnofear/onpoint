"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { celo, celoAlfajores } from "../../config/chains";

// OnPoint's receiving wallet for Gemini Live payments
const RECIPIENT_ADDRESS = "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1";

interface GeminiLivePaymentButtonProps {
  onSuccess: (sessionToken: string) => void;
  onError?: (error: string) => void;
}

export function GeminiLivePaymentButton({
  onSuccess,
  onError,
}: GeminiLivePaymentButtonProps) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "confirming" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Check CELO balance
  const { data: balanceData } = useBalance({
    address,
    chainId: celoAlfajores.id, // Check on testnet by default, will switch if needed
  });

  const PAYMENT_AMOUNT = "0.5"; // 0.5 CELO for Gemini Live access
  const isOnCelo = chainId === celo.id || chainId === celoAlfajores.id;
  const isTestnet = chainId === celoAlfajores.id;

  // Check if user has enough balance
  const hasEnoughBalance =
    balanceData && balanceData.value >= parseEther(PAYMENT_AMOUNT);

  const handlePayment = useCallback(async () => {
    if (!isConnected || !address) {
      onError?.("Please connect your wallet first");
      return;
    }

    if (!isOnCelo) {
      // Switch to Celo testnet first
      switchChain({ chainId: celoAlfajores.id });
      return;
    }

    if (!hasEnoughBalance) {
      onError?.(
        `Insufficient CELO balance. You need at least ${PAYMENT_AMOUNT} CELO.`,
      );
      return;
    }

    setPaymentStatus("pending");
    setStatusMessage("Confirm transaction in your wallet...");

    try {
      // Send CELO payment
      writeContract({
        address: RECIPIENT_ADDRESS as `0x${string}`,
        abi: [
          {
            name: "transfer",
            type: "function",
            stateMutability: "payable",
            inputs: [],
            outputs: [],
          },
        ],
        functionName: "transfer",
        args: [],
        value: parseEther(PAYMENT_AMOUNT),
      });
    } catch (err) {
      console.error("Payment failed:", err);
      setPaymentStatus("error");
      setStatusMessage("Transaction failed");
      onError?.("Payment transaction failed");
    }
  }, [
    isConnected,
    address,
    isOnCelo,
    hasEnoughBalance,
    switchChain,
    writeContract,
    onError,
  ]);

  // Handle transaction confirmation
  React.useEffect(() => {
    const verifyPayment = async (txHash: string) => {
      try {
        setStatusMessage("Verifying payment on-chain...");

        const response = await fetch("/api/ai/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionHash: txHash,
            chainId: chainId,
            walletAddress: address,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Payment verification failed");
        }

        const data = await response.json();

        if (data.success && data.token) {
          setPaymentStatus("success");
          setStatusMessage("Payment verified! Unlocking Gemini Live...");

          // Notify parent component with the verified token
          onSuccess(data.token);
        } else {
          throw new Error("Invalid verification response");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setPaymentStatus("error");
        setStatusMessage(
          err instanceof Error ? err.message : "Verification failed",
        );
        onError?.(
          err instanceof Error ? err.message : "Payment verification failed",
        );
      }
    };

    if (isPending) {
      setPaymentStatus("pending");
      setStatusMessage("Transaction submitted...");
    } else if (isConfirming) {
      setPaymentStatus("confirming");
      setStatusMessage("Confirming on blockchain...");
    } else if (isSuccess && hash) {
      // Verify the payment with our backend
      verifyPayment(hash);
    } else if (writeError || receiptError) {
      setPaymentStatus("error");
      const errMsg =
        writeError?.message || receiptError?.message || "Transaction failed";

      if (errMsg.includes("User rejected")) {
        setStatusMessage("Transaction cancelled");
      } else if (errMsg.includes("insufficient funds")) {
        setStatusMessage("Insufficient funds for gas");
      } else {
        setStatusMessage("Transaction failed");
      }
      onError?.(errMsg);
    }
  }, [
    isPending,
    isConfirming,
    isSuccess,
    writeError,
    receiptError,
    hash,
    onSuccess,
    onError,
    chainId,
    address,
  ]);

  // Success state
  if (paymentStatus === "success" || isSuccess) {
    return (
      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-2xl border border-emerald-500/30 animate-in fade-in zoom-in duration-300">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-emerald-300 font-bold text-sm">
            Gemini Live Unlocked!
          </p>
          <p className="text-emerald-400/60 text-xs">Starting session...</p>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <p className="text-slate-400 text-sm text-center">
          Connect your wallet to unlock Gemini Live
        </p>
      </div>
    );
  }

  // Not on Celo state
  if (!isOnCelo) {
    return (
      <Button
        onClick={handlePayment}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl py-4 flex items-center justify-center gap-3"
      >
        <CreditCard className="w-5 h-5" />
        <span className="font-bold">
          Switch to Celo to Pay {PAYMENT_AMOUNT} CELO
        </span>
      </Button>
    );
  }

  // Insufficient balance state
  if (hasEnoughBalance === false) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
        <AlertCircle className="w-8 h-8 text-rose-400" />
        <p className="text-rose-300 text-sm text-center">
          Insufficient CELO balance
        </p>
        <p className="text-rose-400/60 text-xs text-center">
          You need at least {PAYMENT_AMOUNT} CELO. Current:{" "}
          {balanceData ? formatEther(balanceData.value) : "0"} CELO
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handlePayment}
        disabled={paymentStatus === "pending" || paymentStatus === "confirming"}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl py-4 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {paymentStatus === "pending" || paymentStatus === "confirming" ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold">{statusMessage}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span className="font-bold">
              Unlock Gemini Live — {PAYMENT_AMOUNT} CELO
            </span>
          </>
        )}
      </Button>

      {paymentStatus === "error" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-rose-300 text-xs">{statusMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPaymentStatus("idle");
              reset?.();
            }}
            className="ml-auto text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      <p className="text-[10px] text-slate-500 text-center">
        {isTestnet
          ? "Testnet — using Celo Alfajores"
          : "Mainnet — real CELO will be charged"}
      </p>
    </div>
  );
}
