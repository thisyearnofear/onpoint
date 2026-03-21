/**
 * WDK Wallet Service for AI Agent
 *
 * This service enables the AI Stylist agent to operate as an autonomous
 * economic agent with self-custodial wallet capabilities.
 *
 * Uses centralized chain configuration from /config/chains.ts.
 * ERC-20 operations should use /lib/utils/erc20.ts instead.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { celo, celoAlfajores, base, mainnet, polygon } from "viem/chains";
import {
  RPC_URLS,
  NFT_CONTRACTS,
  getExplorerUrl,
  type ChainName,
} from "../../config/chains";

// ============================================
// Types
// ============================================

// Map our ChainName to WDK chain keys
const WDK_CHAINS = {
  ethereum: {
    name: "Ethereum",
    provider: RPC_URLS.ethereum,
    chainId: 1,
    viemChain: mainnet,
  },
  celo: {
    name: "Celo",
    provider: RPC_URLS.celo,
    chainId: 42220,
    viemChain: celo,
  },
  base: {
    name: "Base",
    provider: RPC_URLS.base,
    chainId: 8453,
    viemChain: base,
  },
  polygon: {
    name: "Polygon",
    provider: RPC_URLS.polygon,
    chainId: 137,
    viemChain: polygon,
  },
} as const;

type WDKChain = keyof typeof WDK_CHAINS;

interface AgentWalletConfig {
  seedPhrase?: string;
  chains?: Array<WDKChain>;
  autoConnect?: boolean;
}

export interface WalletInfo {
  chain: string;
  address: string;
  balance: string;
  chainId: number;
}

interface TransactionResult {
  hash: string;
  chain: string;
  status: "pending" | "confirmed" | "failed";
  explorerUrl?: string;
}

// ============================================
// Agent Wallet Service
// ============================================

/**
 * AgentWalletService - Self-custodial wallet for AI Agent operations
 *
 * This service enables the OnPoint AI Stylist to:
 * 1. Hold and manage funds across multiple chains
 * 2. Receive tips from users (CELO, native tokens)
 * 3. Execute payments for API usage (CELO for Gemini Live)
 *
 * For ERC-20 operations (cUSD, USDT), use /lib/utils/erc20.ts
 * For NFT minting, use /packages/blockchain-client
 */
export class AgentWalletService {
  private wdk: InstanceType<typeof WDK> | null = null;
  private seedPhrase: string;
  private registeredChains: Set<WDKChain>;
  private initialized = false;

  constructor(config: AgentWalletConfig = {}) {
    this.seedPhrase = config.seedPhrase || this.generateSeedPhrase();
    this.registeredChains = new Set(config.chains || ["celo", "base"]);
  }

  private generateSeedPhrase(): string {
    return WDK.getRandomSeedPhrase();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[AgentWallet] Initializing WDK...");

    this.wdk = new WDK(this.seedPhrase);

    for (const chain of this.registeredChains) {
      const chainConfig = WDK_CHAINS[chain];
      if (!chainConfig) continue;

      try {
        this.wdk.registerWallet(chain, WalletManagerEvm, {
          provider: chainConfig.provider,
        });
        console.log(`[AgentWallet] Registered ${chainConfig.name} wallet`);
      } catch (err) {
        console.error(`[AgentWallet] Failed to register ${chain}:`, err);
      }
    }

    this.initialized = true;
    console.log("[AgentWallet] Initialization complete");
  }

  async getAddresses(): Promise<Record<string, string>> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const addresses: Record<string, string> = {};

    for (const chain of this.registeredChains) {
      try {
        const account = await this.wdk.getAccount(chain, 0);
        const address = await account.getAddress();
        addresses[chain] = address;
      } catch (err) {
        console.error(`[AgentWallet] Failed to get address for ${chain}:`, err);
      }
    }

    return addresses;
  }

  async getWalletInfo(): Promise<WalletInfo[]> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const wallets: WalletInfo[] = [];

    for (const chain of this.registeredChains) {
      try {
        const chainConfig = WDK_CHAINS[chain];
        const account = await this.wdk!.getAccount(chain, 0);
        const address = await account.getAddress();
        const balance = await account.getBalance();

        wallets.push({
          chain: chainConfig.name,
          address,
          balance: balance.toString(),
          chainId: chainConfig.chainId,
        });
      } catch (err) {
        console.error(`[AgentWallet] Failed to get info for ${chain}:`, err);
      }
    }

    return wallets;
  }

  async getBalance(chain: WDKChain): Promise<string> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const account = await this.wdk.getAccount(chain, 0);
    const balance = await account.getBalance();
    return balance.toString();
  }

  async sendTransaction(
    chain: WDKChain,
    to: string,
    value: bigint,
  ): Promise<TransactionResult> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const chainConfig = WDK_CHAINS[chain];
    const account = await this.wdk.getAccount(chain, 0);

    const result = await account.sendTransaction({
      to,
      value,
    });

    return {
      hash: result.hash,
      chain: chainConfig.name,
      status: "pending",
      explorerUrl: getExplorerUrl(chain as ChainName, result.hash),
    };
  }

  async estimateTransactionCost(
    chain: WDKChain,
    to: string,
    value: bigint,
  ): Promise<string> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const account = await this.wdk.getAccount(chain, 0);
    const quote = await account.quoteSendTransaction({ to, value });
    return quote.fee.toString();
  }

  getSeedPhrase(): string {
    return this.seedPhrase;
  }

  async getAgentAddresses(): Promise<{
    treasury: string;
    operations: string;
    nftMinter: string;
  }> {
    const addresses = await this.getAddresses();
    const celoAddress =
      addresses.celo || addresses.base || Object.values(addresses)[0] || "";

    return {
      treasury: celoAddress,
      operations: celoAddress,
      nftMinter: celoAddress,
    };
  }

  /**
   * Check if NFT minting is available on this chain
   * For actual minting, use @repo/blockchain-client
   */
  canMintNFT(chain: ChainName): boolean {
    return NFT_CONTRACTS[chain] !== null;
  }
}

// ============================================
// Singleton
// ============================================

let agentWalletInstance: AgentWalletService | null = null;

export async function getAgentWallet(
  config?: AgentWalletConfig,
): Promise<AgentWalletService> {
  if (!agentWalletInstance) {
    agentWalletInstance = new AgentWalletService(config);
    await agentWalletInstance.initialize();
  }
  return agentWalletInstance;
}

export async function getAgentWalletInfo() {
  const wallet = await getAgentWallet();
  return {
    addresses: await wallet.getAgentAddresses(),
    walletInfo: await wallet.getWalletInfo(),
  };
}
