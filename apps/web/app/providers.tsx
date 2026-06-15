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
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { config } from "../config/wagmi";
import { AIProviderContext } from "@repo/ai-client";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useState } from "react";
import { MiniAppProvider, useMiniApp } from "@neynar/react";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import type { User } from "@auth0/nextjs-auth0/types";
import { SWRConfig } from "swr";
import { Toaster } from "@/components/toast";
import { StyleProvider } from "@/lib/context/StyleContext";
import { MiniPayProvider } from "@/components/MiniPayProvider";

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
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    };

    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User;
}) {
  const theme = useResolvedTheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    // Auth0's useUser() uses SWR under the hood. For anonymous visitors the
    // /auth/profile endpoint returns 401, and SWR's default onErrorRetry will
    // hammer it on a backoff loop — visible as repeated 401s in the console
    // on every landing page load. Disable retries on auth errors so the
    // anonymous case fails once and stays quiet.
    <SWRConfig
      value={{
        onErrorRetry: (err, key, _config, revalidate, { retryCount }) => {
          // Auth0's useUser() fetches /auth/profile and throws "Unauthorized"
          // when the visitor is anonymous. Default SWR retry loops on this and
          // floods the console. Skip retries for that probe outright.
          if (typeof key === "string" && key.includes("/auth/profile")) return;
          const status =
            (err as { status?: number })?.status ??
            (err as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403 || status === 404) return;
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 5000);
        },
      }}
    >
    <Auth0Provider user={user}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <MiniAppProvider analyticsEnabled={true}>
            <MiniPayProvider>
              <RainbowKitProvider
                theme={(theme === "dark" ? darkTheme : lightTheme)({
                  accentColor: "#7c3aed",
                  accentColorForeground: "white",
                  borderRadius: "medium",
                  fontStack: "system",
                })}
              >
                <AIProviderContext>
                  <StyleProvider>
                  <MiniAppReady />
                  <Toaster>
                    {children}
                  </Toaster>
                  </StyleProvider>
                </AIProviderContext>
              </RainbowKitProvider>
            </MiniPayProvider>
          </MiniAppProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </Auth0Provider>
    </SWRConfig>
  );
}
