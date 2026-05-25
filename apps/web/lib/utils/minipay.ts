/**
 * MiniPay utility functions
 * Provides helpers for MiniPay-specific functionality
 */

/**
 * Check if the current environment is MiniPay
 */
export function isMiniPayEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.ethereum?.isMiniPay === true
  );
}

/**
 * Get the connected MiniPay address
 * Returns null if not in MiniPay or not connected
 */
export async function getMiniPayAddress(): Promise<string | null> {
  if (!isMiniPayEnvironment() || !window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
      params: [],
    });

    if (Array.isArray(accounts) && accounts.length > 0) {
      return accounts[0] as string;
    }

    return null;
  } catch (error) {
    console.error("Failed to get MiniPay address:", error);
    return null;
  }
}

/**
 * Send a transaction via MiniPay
 * MiniPay only supports legacy transactions (no EIP-1559)
 */
export async function sendMiniPayTransaction({
  to,
  value,
  data,
  feeCurrency,
}: {
  to: string;
  value?: string;
  data?: string;
  feeCurrency?: string;
}): Promise<string> {
  if (!isMiniPayEnvironment() || !window.ethereum) {
    throw new Error("Not in MiniPay environment");
  }

  const transaction: Record<string, string> = {
    to,
  };

  if (value) {
    transaction.value = value;
  }

  if (data) {
    transaction.data = data;
  }

  // MiniPay supports feeCurrency for fee abstraction
  if (feeCurrency) {
    transaction.feeCurrency = feeCurrency;
  }

  const hash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [transaction],
  });

  return hash as string;
}

/**
 * USDm token address on Celo mainnet
 * Used for fee abstraction in MiniPay
 */
export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

/**
 * cUSD token address on Celo mainnet
 */
export const CUSD_ADDRESS = "0x765DE8164458C172EE097029dfb482Ff182ad001";

/**
 * USDT token address on Celo mainnet
 */
export const USDT_ADDRESS_CELO = "0x48065d0d464B2E7f5C1c2B2A3778F3fC8116d8F5";
