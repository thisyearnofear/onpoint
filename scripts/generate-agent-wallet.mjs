/**
 * Generate Agent Wallet
 *
 * Run locally to create a self-custodial agent wallet via WDK.
 * Outputs the seed phrase and derived addresses for all supported chains.
 *
 * Usage: node --experimental-vm-modules scripts/generate-agent-wallet.mjs
 *
 * DO NOT commit the seed phrase. Store it in:
 * - Google Secret Manager (production)
 * - .env.local (local development, gitignored)
 */

import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";

const CHAINS = {
  celo: { name: "Celo", provider: "https://forno.celo.org", chainId: 42220 },
  base: {
    name: "Base",
    provider: "https://mainnet.base.org",
    chainId: 8453,
  },
  ethereum: {
    name: "Ethereum",
    provider: "https://eth.drpc.org",
    chainId: 1,
  },
  polygon: {
    name: "Polygon",
    provider: "https://polygon-rpc.com",
    chainId: 137,
  },
};

async function main() {
  console.log("\n🔑 Generating Agent Wallet via Tether WDK...\n");

  // Generate seed phrase
  const seedPhrase = WDK.getRandomSeedPhrase();
  console.log("Seed Phrase (KEEP SECRET):");
  console.log(`  ${seedPhrase}\n`);

  // Register wallets and derive addresses
  const wdk = new WDK(seedPhrase);
  const addresses = {};

  for (const [chain, config] of Object.entries(CHAINS)) {
    try {
      wdk.registerWallet(chain, WalletManagerEvm, {
        provider: config.provider,
      });
      const account = await wdk.getAccount(chain, 0);
      const address = await account.getAddress();
      addresses[chain] = address;
      console.log(`  ${config.name} (${chainId(config.chainId)}): ${address}`);
    } catch (err) {
      console.log(`  ${config.name}: FAILED - ${err.message}`);
    }
  }

  console.log("\n📋 Environment Variables:\n");
  console.log(`AGENT_SEED_PHRASE="${seedPhrase}"`);
  console.log(
    `AGENT_WALLET_ADDRESS="${addresses.celo || Object.values(addresses)[0] || ""}"`,
  );
  console.log(`AGENT_WALLET_CELO="${addresses.celo || ""}"`);
  console.log(`AGENT_WALLET_BASE="${addresses.base || ""}"`);
  console.log(`AGENT_WALLET_ETH="${addresses.ethereum || ""}"`);
  console.log(`AGENT_WALLET_POLYGON="${addresses.polygon || ""}"`);

  console.log(
    "\n⚠️  Store the seed phrase in Google Secret Manager for production.",
  );
  console.log("   Never commit it to git.\n");

  console.log("Add to .env.local for development:");
  console.log(
    `  AGENT_WALLET_ADDRESS=${addresses.celo || Object.values(addresses)[0] || ""}\n`,
  );

  console.log("Set in Cloud Run:");
  console.log("  gcloud run services update onpoint-web \\");
  console.log("    --region us-central1 \\");
  console.log(
    `    --update-env-vars AGENT_WALLET_ADDRESS=${addresses.celo || Object.values(addresses)[0] || ""}\n`,
  );
}

function chainId(id) {
  return `chain ${id}`;
}

main().catch(console.error);
