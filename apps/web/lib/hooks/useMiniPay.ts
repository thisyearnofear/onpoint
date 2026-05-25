"use client";

import { useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Hook to detect and auto-connect to MiniPay wallet
 * MiniPay injects window.ethereum with isMiniPay flag
 */
export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Check if we're in MiniPay environment
    const checkMiniPay = () => {
      if (typeof window !== "undefined" && window.ethereum) {
        const isMiniPayEnv = window.ethereum.isMiniPay === true;
        setIsMiniPay(isMiniPayEnv);
        return isMiniPayEnv;
      }
      return false;
    };

    const isInMiniPay = checkMiniPay();

    // Auto-connect if in MiniPay and not already connected
    if (isInMiniPay && !isConnected && !isConnecting) {
      setIsConnecting(true);
      try {
        connect({
          connector: injected({ target: "metaMask" }),
        });
      } catch (error) {
        console.error("Failed to connect to MiniPay:", error);
      } finally {
        setIsConnecting(false);
      }
    }
  }, [connect, isConnected, isConnecting]);

  return {
    isMiniPay,
    isConnecting,
  };
}

/**
 * Type declaration for window.ethereum with MiniPay properties
 */
declare global {
  interface Window {
    ethereum?: {
      isMiniPay?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
