/**
 * g-stream-service — thin wrapper around @repo/gooddollar streaming helpers
 * for the web app. Adapts the raw-viem functions to wagmi-provided clients.
 */

import { type Address, type PublicClient, type WalletClient } from "viem";
import {
  createGStream,
  updateGStream,
  deleteGStream,
  getFlowRate,
  getTotalFlowRate,
  monthlyToFlowRate,
  flowRateToMonthly,
  formatGAmount,
} from "@repo/gooddollar";

export { formatGAmount, monthlyToFlowRate, flowRateToMonthly };

/**
 * Open a new G$ stream from the connected wallet to a curator.
 *
 * @param publicClient  Wagmi public client
 * @param walletClient  Wagmi wallet client (signer)
 * @param sender        The subscriber's wallet address
 * @param receiver      The curator's wallet address
 * @param monthlyGD     Monthly amount in G$ (human-readable, e.g. 10.5)
 * @returns             Transaction hash
 */
export async function openStream(
  publicClient: PublicClient | undefined,
  walletClient: WalletClient | undefined,
  sender: Address,
  receiver: Address,
  monthlyGD: number,
): Promise<`0x${string}` | null> {
  if (!publicClient || !walletClient) return null;
  const ratePerSecond = monthlyToFlowRate(monthlyGD);
  return createGStream(walletClient, publicClient, {
    sender,
    receiver,
    ratePerSecond,
  });
}

/**
 * Update an existing G$ stream's monthly amount.
 */
export async function updateStream(
  publicClient: PublicClient | undefined,
  walletClient: WalletClient | undefined,
  sender: Address,
  receiver: Address,
  monthlyGD: number,
): Promise<`0x${string}` | null> {
  if (!publicClient || !walletClient) return null;
  const ratePerSecond = monthlyToFlowRate(monthlyGD);
  return updateGStream(walletClient, publicClient, {
    sender,
    receiver,
    ratePerSecond,
  });
}

/**
 * Close (delete) an existing G$ stream.
 */
export async function closeStream(
  publicClient: PublicClient | undefined,
  walletClient: WalletClient | undefined,
  sender: Address,
  receiver: Address,
): Promise<`0x${string}` | null> {
  if (!publicClient || !walletClient) return null;
  return deleteGStream(walletClient, publicClient, sender, receiver);
}

/**
 * Read the current flow rate between sender and receiver.
 * Returns the monthly G$ equivalent (human-readable) or 0 if no stream.
 */
export async function getStreamMonthly(
  publicClient: PublicClient | undefined,
  sender: Address,
  receiver: Address,
): Promise<number> {
  if (!publicClient) return 0;
  try {
    const rate = await getFlowRate(publicClient, sender, receiver);
    return flowRateToMonthly(rate.ratePerSecond);
  } catch {
    return 0;
  }
}

/**
 * Read the total outgoing flow rate for an account.
 * Returns the monthly G$ equivalent (human-readable).
 */
export async function getTotalOutgoingMonthly(
  publicClient: PublicClient | undefined,
  account: Address,
): Promise<number> {
  if (!publicClient) return 0;
  try {
    const total = await getTotalFlowRate(publicClient, account);
    return flowRateToMonthly(total);
  } catch {
    return 0;
  }
}
