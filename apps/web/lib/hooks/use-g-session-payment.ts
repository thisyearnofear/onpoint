/**
 * useGSessionPayment — pay G$ per premium styling session.
 *
 * The core "G$ has real value" surface. A user who hasn't unlocked a
 * premium persona via XP/badge/Pro can pay a small G$ amount per session
 * instead — the free, no-card path to premium styling. G$ is received by
 * the platform/agent wallet (same recipient as tips).
 *
 * Reuses the exact ERC-20 transfer pattern as TipModal (DRY): wagmi
 * `useWriteContract` + `useWaitForTransactionReceipt` on the G$ token
 * contract. No new contract, no new endpoint.
 *
 * Flow (consumed by VirtualTryOn persona gate):
 *   1. User selects a locked premium persona with a gCost
 *   2. `payForSession(persona)` → wallet prompt for G$ transfer
 *   3. On confirmation → `onPaid` fires, caller proceeds with the session
 *   4. On failure/cancel → error surfaced, session does not start
 *
 * Design (Core Principles):
 *   - DRY: same ERC-20 transfer + tx-receipt pattern as TipModal
 *   - ENHANCEMENT FIRST: extends the existing persona-select flow, no new
 *     page or route
 *   - CLEAN: hook owns only the payment; the caller owns the session UX
 */

"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, type Address } from "viem";
import { celo } from "viem/chains";
import { AGENT_WALLET, getTokenAddress } from "../../config/chains";
import { getGSessionCost } from "../utils/persona-config";
import { recordMetric } from "../utils/metrics";
import type { StylistPersona } from "@repo/ai-client";

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

export interface UseGSessionPaymentResult {
  /** True while waiting for the wallet signature or tx confirmation. */
  isPending: boolean;
  /** True after the G$ transfer has confirmed on-chain. */
  isConfirmed: boolean;
  /** The confirmed tx hash, if any. */
  txHash: string | null;
  /** Error message from the last payment attempt, cleared on retry. */
  error: string | null;
  /**
   * Initiate a G$ payment for one premium persona session.
   * Returns true if the transfer was submitted (caller may optimistically
   * proceed), false if it could not start (wrong chain, no wallet, no cost).
   */
  payForSession: (persona: StylistPersona) => boolean;
  /** Reset state for the next session. */
  reset: () => void;
}

export function useGSessionPayment(): UseGSessionPaymentResult {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending: isWritePending, data: hash, reset: resetWrite } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const [error, setError] = useState<string | null>(null);

  const isPending = isWritePending || isConfirming;

  const payForSession = useCallback(
    (persona: StylistPersona): boolean => {
      setError(null);
      if (!isConnected || !address) {
        setError("Connect your wallet to pay with G$.");
        return false;
      }

      const cost = getGSessionCost(persona);
      if (cost === null) {
        setError("This persona doesn't support G$ payment.");
        return false;
      }

      const tokenAddress = getTokenAddress("GOOD_DOLLAR", "celo");
      if (!tokenAddress) {
        setError("G$ token is not available on this chain.");
        return false;
      }

      try {
        writeContract(
          {
            address: tokenAddress as Address,
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [AGENT_WALLET as Address, parseEther(String(cost))],
            chainId: celo.id,
          },
          {
            onSuccess: () => {
              recordMetric("session_g$", "succeeded");
            },
            onError: (err) => {
              const msg =
                (err as { shortMessage?: string }).shortMessage ??
                (err as { message?: string }).message ??
                "G$ payment failed.";
              setError(msg);
              recordMetric("session_g$", "failed");
            },
          },
        );
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not submit G$ payment.",
        );
        recordMetric("session_g$", "failed");
        return false;
      }
    },
    [isConnected, address, writeContract],
  );

  const reset = useCallback(() => {
    resetWrite();
    setError(null);
  }, [resetWrite]);

  return {
    isPending,
    isConfirmed,
    txHash: hash ?? null,
    error,
    payForSession,
    reset,
  };
}
