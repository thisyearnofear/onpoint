/**
 * @repo/gooddollar — cached balance + flow-rate snapshots.
 *
 * Wave 2 implementation. Reads G$ ERC-20 balance and the outgoing
 * Superfluid flow rate for an address, with a 30-second in-memory cache.
 *
 * Per ADR 0009 D8, this helper:
 *   - Caches G$ balance 30 seconds per address (matches AgentStatus panel needs)
 *   - Formats amounts as human-readable "1,000.00 G$" strings for UI consumers
 *   - Does not pull in a CoinGecko dependency — price reads live in apps/web
 */

import {
  type Address,
  type PublicClient,
  type Chain,
  formatEther,
} from "viem";

import { type GBalanceSnapshot } from "./types.js";
import { ERC20_ABI, SUPERFLUID_CFA_FORWARDER_ABI } from "./abis.js";
import {
  getGTokenAddress,
  getSuperfluidCFAForwarderAddress,
} from "./addresses.js";

/** Cache TTL in milliseconds — matches AgentStatus panel refresh cadence. */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  snapshot: GBalanceSnapshot;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Map a viem `Chain` to the string key used by the address tables. */
function chainKey(chain: Chain | undefined): string | null {
  if (!chain) return null;
  if (chain.id === 42220) return "celo";
  if (chain.id === 11155929) return "celoSepolia";
  return chain.name?.toLowerCase() ?? null;
}

/**
 * Cached snapshot of an address's G$ balance + outgoing flow rate.
 *
 * Reads `balanceOf` on the G$ ERC-20 and `getAccountFlowrate` on the
 * Superfluid CFAv1Forwarder. Results are cached for 30 seconds per
 * (address, chain) tuple.
 *
 * @param publicClient  viem PublicClient connected to the target chain
 * @param address       The wallet to snapshot
 * @param chain         Optional chain key override (e.g. "celo"). Defaults
 *                      to the publicClient's chain.
 */
export async function getGBalanceSnapshot(
  publicClient: PublicClient,
  address: Address,
  chain?: string,
): Promise<GBalanceSnapshot> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      "getGBalanceSnapshot: could not resolve chain — pass an explicit chain key (e.g. \"celo\").",
    );
  }

  const token = getGTokenAddress(key);
  const forwarder = getSuperfluidCFAForwarderAddress(key);
  if (!token) {
    throw new Error(
      `getGBalanceSnapshot: G\$ token not deployed on chain "${key}".`,
    );
  }

  const cacheKey = `${key}:${address.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  // outgoingFlowRate is 0n on chains without Superfluid (e.g. testnet).
  const balanceP = publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  }) as Promise<bigint>;

  const flowRateP = forwarder
    ? (publicClient.readContract({
        address: forwarder,
        abi: SUPERFLUID_CFA_FORWARDER_ABI,
        functionName: "getAccountFlowrate",
        args: [token, address],
      }) as Promise<bigint>)
    : Promise.resolve(0n);

  const [balance, outgoingFlowRate] = await Promise.all([balanceP, flowRateP]);

  const snapshot: GBalanceSnapshot = {
    address,
    balance,
    outgoingFlowRate,
    fetchedAt: Date.now(),
  };

  cache.set(cacheKey, {
    snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return snapshot;
}

/**
 * Format a raw 18-decimal G$ amount as a human-readable string with a
 * thousands separator and "G$" suffix. Used by TipModal and AgentStatus
 * when displaying G$ amounts.
 *
 * @example formatGAmount(1000000000000000000n) // "1.00 G$"
 * @example formatGAmount(1234567890000000000n) // "1.23 G$"
 */
export function formatGAmount(amountWei: bigint): string {
  const formatted = formatEther(amountWei);
  // Trim to 2 decimal places, preserving thousands separators.
  const [whole, frac] = formatted.split(".");
  const wholeWithSep = Number(whole).toLocaleString("en-US");
  const fracPart = (frac ?? "").slice(0, 2).padEnd(2, "0");
  return `${wholeWithSep}.${fracPart} G$`;
}
