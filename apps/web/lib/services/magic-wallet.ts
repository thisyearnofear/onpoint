/**
 * Magic embedded wallet — Celo payout address for curators (email / social login).
 * Lazy-loaded; no-op when NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is unset.
 */

import { RPC_URLS } from "@repo/agent-core/chains";

const CELO_CHAIN_ID = 42220;

type MagicInstance = import("magic-sdk").Magic;

let magicPromise: Promise<MagicInstance | null> | null = null;

export function isMagicConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY?.trim());
}

async function getMagic(): Promise<MagicInstance | null> {
  const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY?.trim();
  if (!key) return null;

  if (!magicPromise) {
    magicPromise = (async () => {
      const { Magic } = await import("magic-sdk");
      return new Magic(key, {
        network: {
          rpcUrl: RPC_URLS.celo,
          chainId: CELO_CHAIN_ID,
        },
      });
    })();
  }

  return magicPromise;
}

async function readConnectedAddress(magic: MagicInstance): Promise<string | null> {
  const accounts = (await magic.rpcProvider.request({
    method: "eth_accounts",
  })) as string[] | undefined;

  const address = accounts?.[0];
  return address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address : null;
}

/** Open Magic login UI and return the curator's Celo payout address. */
export async function connectMagicPayoutWallet(): Promise<string> {
  const magic = await getMagic();
  if (!magic) {
    throw new Error(
      "Magic is not configured on this deployment. Use MiniPay or paste your address.",
    );
  }

  const connected = (await magic.wallet.connectWithUI()) as string[] | string | undefined;
  const fromUi = Array.isArray(connected) ? connected[0] : connected;
  const address = fromUi && /^0x[0-9a-fA-F]{40}$/.test(fromUi)
    ? fromUi
    : await readConnectedAddress(magic);

  if (!address) {
    throw new Error("Magic did not return a valid Celo address.");
  }
  return address;
}

/** True when the user already has an active Magic session. */
export async function getMagicPayoutAddressIfLoggedIn(): Promise<string | null> {
  const magic = await getMagic();
  if (!magic) return null;

  const loggedIn = await magic.user.isLoggedIn();
  if (!loggedIn) return null;

  return readConnectedAddress(magic);
}
