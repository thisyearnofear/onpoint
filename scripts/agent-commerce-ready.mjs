#!/usr/bin/env node
/**
 * Phase 1 ops: print agent-purchasable curator count from the public directory.
 * Usage: node scripts/agent-commerce-ready.mjs [directoryUrl]
 */
const url =
  process.argv[2] ||
  process.env.CURATOR_DIRECTORY_URL ||
  'https://api.onpoint.famile.xyz/api/curator/directory';

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Directory failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  const all = data.curators || [];
  const purchasable = all.filter((c) => c.agentPurchasable);
  const walletOnly = all.filter((c) => c.agentCommerceEnabled && !c.agentPurchasable);

  console.log(JSON.stringify({
    url,
    totalCurators: all.length,
    agentPurchasableCount: data.meta?.agentPurchasableCount ?? purchasable.length,
    agentCommerceEnabledCount: data.meta?.agentCommerceEnabledCount ?? all.filter((c) => c.agentCommerceEnabled).length,
    walletOnlyCount: walletOnly.length,
    phase1Target: 5,
    ready: (data.meta?.agentPurchasableCount ?? purchasable.length) >= 5,
    purchasable: purchasable.map((c) => ({
      slug: c.slug,
      name: c.name,
      physicalListingCount: c.physicalListingCount,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
