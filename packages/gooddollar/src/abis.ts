/**
 * Minimal ABIs for GoodDollar integration.
 *
 * Per ADR 0009 D5, we deliberately do NOT pull in
 * `@superfluid-finance/sdk-core`. Raw viem writes to CFAv1Forwarder work
 * with these small, well-documented ABIs.
 *
 * Each ABI is the smallest set of functions/methods we actually call.
 * No events are exported yet — they will land when claim.ts and
 * streaming.ts land in Waves 2 and 3 respectively.
 */

// ============================================
// ERC-20 (G$ is ERC-20 with standard surface)
// ============================================

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ============================================
// Superfluid CFAv1Forwarder
// ============================================
//
// The forwarder is a meta-transaction entry point. Calling createFlow on
// it executes the flow on behalf of `msg.sender` (the connected wallet),
// so the user does NOT need to hold Superfluid's own host contract
// permissions. This is the recommended pattern for dapp integrations.
//
// Reference: https://docs.superfluid.finance/developers/constant-flow-agreement-cfa/forwarder

export const SUPERFLUID_CFA_FORWARDER_ABI = [
  {
    name: "createFlow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowrate", type: "int96" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "updateFlow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowrate", type: "int96" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "deleteFlow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getFlowrate",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "flowrate", type: "int96" }],
  },
  {
    name: "getAccountFlowrate",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "flowrate", type: "int96" }],
  },
] as const;

// ============================================
// GoodDollar Identity (UBI claim)
// ============================================
//
// The Identity contract exposes a `claim()` function (no args) that
// distributes the per-identity daily UBI in G$ if the caller is a
// verified GoodDollar member and has not claimed in the last 24h.
//
// `lastClaim(address)` returns the unix timestamp of the user's most
// recent successful claim, or 0 if they have never claimed.
//
// Reference: https://docs.gooddollar.org/for-developers

export const GOODDOLLAR_IDENTITY_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "lastClaim",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "timestamp", type: "uint256" }],
  },
  {
    name: "isWhitelisted",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
