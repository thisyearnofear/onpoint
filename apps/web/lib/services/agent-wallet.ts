/**
 * WDK Wallet Service for AI Agent
 *
 * This service enables the AI Stylist agent to operate as an autonomous
 * economic agent with self-custodial wallet capabilities.
 *
 * WDK uses bare-node-runtime which may not be available in all environments.
 * When WDK native addons are unavailable, falls back to AGENT_WALLET_ADDRESS
 * env var for address resolution.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { celo, base, mainnet, polygon } from "viem/chains";
import {
  RPC_URLS,
  NFT_CONTRACTS,
  getExplorerUrl,
  type ChainName,
} from "../../config/chains";

// WDK modules loaded dynamically at runtime
let WDK: any = null;
let WalletManagerEvm: any = null;
let wdkAvailable = false;

async function loadWDK() {
  if (WDK !== null) return; // Already attempted
  try {
    const wdkModule = await import("@tetherto/wdk");
    WDK = wdkModule.default ?? wdkModule;
    const evmModule = await import("@tetherto/wdk-wallet-evm");
    WalletManagerEvm = evmModule.default ?? evmModule;
    wdkAvailable = true;
    console.log("[AgentWallet] WDK loaded successfully");
  } catch (err: any) {
    console.warn(
      "[AgentWallet] WDK not available, using env fallback:",
      err?.message || err,
    );
    WDK = null;
    wdkAvailable = false;
  }
}

// ============================================
// Types
// ============================================

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
// Fallback: resolve from env var
// ============================================

function deriveAddressFromKey(privateKey: string): string | null {
  try {
    const { privateKeyToAccount } = require("viem/accounts");
    const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(pk as `0x${string}`);
    return account.address;
  } catch {
    return null;
  }
}

function getFallbackAddresses(): Record<string, string> {
  // Prefer explicit AGENT_WALLET_ADDRESS, then derive from AGENT_PRIVATE_KEY
  const addr =
    process.env.AGENT_WALLET_ADDRESS ||
    (process.env.AGENT_PRIVATE_KEY
      ? deriveAddressFromKey(process.env.AGENT_PRIVATE_KEY)
      : null) ||
    "0xC9A025Fb607b455308bCb6f35a0F484f016C776b";
  return {
    celo: addr,
    base: addr,
    ethereum: addr,
    polygon: addr,
  };
}

// ============================================
// Agent Wallet Service
// ============================================

export class AgentWalletService {
  private wdk: any = null;
  private seedPhrase: string;
  private registeredChains: Set<WDKChain>;
  private initialized = false;
  private usingWdk = false;

  constructor(config: AgentWalletConfig = {}) {
    this.seedPhrase = config.seedPhrase || "";
    this.registeredChains = new Set(config.chains || ["celo", "base"]);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await loadWDK();

    if (!wdkAvailable) {
      this.initialized = true;
      console.log("[AgentWallet] Using env fallback (WDK unavailable)");
      return;
    }

    if (!this.seedPhrase) {
      this.seedPhrase = WDK.getRandomSeedPhrase();
    }

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

    this.usingWdk = true;
    this.initialized = true;
    console.log("[AgentWallet] Initialization complete");
  }

  async getAddresses(): Promise<Record<string, string>> {
    if (!this.initialized) await this.initialize();

    // WDK path
    if (this.usingWdk && this.wdk) {
      const addresses: Record<string, string> = {};
      for (const chain of this.registeredChains) {
        try {
          const account = await this.wdk.getAccount(chain, 0);
          addresses[chain] = await account.getAddress();
        } catch (err) {
          console.error(
            `[AgentWallet] Failed to get address for ${chain}:`,
            err,
          );
        }
      }
      return addresses;
    }

    // Fallback path
    return getFallbackAddresses();
  }

  async getWalletInfo(): Promise<WalletInfo[]> {
    if (!this.initialized) await this.initialize();

    if (this.usingWdk && this.wdk) {
      const wallets: WalletInfo[] = [];
      for (const chain of this.registeredChains) {
        try {
          const chainConfig = WDK_CHAINS[chain];
          const account = await this.wdk.getAccount(chain, 0);
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

    // Fallback: return addresses with zero balance
    const fallbacks = getFallbackAddresses();
    return Object.entries(fallbacks).map(([chain, address]) => ({
      chain: WDK_CHAINS[chain as WDKChain]?.name ?? chain,
      address,
      balance: "0",
      chainId: WDK_CHAINS[chain as WDKChain]?.chainId ?? 0,
    }));
  }

  async getBalance(chain: WDKChain): Promise<string> {
    if (!this.initialized) await this.initialize();

    if (this.usingWdk && this.wdk) {
      const account = await this.wdk.getAccount(chain, 0);
      const balance = await account.getBalance();
      return balance.toString();
    }
    return "0";
  }

  async sendTransaction(
    chain: WDKChain,
    to: string,
    value: bigint,
  ): Promise<TransactionResult> {
    if (!this.usingWdk || !this.wdk) {
      throw new Error("WDK not available — cannot send transactions");
    }

    const chainConfig = WDK_CHAINS[chain];
    const account = await this.wdk.getAccount(chain, 0);
    const result = await account.sendTransaction({ to, value });

    return {
      hash: result.hash,
      chain: chainConfig.name,
      status: "pending",
      explorerUrl: getExplorerUrl(chain as ChainName, result.hash),
    };
  }

  /**
   * Sign a message with the agent's wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!this.initialized) await this.initialize();

    try {
      // 1. Try WDK account signing if available
      if (this.usingWdk && this.wdk) {
        const account = await this.wdk.getAccount("celo", 0);
        if (account.signMessage) {
          return await account.signMessage(message);
        }
      }

      // 2. Fallback: use viem with seed phrase
      if (this.seedPhrase) {
        const { mnemonicToAccount } = require("viem/accounts");
        const account = mnemonicToAccount(this.seedPhrase);
        return await account.signMessage({ message });
      }

      // 3. Last fallback: use AGENT_PRIVATE_KEY
      const pk = process.env.AGENT_PRIVATE_KEY;
      if (pk) {
        const { privateKeyToAccount } = require("viem/accounts");
        const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
        return await account.signMessage({ message });
      }
    } catch (err) {
      console.error("[AgentWallet] Signing failed:", err);
      throw err;
    }

    throw new Error("No way to sign message - WDK signMessage unavailable and no seed phrase / private key");
  }

  getSeedPhrase(): string {
    return this.seedPhrase;
  }

  isWdkAvailable(): boolean {
    return wdkAvailable;
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
    wdkAvailable: wallet.isWdkAvailable(),
  };
}
