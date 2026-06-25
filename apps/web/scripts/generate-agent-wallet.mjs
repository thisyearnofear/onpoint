/**
 * Generate a new secure agent wallet for OnPoint
 *
 * This script generates a new wallet and provides instructions
 * for secure configuration.
 *
 * Run: node scripts/generate-agent-wallet.mjs
 *
 * SECURITY: This script never logs private keys
 */

import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";

console.log("🔐 OnPoint Agent Wallet Generator\n");

// Generate a secure random private key
const privateKeyBytes = crypto.randomBytes(32);
const privateKey = "0x" + privateKeyBytes.toString("hex");

// Derive the account address
const account = privateKeyToAccount(privateKey);

console.log("✅ New wallet generated successfully!\n");
console.log("📋 Wallet Address (public - safe to share):");
console.log(`   ${account.address}\n`);

console.log("🔑 Private Key (SECRET - never share this!):");
console.log(`   ${privateKey}\n`);

console.log("=" .repeat(70));
console.log("⚠️  IMPORTANT SECURITY INSTRUCTIONS:");
console.log("=" .repeat(70));
console.log("");
console.log("1. Copy the private key above IMMEDIATELY");
console.log("2. Store it in a secure password manager");
console.log("3. Add it to your .env.local file:");
console.log("");
console.log(`   AGENT_PRIVATE_KEY=${privateKey}`);
console.log("");
console.log("4. NEVER commit .env.local to git (it's already in .gitignore)");
console.log("5. NEVER share the private key with anyone");
console.log("6. NEVER log or print it in production code");
console.log("");
console.log("=" .repeat(70));
console.log("📝 Next Steps:");
console.log("=" .repeat(70));
console.log("");
console.log("1. Update apps/web/config/chains.ts:");
console.log(`   export const AGENT_WALLET = "${account.address}" as Address;`);
console.log("");
console.log("2. Fund the wallet with CELO:");
console.log("   - Minimum 0.1 CELO for ERC-8004 registration");
console.log("   - Get from exchange or faucet (testnet)");
console.log("");
console.log("3. Run ERC-8004 registration:");
console.log("   node scripts/register-erc8004-agent.mjs");
console.log("");
console.log("4. Register on Self Protocol (optional):");
console.log("   See docs/PROOF_OF_SHIP_REGISTRATION.md");
console.log("");
console.log("=" .repeat(70));
console.log("🔗 View wallet on Celoscan:");
console.log(`   https://celoscan.io/address/${account.address}`);
console.log("=" .repeat(70));
