/**
 * @repo/0g-compute — public surface.
 *
 * 0G Compute Network integration for the 0G Bridge Buildathon.
 * Wave 1 ships the OpenAI-compatible Router client (inference). Wave 2/3
 * will add the Direct SDK for fine-tuning and on-chain model registry.
 *
 * Reference: https://docs.0g.ai/developer-hub/building-on-0g/compute-network
 * ADR: 0006-0g-compute-african-fashion
 */

export * from "./types";
export * from "./models";
export { ZeroGClient, getZeroGClient, _resetZeroGClientForTests } from "./client";
