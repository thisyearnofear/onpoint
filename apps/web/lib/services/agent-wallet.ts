/**
 * WDK Wallet Service for AI Agent
 *
 * This service enables the AI Stylist agent to operate as an autonomous
 * economic agent with self-custodial wallet capabilities.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";

// Supported chains for the AI Agent
const SUPPORTED_CHAINS = {
  ethereum: {
    name: "Ethereum",
    provider: "https://eth.drpc.org",
    chainId: 1,
  },
  celo: {
    name: "Celo",
    provider: "https://forno.celo.org",
    chainId: 42220,
  },
  base: {
    name: "Base",
    provider: "https://mainnet.base.org",
    chainId: 8453,
  },
  polygon: {
    name: "Polygon",
    provider: "https://polygon.drpc.org",
    chainId: 137,
  },
} as const;

type SupportedChain = keyof typeof SUPPORTED_CHAINS;

interface AgentWalletConfig {
  seedPhrase?: string;
  chains?: Array<keyof typeof SUPPORTED_CHAINS>;
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

/**
 * AgentWalletService - Self-custodial wallet for AI Agent operations
 *
 * This service enables the OnPoint AI Stylist to:
 * 1. Hold and manage funds across multiple chains
 * 2. Receive tips from users (cUSD, USDT, etc.)
 * 3. Execute payments for API usage (CELO for Gemini Live)
 * 4. Mint NFTs on behalf of users (with approval)
 * 5. Interact with DeFi protocols
 */
export class AgentWalletService {
  private wdk: InstanceType<typeof WDK> | null = null;
  private seedPhrase: string;
  private registeredChains: Set<SupportedChain>;
  private initialized = false;

  constructor(config: AgentWalletConfig = {}) {
    this.seedPhrase = config.seedPhrase || this.generateSeedPhrase();
    this.registeredChains = new Set(
      config.chains || ["celo", "base", "ethereum"],
    );
  }

  /**
   * Generate a new seed phrase for the agent wallet
   * In production, this should be derived from a secure source
   */
  private generateSeedPhrase(): string {
    return WDK.getRandomSeedPhrase();
  }

  /**
   * Initialize the WDK with wallet modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[AgentWallet] Initializing WDK...");

    this.wdk = new WDK(this.seedPhrase);

    // Register wallet modules for supported chains
    for (const chain of this.registeredChains) {
      const chainConfig = SUPPORTED_CHAINS[chain];
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

  /**
   * Get wallet addresses for all registered chains
   */
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

  /**
   * Get wallet info including balances for all chains
   */
  async getWalletInfo(): Promise<WalletInfo[]> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const wallets: WalletInfo[] = [];

    for (const chain of this.registeredChains) {
      try {
        const chainConfig = SUPPORTED_CHAINS[chain];
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

  /**
   * Check balance on a specific chain
   */
  async getBalance(chain: SupportedChain): Promise<string> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const account = await this.wdk.getAccount(chain, 0);
    const balance = await account.getBalance();
    return balance.toString();
  }

  /**
   * Send a transaction on a specific chain
   * Used for:
   * - Receiving tips from users
   * - Paying for premium features (Gemini Live access)
   * - Minting NFTs
   */
  async sendTransaction(
    chain: SupportedChain,
    to: string,
    value: bigint,
  ): Promise<TransactionResult> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const chainConfig = SUPPORTED_CHAINS[chain];
    const account = await this.wdk.getAccount(chain, 0);

    const result = await account.sendTransaction({
      to,
      value,
    });

    return {
      hash: result.hash,
      chain: chainConfig.name,
      status: "pending",
      explorerUrl: `${chainConfig.provider.replace(".org", "scan.io")}/tx/${result.hash}`,
    };
  }

  /**
   * Estimate transaction cost
   */
  async estimateTransactionCost(
    chain: SupportedChain,
    to: string,
    value: bigint,
  ): Promise<string> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const account = await this.wdk.getAccount(chain, 0);
    const quote = await account.quoteSendTransaction({ to, value });
    return quote.fee.toString();
  }

  /**
   * Get the agent's seed phrase (for backup/encryption)
   * In production, this should be encrypted and never exposed
   */
  getSeedPhrase(): string {
    return this.seedPhrase;
  }

  /**
   * Get agent wallet addresses for different purposes
   */
  async getAgentAddresses(): Promise<{
    treasury: string; // For receiving payments/tips
    operations: string; // For operational transactions
    nftMinter: string; // For NFT minting
  }> {
    const addresses = await this.getAddresses();
    const celoAddress =
      addresses.celo || addresses.base || Object.values(addresses)[0] || "";

    // In WDK, different indices can derive different addresses
    // For simplicity, we use the same address but could extend
    return {
      treasury: celoAddress,
      operations: celoAddress,
      nftMinter: celoAddress,
    };
  }
}

// Singleton instance for the AI Agent
let agentWalletInstance: AgentWalletService | null = null;

/**
 * Get or create the agent wallet service
 */
export async function getAgentWallet(
  config?: AgentWalletConfig,
): Promise<AgentWalletService> {
  if (!agentWalletInstance) {
    agentWalletInstance = new AgentWalletService(config);
    await agentWalletInstance.initialize();
  }
  return agentWalletInstance;
}

/**
 * Get agent wallet addresses for embedding in AI responses
 */
export async function getAgentWalletInfo() {
  const wallet = await getAgentWallet();
  return {
    addresses: await wallet.getAgentAddresses(),
    walletInfo: await wallet.getWalletInfo(),
  };
}
