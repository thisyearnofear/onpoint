/**
 * Prepare ERC-8004 Registration Transaction
 *
 * This script prepares the transaction data for ERC-8004 registration.
 * You can then sign and send it using your wallet (MetaMask, etc.)
 *
 * Run: node scripts/prepare-erc8004-registration.mjs
 */

import { encodeFunctionData } from "viem";

// ERC-8004 Identity Registry on Celo Mainnet
const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

// Agent URI
const AGENT_URI = "https://beonpoint.netlify.app/.well-known/agent.json";

// Identity Registry ABI (minimal)
const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }]
  }
];

console.log("🚀 ERC-8004 Registration Transaction Data\n");

// Encode the function call
const data = encodeFunctionData({
  abi: IDENTITY_REGISTRY_ABI,
  functionName: "register",
  args: [AGENT_URI],
});

console.log("📋 Transaction Details:");
console.log(`   To: ${IDENTITY_REGISTRY_ADDRESS}`);
console.log(`   Data: ${data}`);
console.log(`   Value: 0 (no ETH needed)`);
console.log(`   Chain: Celo Mainnet (42220)`);
console.log(`   Agent URI: ${AGENT_URI}`);

console.log("\n" + "=".repeat(70));
console.log("📝 Manual Registration Instructions:");
console.log("=".repeat(70));
console.log("");
console.log("1. Open MetaMask or your wallet");
console.log("2. Switch to Celo Mainnet (chain ID 42220)");
console.log("3. Connect wallet: 0x5b33E63440e95289207120B94da78CE22F9D24fB");
console.log("4. Send a transaction with these details:");
console.log("");
console.log(`   To: ${IDENTITY_REGISTRY_ADDRESS}`);
console.log(`   Value: 0`);
console.log(`   Data: ${data}`);
console.log("");
console.log("5. Confirm the transaction");
console.log("6. Wait for confirmation");
console.log("7. Check the transaction on Celoscan");
console.log("");
console.log("=".repeat(70));
console.log("🔗 Useful Links:");
console.log("=".repeat(70));
console.log("");
console.log(`   Celoscan: https://celoscan.io/address/${IDENTITY_REGISTRY_ADDRESS}`);
console.log(`   8004scan: https://8004scan.io/`);
console.log(`   Agent Wallet: https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB`);
console.log("");
console.log("=".repeat(70));
console.log("💡 Alternative: Use Remix IDE");
console.log("=".repeat(70));
console.log("");
console.log("1. Go to https://remix.ethereum.org");
console.log("2. Create a new file with the ABI");
console.log("3. Connect your wallet");
console.log("4. Call register() with the agent URI");
console.log("");
console.log("=".repeat(70));
