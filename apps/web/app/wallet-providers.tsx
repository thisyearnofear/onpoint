"use client";

import React from "react";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { config } from "../config/wagmi";
import { MiniPayProvider } from "@/components/MiniPayProvider";
import { useResolvedTheme } from "@/lib/hooks/useResolvedTheme";

/**
 * Wallet provider stack: wagmi + MiniPay auto-connect + RainbowKit.
 *
 * Deliberately NOT in the root Providers — these SDKs are the largest chunk
 * of client JS and only wallet-interactive routes need them. Add a
 * `layout.tsx` wrapping children in this provider for any route that calls
 * wagmi/RainbowKit hooks (currently /lab and /curator/onboard).
 */
export function WalletProviders({ children }: { children: React.ReactNode }) {
  const theme = useResolvedTheme();

  return (
    <WagmiProvider config={config}>
      <MiniPayProvider>
        <RainbowKitProvider
          theme={(theme === "dark" ? darkTheme : lightTheme)({
            accentColor: "#7c3aed",
            accentColorForeground: "white",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </MiniPayProvider>
    </WagmiProvider>
  );
}
