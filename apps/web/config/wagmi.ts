"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createStorage, http } from "wagmi";
// Importing commonly available chains
import { mainnet, sepolia } from "wagmi/chains";
import {
  base,
  arbitrum,
  celo,
  celoAlfajores,
  zetaChain,
  lisk,
  allConfiguredChains,
} from "./chains";

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
    [celoAlfajores.id]: http(process.env.NEXT_PUBLIC_CELO_ALFAJORES_RPC_URL),
    [zetaChain.id]: http(),
    [lisk.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
  storage: customStorage,
});
