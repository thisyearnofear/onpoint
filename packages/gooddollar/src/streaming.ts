/**
 * @repo/gooddollar — Superfluid streaming helpers for G$ on Celo.
 *
 * Wave 3 implementation. Opens, updates, and closes continuous G$ money
 * streams via the Superfluid CFAv1Forwarder contract. On Celo, G$ is a
 * native SuperToken — no wrapping/approval step is needed.
 *
 * Per ADR 0009:
 *   - D5: No @superfluid-finance/sdk-core dependency — raw viem writes
 *   - D6: ratePerSecond is locked at creation; USD drift is accepted
 *   - D7: 4-decimal-seconds buffer rule enforced client-side
 *
 * The CFAv1Forwarder is a single contract that batches create/update/delete
 * into one atomic call. It's the canonical entrypoint for programmatic
 * stream management (vs. the per-user CFA host contract).
 */

import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";

import { type GStreamParams, type GStreamRate } from "./types.js";
import { SUPERFLUID_CFA_FORWARDER_ABI } from "./abis.js";
import {
  getGTokenAddress,
  getSuperfluidCFAForwarderAddress,
} from "./addresses.js";

/**
 * Minimum buffer of 4 decimal-seconds of flow rate. Per ADR 0009 D7,
 * streams below this threshold are rejected to prevent dust streams
 * that cost more in gas than they transfer over reasonable durations.
 *
 * 0.0001 G$/s = 100000000000000 wei/s (14 zeros after the 1)
 */
const MIN_FLOW_RATE = 100000000000000n;

/** Empty bytes value for the optional userData field. */
const EMPTY_USER_DATA = "0x" as `0x${string}`;

/**
 * Map a viem `Chain` to the string key used by the address tables.
 */
function chainKey(chain: Chain | undefined): string | null {
  if (!chain) return null;
  if (chain.id === 42220) return "celo";
  if (chain.id === 11155929) return "celoSepolia";
  return chain.name?.toLowerCase() ?? null;
}

/**
 * Validate that a flow rate meets the minimum threshold.
 * Throws if the rate is zero or below MIN_FLOW_RATE.
 */
function assertFlowRate(ratePerSecond: bigint): void {
  if (ratePerSecond <= 0n) {
    throw new Error(
      "createGStream: ratePerSecond must be > 0.",
    );
  }
  if (ratePerSecond < MIN_FLOW_RATE) {
    throw new Error(
      `createGStream: ratePerSecond ${ratePerSecond} is below the minimum threshold of ${MIN_FLOW_RATE} (0.0001 G$/s).`,
    );
  }
}

/**
 * Resolve the token + forwarder addresses for a chain, throwing a clear
 * error if either is missing.
 */
function resolveContracts(key: string): {
  token: Address;
  forwarder: Address;
} {
  const token = getGTokenAddress(key);
  const forwarder = getSuperfluidCFAForwarderAddress(key);
  if (!token) {
    throw new Error(
      `G\$ token not deployed on chain "${key}".`,
    );
  }
  if (!forwarder) {
    throw new Error(
      `Superfluid CFAv1Forwarder not deployed on chain "${key}".`,
    );
  }
  return { token, forwarder };
}

/**
 * Create a new G$ stream from sender → receiver.
 *
 * On Celo, G$ is a native SuperToken, so no approval or wrapping is
 * needed — the CFAv1Forwarder creates the flow directly.
 *
 * @param walletClient  The payer's wallet client (signer)
 * @param publicClient  Public client on the same chain
 * @param params        Stream parameters (sender, receiver, ratePerSecond)
 * @param chain         Optional chain key override (e.g. "celo")
 * @returns             The transaction hash
 */
export async function createGStream(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: Omit<GStreamParams, "token">,
  chain?: string,
): Promise<Hash> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'createGStream: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const { token, forwarder } = resolveContracts(key);
  assertFlowRate(params.ratePerSecond);

  // Simulate first to catch errors early (e.g. existing flow, insufficient balance)
  try {
    await publicClient.simulateContract({
      address: forwarder,
      abi: SUPERFLUID_CFA_FORWARDER_ABI,
      functionName: "createFlow",
      args: [token, params.sender, params.receiver, params.ratePerSecond, params.userData ?? EMPTY_USER_DATA],
      account: params.sender,
    });
  } catch (err) {
    const short = (err as { shortMessage?: string })?.shortMessage;
    throw new Error(
      `createGStream: simulation failed — ${short ?? (err as Error)?.message ?? "unknown error"}`,
    );
  }

  const hash = (await walletClient.writeContract({
    address: forwarder,
    abi: SUPERFLUID_CFA_FORWARDER_ABI,
    functionName: "createFlow",
    args: [token, params.sender, params.receiver, params.ratePerSecond, params.userData ?? EMPTY_USER_DATA],
    account: params.sender,
    chain: publicClient.chain,
  })) as Hash;

  return hash;
}

/**
 * Update an existing G$ stream's flow rate.
 *
 * The stream must already exist between sender → receiver. If the flow
 * rate is set to 0, use deleteGStream instead.
 *
 * @param walletClient  The payer's wallet client (signer)
 * @param publicClient  Public client on the same chain
 * @param params        Stream parameters with the new ratePerSecond
 * @param chain         Optional chain key override
 * @returns             The transaction hash
 */
export async function updateGStream(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: Omit<GStreamParams, "token">,
  chain?: string,
): Promise<Hash> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'updateGStream: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const { token, forwarder } = resolveContracts(key);
  assertFlowRate(params.ratePerSecond);

  try {
    await publicClient.simulateContract({
      address: forwarder,
      abi: SUPERFLUID_CFA_FORWARDER_ABI,
      functionName: "updateFlow",
      args: [token, params.sender, params.receiver, params.ratePerSecond, params.userData ?? EMPTY_USER_DATA],
      account: params.sender,
    });
  } catch (err) {
    const short = (err as { shortMessage?: string })?.shortMessage;
    throw new Error(
      `updateGStream: simulation failed — ${short ?? (err as Error)?.message ?? "unknown error"}`,
    );
  }

  const hash = (await walletClient.writeContract({
    address: forwarder,
    abi: SUPERFLUID_CFA_FORWARDER_ABI,
    functionName: "updateFlow",
    args: [token, params.sender, params.receiver, params.ratePerSecond, params.userData ?? EMPTY_USER_DATA],
    account: params.sender,
    chain: publicClient.chain,
  })) as Hash;

  return hash;
}

/**
 * Delete (close) an existing G$ stream.
 *
 * Stops the flow from sender → receiver. The sender's streamable balance
 * is no longer decremented for this receiver.
 *
 * @param walletClient  The payer's wallet client (signer)
 * @param publicClient  Public client on the same chain
 * @param sender        The stream sender address
 * @param receiver      The stream receiver address
 * @param chain         Optional chain key override
 * @returns             The transaction hash
 */
export async function deleteGStream(
  walletClient: WalletClient,
  publicClient: PublicClient,
  sender: Address,
  receiver: Address,
  chain?: string,
): Promise<Hash> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'deleteGStream: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const { token, forwarder } = resolveContracts(key);

  try {
    await publicClient.simulateContract({
      address: forwarder,
      abi: SUPERFLUID_CFA_FORWARDER_ABI,
      functionName: "deleteFlow",
      args: [token, sender, receiver, EMPTY_USER_DATA],
      account: sender,
    });
  } catch (err) {
    const short = (err as { shortMessage?: string })?.shortMessage;
    throw new Error(
      `deleteGStream: simulation failed — ${short ?? (err as Error)?.message ?? "unknown error"}`,
    );
  }

  const hash = (await walletClient.writeContract({
    address: forwarder,
    abi: SUPERFLUID_CFA_FORWARDER_ABI,
    functionName: "deleteFlow",
    args: [token, sender, receiver, EMPTY_USER_DATA],
    account: sender,
    chain: publicClient.chain,
  })) as Hash;

  return hash;
}

/**
 * Read the current flow rate between two addresses.
 *
 * Returns a GStreamRate with the flow rate (0 if no stream exists)
 * and the current timestamp.
 *
 * @param publicClient  Public client on the target chain
 * @param sender        The stream sender address
 * @param receiver      The stream receiver address
 * @param chain         Optional chain key override
 */
export async function getFlowRate(
  publicClient: PublicClient,
  sender: Address,
  receiver: Address,
  chain?: string,
): Promise<GStreamRate> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'getFlowRate: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const { token, forwarder } = resolveContracts(key);

  const rate = (await publicClient.readContract({
    address: forwarder,
    abi: SUPERFLUID_CFA_FORWARDER_ABI,
    functionName: "getFlowrate",
    args: [token, sender, receiver],
  })) as bigint;

  return {
    token,
    sender,
    receiver,
    ratePerSecond: rate,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}

/**
 * Read the total outgoing flow rate for an account (across all receivers).
 *
 * This is the sum of all outgoing streams. Useful for checking if a user
 * has enough streamable balance to open a new stream.
 *
 * @param publicClient  Public client on the target chain
 * @param account       The account to check
 * @param chain         Optional chain key override
 */
export async function getTotalFlowRate(
  publicClient: PublicClient,
  account: Address,
  chain?: string,
): Promise<bigint> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'getTotalFlowRate: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const { token, forwarder } = resolveContracts(key);

  const rate = (await publicClient.readContract({
    address: forwarder,
    abi: SUPERFLUID_CFA_FORWARDER_ABI,
    functionName: "getAccountFlowrate",
    args: [token, account],
  })) as bigint;

  return rate;
}

/**
 * Convert a monthly G$ amount to a per-second flow rate.
 *
 * Helper for UI consumers: users think in "G$/month" but Superfluid
 * streams are in wei/second.
 *
 * @param monthlyGD  Monthly amount in G$ (human-readable, e.g. 10.5)
 * @returns          Flow rate in wei/second (18 decimals)
 */
export function monthlyToFlowRate(monthlyGD: number): bigint {
  // G$ has 18 decimals on Celo
  // seconds in a month (average): 30 * 24 * 60 * 60 = 2,592,000
  const SECONDS_PER_MONTH = 2592000;
  const monthlyWei = BigInt(Math.round(monthlyGD * 1e18));
  return monthlyWei / BigInt(SECONDS_PER_MONTH);
}

/**
 * Convert a per-second flow rate back to a monthly G$ amount.
 *
 * @param flowRate  Flow rate in wei/second
 * @returns         Monthly amount in G$ (human-readable)
 */
export function flowRateToMonthly(flowRate: bigint): number {
  const SECONDS_PER_MONTH = 2592000;
  const monthlyWei = flowRate * BigInt(SECONDS_PER_MONTH);
  return Number(monthlyWei) / 1e18;
}
