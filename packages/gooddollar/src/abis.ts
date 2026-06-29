/**
 * Minimal ABIs for GoodDollar integration.
 *
 * Per ADR 0009 D5, we deliberately do NOT pull in
 * `@superfluid-finance/sdk-core`. Raw viem writes to CFAv1Forwarder work
 * with these small, well-documented ABIs.
 *
 * GoodDollar on Celo uses separate contracts for Identity (whitelist)
 * and UBIScheme (claim). The ABIs are split accordingly.
 */

// ============================================
// ERC-20 (G$ is ERC-20 / ERC-777 with standard surface)
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
// GoodDollar Identity (whitelist + wallet-link)
// ============================================
//
// The Identity contract manages whitelist state. Users are whitelisted
// after passing face verification. Connected (non-root) wallets are NOT
// directly whitelisted — use getWhitelistedRoot to check eligibility.
//
// Reference: https://docs.gooddollar.org/for-developers/core-contracts/identity

export const GOODDOLLAR_IDENTITY_ABI = [
  {
    name: "isWhitelisted",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getWhitelistedRoot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "whitelisted", type: "address" }],
  },
  {
    name: "lastAuthenticated",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "timestamp", type: "uint256" }],
  },
  {
    name: "authenticationPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "period", type: "uint256" }],
  },
] as const;

// ============================================
// GoodDollar UBIScheme (daily claim)
// ============================================
//
// The UBIScheme contract handles UBI distribution. claim() distributes
// the daily UBI to whitelisted users. checkEntitlement() returns the
// claimable amount (0 if not eligible or already claimed).
//
// This is SEPARATE from the Identity contract.
// Reference: https://docs.gooddollar.org/for-developers/core-contracts

export const GOODDOLLAR_UBISCHEME_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "checkEntitlement",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

// ============================================
// GoodDollar Faucet (gas sponsorship)
// ============================================

export const GOODDOLLAR_FAUCET_ABI = [
  {
    name: "topWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    name: "minTopping",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "toppingAmount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
