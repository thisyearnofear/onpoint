"use client";

import { useEffect } from "react";
import { useConnect, useAccount } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Provider component that handles MiniPay auto-connection
 * Should be placed inside WagmiProvider
 */
export function MiniPayProvider({ children }: { children: React.ReactNode }) {
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Check if we're in MiniPay environment
    const isMiniPay =
      typeof window !== "undefined" &&
      window.ethereum?.isMiniPay === true;

    // Auto-connect if in MiniPay and not already connected
    if (isMiniPay && !isConnected) {
      try {
        connect({
          connector: injected({ target: "metaMask" }),
        });
      } catch (error) {
        console.error("Failed to auto-connect to MiniPay:", error);
      }
    }
  }, [connect, isConnected]);

  return <>{children}</>;
}
