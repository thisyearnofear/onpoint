import { type WalletClient, type SendTransactionParameters, type Address, type Hash } from 'viem';
import { type WalletAdapter } from '@onpoint/shared-types';

export class StandardWalletAdapter implements WalletAdapter {
  constructor(private walletClient: WalletClient) {}

  async getAddress(): Promise<Address> {
    if (this.walletClient.account?.address) {
      return this.walletClient.account.address;
    }
    const [address] = await this.walletClient.getAddresses();
    if (!address) throw new Error('No address available on wallet client');
    return address;
  }

  async sendTransaction(params: SendTransactionParameters): Promise<Hash> {
    return this.walletClient.sendTransaction(params);
  }

  wrapForSdk(): WalletClient {
    return this.walletClient;
  }
}
