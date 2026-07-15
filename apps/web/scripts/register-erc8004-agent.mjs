/**
 * Register OnPoint AI Agent on ERC-8004 (Celo Mainnet)
 *
 * This script registers the agent on the ERC-8004 Identity Registry
 * and creates an agent registration file.
 *
 * Run: node scripts/register-erc8004-agent.mjs
 *
 * Prerequisites:
 * - AGENT_PRIVATE_KEY environment variable set
 * - Agent wallet funded with CELO for gas
 */

import { createWalletClient, createPublicClient, http, parseEventLogs, encodeFunctionData } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

console.log("📁 Loading environment from:", envPath);

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
          // Log key names only (never values) for debugging
          if (key.includes('PRIVATE') || key.includes('KEY') || key.includes('SECRET')) {
            console.log(`   🔑 Loaded: ${key} (value hidden)`);
          }
        }
      }
    }
  }
  console.log("   ✅ Environment loaded");
} else {
  console.error("   ❌ .env.local file not found");
}

// ============================================
// Configuration
// ============================================

// ERC-8004 Identity Registry on Celo Mainnet
const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

// Agent wallet private key from environment
// SECURITY: Never log or expose this value
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

// Debug: Check if key exists and its format (without exposing value)
if (PRIVATE_KEY) {
  console.log("\n🔍 Private key validation:");
  console.log(`   Length: ${PRIVATE_KEY.length} characters`);
  console.log(`   Starts with 0x: ${PRIVATE_KEY.startsWith('0x')}`);
  console.log(`   Valid hex: ${/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)}`);
}

if (!PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error("\n❌ Error: AGENT_PRIVATE_KEY not properly configured");
  console.log("\nExpected format: 0x followed by 64 hexadecimal characters");
  console.log(`Current format: ${PRIVATE_KEY ? PRIVATE_KEY.length + ' characters' : 'not set'}`);
  console.log("\nPlease ensure your .env.local has:");
  console.log("AGENT_PRIVATE_KEY=0x<your_64_character_hex_private_key>");
  process.exit(1);
}

// Agent configuration
const AGENT_CONFIG = {
  name: "OnPoint AI Stylist",
  description: "Autonomous AI fashion stylist with spending controls, transparent reasoning, and self-custodial payments. Provides real-time style analysis, personalized recommendations, and autonomous shopping with full user control.",
  image: "https://beonpoint.netlify.app/assets/1Product.png",
  walletAddress: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
  endpoints: [
    {
      type: "a2a",
      url: "https://beonpoint.netlify.app/.well-known/agent.json"
    },
    {
      type: "wallet",
      address: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
      chainId: 42220
    }
  ],
  capabilities: [
    "style_analysis",
    "product_recommendation",
    "autonomous_purchase",
    "nft_minting",
    "spending_controls",
    "transparent_reasoning"
  ],
  supportedTrust: ["reputation", "validation"]
};

// Identity Registry ABI (minimal for registration)
const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }]
  },
  {
    name: "Registered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true }
    ]
  }
];

// ============================================
// Main Registration Flow
// ============================================

async function main() {
  console.log("🚀 OnPoint AI Agent - ERC-8004 Registration\n");

  // 1. Setup account and clients
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`📋 Agent Wallet: ${account.address}`);

  // Use environment RPC URL or fall back to public endpoint
  const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(CELO_RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC_URL),
  });

  // 2. Check wallet balance
  console.log("\n💰 Checking wallet balance...");
  const balance = await publicClient.getBalance({
    address: account.address,
  });

  const celoBalance = Number(balance) / 1e18;
  console.log(`   CELO Balance: ${celoBalance.toFixed(4)} CELO`);

  if (celoBalance < 0.01) {
    console.error("\n❌ Insufficient CELO balance for gas fees");
    console.log("   Please fund your wallet with at least 0.1 CELO");
    process.exit(1);
  }

  // 3. Create agent registration file
  console.log("\n📄 Creating agent registration file...");

  const registrationFile = {
    type: "Agent",
    name: AGENT_CONFIG.name,
    description: AGENT_CONFIG.description,
    image: AGENT_CONFIG.image,
    endpoints: AGENT_CONFIG.endpoints,
    capabilities: AGENT_CONFIG.capabilities,
    supportedTrust: AGENT_CONFIG.supportedTrust,
    registrations: [],
    createdAt: new Date().toISOString()
  };

  // Save registration file locally
  const registrationFilePath = "./agent-registration.json";
  fs.writeFileSync(registrationFilePath, JSON.stringify(registrationFile, null, 2));
  console.log(`   Saved to: ${registrationFilePath}`);

  // 4. Determine agentURI
  // For production, upload to IPFS and use ipfs:// URI
  // For now, we'll use a placeholder that can be updated later
  const agentURI = "https://beonpoint.netlify.app/.well-known/agent.json";

  console.log(`\n🔗 Agent URI: ${agentURI}`);
  console.log("   (Update this to IPFS URI after uploading registration file)");

  // 5. Register on ERC-8004
  console.log("\n⛓️  Registering on ERC-8004 Identity Registry...");
  console.log(`   Registry: ${IDENTITY_REGISTRY_ADDRESS}`);
  console.log(`   Chain: Celo Mainnet (42220)`);

  try {
    // Encode the function call data
    const data = encodeFunctionData({
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [agentURI],
    });

    console.log("   ✅ Function data encoded");

    // Get nonce and gas price
    console.log("\n📤 Preparing transaction...");
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
    });

    const gasPrice = await publicClient.getGasPrice();

    // Estimate gas
    const gas = await publicClient.estimateGas({
      account: account.address,
      to: IDENTITY_REGISTRY_ADDRESS,
      data,
    });

    console.log(`   Nonce: ${nonce}`);
    console.log(`   Gas Price: ${gasPrice}`);
    console.log(`   Gas Limit: ${gas}`);

    // Sign the transaction locally
    console.log("\n🔐 Signing transaction locally...");
    const signedTx = await account.signTransaction({
      to: IDENTITY_REGISTRY_ADDRESS,
      data,
      nonce,
      gasPrice,
      gas,
      chainId: 42220,
      value: 0n,
    });

    console.log("   ✅ Transaction signed");

    // Send the raw signed transaction
    console.log("\n📤 Sending raw transaction...");
    const hash = await publicClient.sendRawTransaction({
      serializedTransaction: signedTx,
    });

    console.log(`   Transaction Hash: ${hash}`);
    console.log(`   View on Celoscan: https://celoscan.io/tx/${hash}`);

    // Wait for transaction receipt
    console.log("\n⏳ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    });

    console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Parse the Registered event to get the agentId
    const logs = parseEventLogs({
      abi: IDENTITY_REGISTRY_ABI,
      logs: receipt.logs,
      eventName: "Registered",
    });

    if (logs.length > 0) {
      const agentId = logs[0].args.agentId;
      console.log("\n🎉 Registration Successful!");
      console.log(`   Agent ID: ${agentId}`);
      console.log(`   Agent URI: ${logs[0].args.agentURI}`);
      console.log(`   Owner: ${logs[0].args.owner}`);

      // Update registration file with on-chain data
      registrationFile.registrations.push({
        agentRegistry: "erc-8004",
        agentId: agentId.toString(),
        chain: "celo",
        chainId: 42220,
        registryAddress: IDENTITY_REGISTRY_ADDRESS,
        transactionHash: hash,
        registeredAt: new Date().toISOString()
      });

      fs.writeFileSync(registrationFilePath, JSON.stringify(registrationFile, null, 2));
      console.log(`\n📄 Updated ${registrationFilePath} with on-chain data`);

      // Summary
      console.log("\n" + "=".repeat(60));
      console.log("✅ ERC-8004 REGISTRATION COMPLETE");
      console.log("=".repeat(60));
      console.log(`\nAgent ID: ${agentId}`);
      console.log(`Wallet: ${account.address}`);
      console.log(`Registry: ${IDENTITY_REGISTRY_ADDRESS}`);
      console.log(`Chain: Celo Mainnet (42220)`);
      console.log(`\n🔗 View your agent:`);
      console.log(`   8004scan: https://8004scan.io/agents/${agentId}`);
      console.log(`   Celoscan: https://celoscan.io/address/${account.address}`);
      console.log(`\n📋 Next Steps:`);
      console.log(`   1. Upload agent-registration.json to IPFS`);
      console.log(`   2. Update agentURI to IPFS URI using setAgentURI()`);
      console.log(`   3. Register on Self Protocol for Self Agent ID`);
      console.log(`   4. Submit for Proof of Ship AI Agent track`);

    } else {
      console.log("\n⚠️  Warning: Could not parse Registered event");
      console.log("   Transaction was successful but agentId not found in logs");
      console.log("   Check the transaction on Celoscan for details");
    }

  } catch (error) {
    console.error("\n❌ Registration failed:", error.message);

    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Solution: Fund your wallet with more CELO");
    } else if (error.message.includes("already registered")) {
      console.log("\n💡 This wallet may already have an agent registered");
      console.log("   Check on 8004scan: https://8004scan.io/");
    }

    process.exit(1);
  }
}

main().catch(console.error);
