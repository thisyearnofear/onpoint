/**
 * @repo/gooddollar — cached balance + flow-rate snapshots.
 *
 * Wave 2 stub. The real implementation lands with Integration 1
 * (G$ tip jar) per docs/hackathons/goodbuilders-season-4.md Wave 4.
 *
 * Per ADR 0009 D8, this helper MUST:
 *   - Cache G$ balance 30 seconds per address (matches AgentStatus panel needs)
 *   - Format amounts as human-readable "1,000 G$" strings for UI consumers
 *   - Not pull in a CoinGecko dependency — price reads live in apps/web
 */

import { type GBalanceSnapshot } from "./types.js";

/**
 * Cached snapshot of a user's G$ balance + outgoing flow rate. Wave 4.
 */
export async function getGBalanceSnapshot(
  _address: `0x${string}`,
): Promise<GBalanceSnapshot> {
  throw new Error(
    "getGBalanceSnapshot: not implemented (Wave 4 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Format a raw 18-decimal G$ amount as a human-readable string with
 * thousands separators. Used by TipModal and AgentStatus when
 * displaying G$ amounts. Implementation lands with Wave 4 alongside
 * getGBalanceSnapshot.
 *
 * @example formatGAmount(1000000000000000000n) // "1.00 G$"
 */
export function formatGAmount(_amountWei: bigint): string {
  throw new Error(
    "formatGAmount: not implemented (Wave 4 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}
