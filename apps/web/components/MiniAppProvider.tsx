"use client";

/**
 * Local replacement for @neynar/react's MiniAppProvider.
 *
 * The upstream provider gates children behind `isSDKLoaded` — it renders
 * `null` until the Farcaster miniapp SDK resolves. On the server that's
 * never, so the entire app shipped an empty SSR shell and nothing rendered
 * client-side until a third-party SDK finished booting.
 *
 * This version always renders children and hydrates the miniapp context
 * client-side only. Consumers see `{ isSDKLoaded: false, context: null }`
 * during SSR and outside Farcaster, then get the real context once loaded.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-sdk";

interface MiniAppState {
  isSDKLoaded: boolean;
  context: Context.MiniAppContext | null;
}

const MiniAppContext = createContext<MiniAppState>({
  isSDKLoaded: false,
  context: null,
});

export function useMiniApp(): MiniAppState {
  return useContext(MiniAppContext);
}

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MiniAppState>({
    isSDKLoaded: false,
    context: null,
  });

  useEffect(() => {
    let cancelled = false;
    sdk.context
      .then((context) => {
        if (cancelled) return;
        setState({ isSDKLoaded: true, context });
        // Signal ready to the Farcaster host (removes its splash screen).
        sdk.actions.ready().catch(() => {});
      })
      .catch(() => {
        // Not inside a Farcaster client — leave defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MiniAppContext.Provider value={state}>{children}</MiniAppContext.Provider>
  );
}
