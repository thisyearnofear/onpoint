"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createStorage, http } from "wagmi";
// Importing commonly available chains
import { mainnet, sepolia } from "wagmi/chains";
import {
  base,
  arbitrum,
  celo,
  celoSepolia,
  zetaChain,
  lisk,
  allConfiguredChains,
} from "./chains";

// Custom ENS resolver using ensdata.net (free, CORS-friendly alternative to eth.merkle.io)
async function customEnsResolver(name: string) {
  try {
    const response = await fetch(`https://ensdata.net/${name}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Return the resolved address if available
    return data.address || null;
  } catch (error) {
    console.warn("ENS resolution failed:", error);
    return null;
  }
}

// Custom ENS avatar resolver
async function customEnsAvatarResolver(name: string) {
  try {
    const response = await fetch(`https://ensdata.net/media/avatar/${name}`, {
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    // Return the avatar URL
    return `https://ensdata.net/media/avatar/${name}`;
  } catch (error) {
    console.warn("ENS avatar resolution failed:", error);
    return null;
  }
}

// Block eth.merkle.io entirely — wagmi now uses explicit RPC URLs so this
// should never be called, but intercept as a safety net and return empty.
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.includes("eth.merkle.io")) {
      // Return an empty successful response instead of hitting the CORS-blocked endpoint
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

// Custom storage that works on both client and server
const customStorage =
  typeof window !== "undefined"
    ? undefined // Use default storage on client
    : createStorage({
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      });

export const config = getDefaultConfig({
  appName: "OnPoint",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: allConfiguredChains as any,
  transports: {
    [mainnet.id]: http("https://cloudflare-eth.com"),
    [base.id]: http("https://mainnet.base.org"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [celo.id]: http(),
    [celoSepolia.id]: http(
      "https://celo-sepolia.g.alchemy.com/v2/W73tCsyRsW9JfV4orIbr7",
    ),
    [zetaChain.id]: http(),
    [lisk.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
  storage: customStorage,
});

// Custom ENS configuration for RainbowKit
export const ensConfig = {
  // Custom ENS resolver using ensdata.net
  async resolveName(name: string) {
    return await customEnsResolver(name);
  },
  // Custom ENS avatar resolver
  async resolveAvatar(name: string) {
    return await customEnsAvatarResolver(name);
  },
};
