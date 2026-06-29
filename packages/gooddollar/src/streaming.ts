/**
 * @repo/gooddollar — Superfluid streaming helper.
 *
 * Wave 3 stub. The real implementation lands with the integration of
 * Integration 2 (G$ streaming subscriptions) per
 * docs/hackathons/goodbuilders-season-4.md Wave 3.
 *
 * Per ADR 0009 D5, this module MUST:
 *   - Use raw viem writes to CFAv1Forwarder — no @superfluid-finance/sdk-core
 *   - Resolve the forwarder via @repo/gooddollar/addresses
 *   - Lock the rate at stream creation (price-volatility handling per D6)
 *   - Validate ratePerSecond > 0 before submitting
 */

import { type GStreamParams, type GStreamRate, type GFlowDirection } from "./types.js";

/**
 * Open a new G$ stream. Wave 3 implementation will accept a viem
 * `WalletClient` and write createFlow() to the Superfluid forwarder.
 */
export async function createGStream(_params: GStreamParams): Promise<`0x${string}`> {
  throw new Error(
    "createGStream: not implemented (Wave 3 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Update an existing G$ stream's rate. Wave 3.
 */
export async function updateGStream(_params: GStreamParams): Promise<`0x${string}`> {
  throw new Error(
    "updateGStream: not implemented (Wave 3 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Close an existing G$ stream. Wave 3.
 */
export async function deleteGStream(
  _token: `0x${string}`,
  _sender: `0x${string}`,
  _receiver: `0x${string}`,
): Promise<`0x${string}`> {
  throw new Error(
    "deleteGStream: not implemented (Wave 3 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Read the current flow rate between two addresses on a token. Returns
 * 0 when no flow exists. Wave 3 implementation calls
 * CFAv1Forwarder.getFlowrate().
 */
export async function getFlowRate(
  _token: `0x${string}`,
  _sender: `0x${string}`,
  _receiver: `0x${string}`,
): Promise<GStreamRate> {
  throw new Error(
    "getFlowRate: not implemented (Wave 3 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Sum all flows in a given direction for an account. Wave 3.
 *
 * Implementation note: Superfluid's CFA tracks per-(token, sender,
 * receiver) tuples. To get the total outgoing/incoming rate for an
 * account we index the Superfluid subgraph or iterate known receivers.
 * Today this returns 0n in the stub.
 */
export async function getTotalFlowRate(
  _account: `0x${string}`,
  _direction: GFlowDirection,
): Promise<bigint> {
  throw new Error(
    "getTotalFlowRate: not implemented (Wave 3 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}
