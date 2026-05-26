import { type WalletClient, type SendTransactionParameters, type Address, type Hash } from 'viem';
import { type WalletAdapter } from '@onpoint/shared-types';

// cUSD addresses by chain ID
const CUSD_ADDRESSES: Record<number, Address | undefined> = {
  42220: '0x765DE8164458C172EE097029dfb482Ff182ad001', // Celo Mainnet
  // Celo Sepolia has no deployed cUSD — adapter will throw if feeCurrency is required
};

/**
 * MiniPay wallet adapter — injects feeCurrency for stablecoin gas payment.
 *
 * IMPORTANT: The WalletClient passed to this adapter MUST be created with
 * viem's built-in `celo` chain (from `viem/chains`). That chain object
 * includes Celo's CIP-64 transaction serializer/formatter, which is required
 * for feeCurrency to survive serialization. If you use a custom chain config
 * without the Celo serializer, feeCurrency will be silently stripped and
 * MiniPay transactions will revert.
 */
export class MiniPayAdapter implements WalletAdapter {
  private cUsdAddress: Address;

  /**
   * @param walletClient - The wallet client injected by MiniPay
   * @param chainId - The chain ID to resolve the cUSD address for (defaults to walletClient.chain.id)
   */
  constructor(
    private walletClient: WalletClient,
    chainId?: number,
  ) {
    const resolvedId = chainId ?? walletClient.chain?.id;
    if (!resolvedId) {
      throw new Error('MiniPayAdapter requires a chainId or a walletClient with chain set');
    }
    const addr = CUSD_ADDRESSES[resolvedId];
    if (!addr) {
      throw new Error(
        `MiniPay feeCurrency (cUSD) is not available on chain ${resolvedId}. ` +
        `Supported chains: ${Object.keys(CUSD_ADDRESSES).join(', ')}`,
      );
    }
    this.cUsdAddress = addr;
  }

  async getAddress(): Promise<Address> {
    if (this.walletClient.account?.address) {
      return this.walletClient.account.address;
    }
    const [address] = await this.walletClient.getAddresses();
    if (!address) throw new Error('No address available on wallet client');
    return address;
  }

  async sendTransaction(params: SendTransactionParameters): Promise<Hash> {
    // MiniPay requires feeCurrency for stablecoin gas payment
    const minipayParams = {
      ...params,
      feeCurrency: this.cUsdAddress,
    };
    return this.walletClient.sendTransaction(minipayParams as any);
  }

  wrapForSdk(): WalletClient {
    const adapter = this;
    // Return a proxy that intercepts sendTransaction to inject feeCurrency
    return new Proxy(this.walletClient, {
      get(target, prop, receiver) {
        if (prop === 'sendTransaction') {
          return (params: SendTransactionParameters) => adapter.sendTransaction(params);
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as WalletClient;
  }
}
