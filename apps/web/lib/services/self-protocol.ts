/**
 * Self Protocol — Re-exported from @repo/agent-core/self-protocol
 *
 * This file is a thin re-export wrapper for backwards compatibility.
 * New code should import directly from "@repo/agent-core/self-protocol".
 *
 * The canonical implementation lives in packages/agent-core/src/self-protocol.ts
 * so both the Express API and Next.js web surfaces share one source of truth
 * for the unified agent identity (ERC-8004 + Self Protocol).
 */
export * from "@repo/agent-core/self-protocol";
