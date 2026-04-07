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

// Global fetch interceptor to redirect eth.merkle.io requests to ensdata.net
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;

    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url;
    }

    // Intercept eth.merkle.io requests and redirect to ensdata.net
    if (url.includes("eth.merkle.io")) {
      try {
        // Extract ENS name from the URL
        const urlObj = new URL(url);
        const ensName = urlObj.pathname.replace("/", "");

        if (ensName) {
          // Redirect to ensdata.net
          const ensdataUrl = `https://ensdata.net/${ensName}`;
          console.log(`Redirecting ENS request from ${url} to ${ensdataUrl}`);

          return originalFetch(ensdataUrl, {
            ...init,
            headers: {
              ...init?.headers,
              Accept: "application/json",
            },
          });
        }
      } catch (error) {
        console.warn("Failed to redirect ENS request:", error);
      }
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
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
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
