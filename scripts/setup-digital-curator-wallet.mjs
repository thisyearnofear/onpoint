#!/usr/bin/env node
/**
 * Set up wallet + 0xSplits SplitV2 for the digital curator (nia).
 *
 * Nia is an AI curator (type: 'ai') with 8 digital listings. Try-on
 * payments currently go to the platform wallet because no split is set.
 * This script provisions a custodial wallet for nia and deploys a
 * 0xSplits SplitV2 (80% nia / 20% platform) so try-on revenue flows
 * through the split contract — creating real on-chain settlement
 * transactions with attribution tags.
 *
 * Run on the Hetzner server where SERVICE_API_KEY and keys are available:
 *   SERVICE_API_KEY=... node scripts/setup-digital-curator-wallet.mjs
 *
 * Verify after:
 *   curl https://api.onpoint.famile.xyz/api/curator/nia/wallet/status
 */

const API_BASE = (
  process.env.AGENT_API_URL
  || process.env.NEXT_PUBLIC_AGENT_API_URL
  || 'https://api.onpoint.famile.xyz'
).replace(/\/$/, '');

const SERVICE_KEY = process.env.SERVICE_API_KEY || '';
const SLUG = process.argv[2] || 'nia';

async function main() {
  if (!SERVICE_KEY) {
    console.error('SERVICE_API_KEY is required.');
    console.error('Usage: SERVICE_API_KEY=... node scripts/setup-digital-curator-wallet.mjs [slug]');
    process.exit(1);
  }

  console.log(`Setting up wallet + split for digital curator: ${SLUG}\n`);

  // Step 1: Check current status
  const statusRes = await fetch(`${API_BASE}/api/curator/${SLUG}/wallet/status`);
  const status = await statusRes.json().catch(() => ({}));
  console.log('Current status:', JSON.stringify(status, null, 2));

  if (status.walletAddress) {
    console.log('\nWallet already set. Checking split...');
    if (status.splitAddress) {
      console.log('Split already deployed. All set.');
      process.exit(0);
    }
  } else {
    // Step 2: Provision custodial wallet
    console.log('\n--- Provisioning custodial wallet ---');
    const provisionRes = await fetch(
      `${API_BASE}/api/admin/curators/${SLUG}/provision-custodial-wallet`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-service-key': SERVICE_KEY,
        },
        body: JSON.stringify({}),
      },
    );
    const provisionData = await provisionRes.json().catch(() => ({}));
    if (!provisionRes.ok) {
      console.error('Provision failed:', JSON.stringify(provisionData, null, 2));
      process.exit(1);
    }
    console.log('Provisioned:', JSON.stringify(provisionData, null, 2));
  }

  // Step 3: Deploy 0xSplits SplitV2
  console.log('\n--- Deploying 0xSplits SplitV2 ---');
  const splitRes = await fetch(
    `${API_BASE}/api/admin/curators/${SLUG}/setup-split`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-key': SERVICE_KEY,
      },
      body: JSON.stringify({}),
    },
  );
  const splitData = await splitRes.json().catch(() => ({}));
  if (!splitRes.ok) {
    console.error('Split setup failed:', JSON.stringify(splitData, null, 2));
    process.exit(1);
  }
  console.log('Split deployed:', JSON.stringify(splitData, null, 2));

  // Step 4: Verify
  console.log('\n--- Verifying ---');
  const verifyRes = await fetch(`${API_BASE}/api/curator/${SLUG}/wallet/status`);
  const verifyData = await verifyRes.json().catch(() => ({}));
  console.log('Final status:', JSON.stringify(verifyData, null, 2));

  // Step 5: Check directory
  const dirRes = await fetch(`${API_BASE}/api/curator/directory`);
  const dirData = await dirRes.json().catch(() => ({}));
  console.log('\nDirectory meta:', JSON.stringify(dirData.meta, null, 2));

  console.log('\nDone. Digital try-ons for', SLUG, 'now route through the split contract.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
