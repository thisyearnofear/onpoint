/**
 * Check Agent Wallet Balance on Celo Mainnet
 * Run: npx ts-node scripts/check-agent-wallet.ts
 */

import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { celo } from "viem/chains";

// Agent wallet address from config
const AGENT_WALLET = "0x5b33E63440e95289207120B94da78CE22F9D24fB";

// Stablecoin addresses on Celo Mainnet
const TOKENS = {
  CELO: null, // Native token
  cUSD: "0x765DE8164458C172EE097029dfb482Ff182ad001",
  USDT: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
};

// Minimal ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
] as const;

async function main() {
  console.log("🔍 Checking Agent Wallet Balance on Celo Mainnet\n");
  console.log(`Wallet Address: ${AGENT_WALLET}\n`);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  // Check CELO balance
  const celoBalance = await publicClient.getBalance({
    address: AGENT_WALLET as `0x${string}`,
  });

  console.log("💰 Native Token Balances:");
  console.log(`   CELO: ${formatEther(celoBalance)} CELO\n`);

  // Check stablecoin balances
  console.log("💵 Stablecoin Balances:");

  for (const [symbol, address] of Object.entries(TOKENS)) {
    if (symbol === "CELO") continue;

    try {
      const balance = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [AGENT_WALLET as `0x${string}`],
      });

      const decimals = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
      });

      console.log(`   ${symbol}: ${formatUnits(balance, decimals)} ${symbol}`);
    } catch (error) {
      console.log(`   ${symbol}: Error reading balance`);
    }
  }

  // Check if wallet has enough for gas (minimum 0.01 CELO recommended)
  const minGas = BigInt("10000000000000000"); // 0.01 CELO
  const hasEnoughGas = celoBalance >= minGas;

  console.log("\n⛽ Gas Status:");
  console.log(`   Minimum recommended: 0.01 CELO`);
  console.log(`   Current balance: ${formatEther(celoBalance)} CELO`);
  console.log(`   Status: ${hasEnoughGas ? "✅ Sufficient" : "⚠️  Low - needs funding"}`);

  // Recommendations
  console.log("\n📋 Recommendations:");
  if (!hasEnoughGas) {
    console.log("   1. Fund wallet with at least 0.1 CELO for ERC-8004 registration");
    console.log("   2. Get CELO from: https://faucet.celo.org/ (testnet) or buy on exchange (mainnet)");
  } else {
    console.log("   ✅ Wallet is funded and ready for ERC-8004 registration");
  }

  console.log("\n🔗 Useful Links:");
  console.log(`   View on Celoscan: https://celoscan.io/address/${AGENT_WALLET}`);
  console.log(`   8004 Registry: https://8004scan.io/`);
}

main().catch(console.error);
