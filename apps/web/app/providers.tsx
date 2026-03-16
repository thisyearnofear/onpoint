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
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { config } from "../config/wagmi";
import { AIProviderContext } from "@repo/ai-client";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useState } from "react";
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

function useResolvedTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const resolve = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };

    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useResolvedTheme();

  return (
    <MiniAppProvider analyticsEnabled={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={(theme === "dark" ? darkTheme : lightTheme)({
              accentColor: "#7c3aed",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
            })}
          >
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
