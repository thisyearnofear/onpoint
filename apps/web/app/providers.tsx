"use client";

// Polyfill indexedDB for server-side rendering
if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as Record<string, any>).indexedDB = {
    open: () => ({ onsuccess: () => {}, onerror: () => {} }),
    deleteDatabase: () => ({ onsuccess: () => {}, onerror: () => {} }),
    transaction: () => ({
      objectStore: () => ({
        get: () => ({ onsuccess: () => {}, onerror: () => {} }),
      }),
    }),
  };
}

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "../config/wagmi";
import { AIProviderContext } from "@repo/ai-client";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect } from "react";
import { MiniAppProvider, useMiniApp } from "@neynar/react";

const queryClient = new QueryClient();



function MiniAppReady() {
  const { isSDKLoaded } = useMiniApp();
  useEffect(() => {
    const init = async () => {
      try {
        if (isSDKLoaded && sdk?.actions?.ready) {
          await sdk.actions.ready();
        }
      } catch {
        // ignore
      }
    };
    init();
  }, [isSDKLoaded]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniAppProvider analyticsEnabled={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <AIProviderContext>
              <MiniAppReady />
              {children}
            </AIProviderContext>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniAppProvider>
  );
}
