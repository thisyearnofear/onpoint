'use client';

// Polyfill indexedDB for server-side rendering
if (typeof window === 'undefined') {
  (globalThis as any).indexedDB = {
    open: () => ({ onsuccess: () => {}, onerror: () => {} }),
    deleteDatabase: () => ({ onsuccess: () => {}, onerror: () => {} }),
    transaction: () => ({ objectStore: () => ({ get: () => ({ onsuccess: () => {}, onerror: () => {} }) }) }),
  };
}

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '../config/wagmi';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}