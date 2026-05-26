// Interface for Wallet Adapter pattern
// Enables environment-aware wallet interactions (e.g., MiniPay vs. Standard)

import type { Address, WalletClient, SendTransactionParameters, Hash } from 'viem';

export interface WalletAdapter {
  getAddress(): Promise<Address>;
  sendTransaction(params: SendTransactionParameters): Promise<Hash>;
  /**
   * Returns a WalletClient proxy whose sendTransaction is routed through
   * the adapter (preserving feeCurrency injection for MiniPay, etc.).
   * Use this when passing to SDKs (e.g., 0xSplits) that expect a WalletClient.
   */
  wrapForSdk(): WalletClient;
}

export type WalletAdapterType = 'standard' | 'minipay';
