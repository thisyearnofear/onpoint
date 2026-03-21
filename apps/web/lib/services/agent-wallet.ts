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
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { celo, celoAlfajores, base, mainnet, polygon } from "viem/chains";

// Supported chains for the AI Agent
const SUPPORTED_CHAINS = {
  ethereum: {
    name: "Ethereum",
    provider: "https://eth.drpc.org",
    chainId: 1,
    viemChain: mainnet,
  },
  celo: {
    name: "Celo",
    provider: "https://forno.celo.org",
    chainId: 42220,
    viemChain: celo,
  },
  base: {
    name: "Base",
    provider: "https://mainnet.base.org",
    chainId: 8453,
    viemChain: base,
  },
  polygon: {
    name: "Polygon",
    provider: "https://polygon.drpc.org",
    chainId: 137,
    viemChain: polygon,
  },
} as const;

// Contract addresses by chain
const CONTRACT_ADDRESSES = {
  celo: {
    cUSD: "0x765DE8164458C172EE097029dfb482Ff182ad001" as Address,
    OnPointNFT: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1" as Address,
  },
  celoAlfajores: {
    cUSD: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as Address,
    OnPointNFT: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1" as Address,
  },
  base: {
    cUSD: null, // No cUSD on Base
    OnPointNFT: null,
  },
  ethereum: {
    cUSD: null,
    OnPointNFT: null,
  },
  polygon: {
    cUSD: null,
    OnPointNFT: null,
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

// ERC-20 Token ABI (minimal)
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// OnPointNFT ABI
const ONPOINT_NFT_ABI = [
  {
    name: "mintWithRoyalty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
      { name: "royaltyRecipient", type: "address" },
      { name: "royaltyBps", type: "uint96" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export interface ERC20Balance {
  token: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

export interface MintNFTParams {
  to: Address;
  metadataUri: string;
  royaltyRecipient: Address;
  royaltyBps?: number; // Default 500 (5%)
}

export interface MintResult {
  hash: string;
  tokenId: string;
  status: "pending" | "confirmed" | "failed";
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

  // ============================================
  // ERC-20 Token Support
  // ============================================

  /**
   * Get ERC-20 token balance for the agent wallet
   */
  async getERC20Balance(
    chain: SupportedChain,
    tokenAddress: Address,
  ): Promise<ERC20Balance> {
    const chainConfig = SUPPORTED_CHAINS[chain];
    const addresses = await this.getAddresses();
    const walletAddress = addresses[chain] as Address;

    if (!walletAddress) throw new Error(`No address for chain ${chain}`);

    const publicClient = createPublicClient({
      chain: chainConfig.viemChain,
      transport: http(chainConfig.provider),
    });

    const [balance, decimals, symbol] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
    ]);

    return {
      token: tokenAddress,
      symbol,
      decimals,
      balance: balance as bigint,
      formattedBalance: formatTokenBalance(balance as bigint, decimals),
    };
  }

  /**
   * Approve a spender to use ERC-20 tokens
   * Note: This requires WDK to support contract calls, which may need
   * additional configuration. For now, this is a placeholder that
   * shows the intended interface.
   */
  async approveToken(
    chain: SupportedChain,
    tokenAddress: Address,
    spender: Address,
    amount: bigint,
  ): Promise<TransactionResult> {
    // For production: implement using WDK's contract interaction method
    // or use viem wallet client with proper WDK integration
    throw new Error(
      "ERC-20 approve not yet implemented with WDK. Use direct viem integration.",
    );
  }

  /**
   * Transfer ERC-20 tokens from agent wallet
   * Note: This requires WDK to support contract calls.
   */
  async transferToken(
    chain: SupportedChain,
    tokenAddress: Address,
    to: Address,
    amount: bigint,
  ): Promise<TransactionResult> {
    // For production: implement using WDK's contract interaction method
    throw new Error(
      "ERC-20 transfer not yet implemented with WDK. Use direct viem integration.",
    );
  }

  /**
   * Get ERC-20 allowance for a spender
   */
  async getAllowance(
    chain: SupportedChain,
    tokenAddress: Address,
    spender: Address,
  ): Promise<bigint> {
    const chainConfig = SUPPORTED_CHAINS[chain];
    const addresses = await this.getAddresses();
    const walletAddress = addresses[chain] as Address;

    const publicClient = createPublicClient({
      chain: chainConfig.viemChain,
      transport: http(chainConfig.provider),
    });

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletAddress, spender],
    });

    return allowance as bigint;
  }

  // ============================================
  // NFT Minting
  // ============================================

  /**
   * Mint an NFT on behalf of a user
   * Uses the OnPointNFT contract with royalty support
   *
   * Note: Full WDK integration for contract calls is complex.
   * For production, use the blockchain-client package with viem.
   * This method shows the intended interface.
   */
  async mintNFT(
    chain: SupportedChain,
    params: MintNFTParams,
  ): Promise<MintResult> {
    if (!this.wdk) throw new Error("Wallet not initialized");

    const chainConfig = SUPPORTED_CHAINS[chain];
    const addresses = await this.getAddresses();
    const minterAddress = addresses[chain] as Address;

    if (!minterAddress) throw new Error(`No address for chain ${chain}`);

    // Get contract address for this chain
    const contractAddresses =
      CONTRACT_ADDRESSES[chain as keyof typeof CONTRACT_ADDRESSES];
    if (!contractAddresses?.OnPointNFT) {
      throw new Error(`NFT contract not deployed on ${chainConfig.name}`);
    }

    // For production: integrate with blockchain-client package
    // which already has mintNFTWithSplit functionality
    throw new Error(
      "NFT minting requires blockchain-client integration. Use @repo/blockchain-client.",
    );
  }

  /**
   * Check if NFT minting is available on this chain
   */
  canMintNFT(chain: SupportedChain): boolean {
    const contractAddresses =
      CONTRACT_ADDRESSES[chain as keyof typeof CONTRACT_ADDRESSES];
    return !!contractAddresses?.OnPointNFT;
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

// ============================================
// Helper Functions
// ============================================

/**
 * Format token balance with proper decimals
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Encode function call data
 */
function encodeFunctionData(params: {
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): `0x${string}` {
  // Simple ABI encoding for common functions
  const { abi, functionName, args } = params;

  // For approve(address,uint256)
  if (functionName === "approve") {
    const [spender, amount] = args as [Address, bigint];
    return `0x095ea7b3${encodeAddress(spender)}${encodeUint256(amount)}`;
  }

  // For transfer(address,uint256)
  if (functionName === "transfer") {
    const [to, amount] = args as [Address, bigint];
    return `0xa9059cbb${encodeAddress(to)}${encodeUint256(amount)}`;
  }

  // For mintWithRoyalty(address,string,address,uint96)
  if (functionName === "mintWithRoyalty") {
    const [to, uri, royaltyRecipient, royaltyBps] = args as [
      Address,
      string,
      Address,
      number,
    ];
    // This is a simplified encoding - full implementation would handle string offset
    const selector = "0xfee20b16";
    const toEncoded = encodeAddress(to);
    const uriLength = BigInt(uri.length).toString(16).padStart(64, "0");
    const uriHex = Buffer.from(uri)
      .toString("hex")
      .padEnd(Math.ceil(uri.length / 32) * 64, "0");
    const recipientEncoded = encodeAddress(royaltyRecipient);
    const bpsEncoded = BigInt(royaltyBps).toString(16).padStart(64, "0");
    return `${selector}${toEncoded}${uriLength}${uriHex}${recipientEncoded}${bpsEncoded}` as `0x${string}`;
  }

  throw new Error(`Unknown function: ${functionName}`);
}

/**
 * Encode address for ABI
 */
function encodeAddress(address: Address): string {
  return address.toLowerCase().replace("0x", "").padStart(64, "0");
}

/**
 * Encode uint256 for ABI
 */
function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

/**
 * Get block explorer URL for a transaction
 */
function getExplorerUrl(chain: SupportedChain, hash: string): string {
  const explorers: Record<string, string> = {
    ethereum: "https://etherscan.io",
    celo: "https://celoscan.io",
    base: "https://basescan.org",
    polygon: "https://polygonscan.com",
  };
  return `${explorers[chain]}/tx/${hash}`;
}
