import { type WalletClient } from 'viem';
import { type WalletAdapter } from '@onpoint/shared-types';
import { StandardWalletAdapter } from './adapters/standard-adapter.js';
import { MiniPayAdapter } from './adapters/minipay-adapter.js';

// MiniPay is mainnet-only; cUSD is only deployed on Celo mainnet (42220).
const CELO_MAINNET_ID = 42220;

export function createWalletAdapter(walletClient: WalletClient): WalletAdapter {
  // Check for MiniPay injection
  const isMiniPay = typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay;

  if (isMiniPay) {
    const chainId = walletClient.chain?.id;
    if (chainId && chainId !== CELO_MAINNET_ID) {
      // MiniPay only supports Celo mainnet. Fall back to standard adapter
      // instead of throwing — the user may have switched networks in a dapp
      // that supports multiple chains.
      console.warn(
        `MiniPay detected but chain ${chainId} is not Celo mainnet (${CELO_MAINNET_ID}). ` +
        `Using standard adapter (feeCurrency will not be injected).`
      );
      return new StandardWalletAdapter(walletClient);
    }
    return new MiniPayAdapter(walletClient);
  }

  return new StandardWalletAdapter(walletClient);
}
