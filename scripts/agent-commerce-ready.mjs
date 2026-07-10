#!/usr/bin/env node
/**
 * Phase 1 ops: print agent-purchasable curator count from the public directory.
 * Usage: node scripts/agent-commerce-ready.mjs [directoryUrl]
 *
 * Works against older APIs (wallet flag only) and newer ones (agentPurchasable + physical counts).
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

  const hasNewFields = all.some(
    (c) => c.agentPurchasable !== undefined || c.physicalListingCount !== undefined,
  );

  const purchasable = all.filter((c) =>
    c.agentPurchasable === true
    || (c.agentPurchasable === undefined
      && c.agentCommerceEnabled
      && (c.physicalListingCount ?? c.liveListingCount ?? 0) > 0
      && (c.digitalListingCount ?? 0) < (c.liveListingCount ?? 0)),
  );

  const walletOnly = all.filter(
    (c) => c.agentCommerceEnabled && !purchasable.includes(c),
  );

  const stockedNoWallet = all.filter(
    (c) =>
      !c.agentCommerceEnabled
      && (c.physicalListingCount
        ?? ((c.liveListingCount || 0) - (c.digitalListingCount || 0))) > 0,
  );

  const agentPurchasableCount =
    data.meta?.agentPurchasableCount ?? purchasable.length;

  console.log(JSON.stringify({
    url,
    apiHasAgentPurchasableFields: hasNewFields,
    note: hasNewFields
      ? undefined
      : 'Deploy apps/api to Hetzner to expose physicalListingCount + agentPurchasable. Until then, stockedNoWallet lists humans who only need a payout wallet.',
    totalCurators: all.length,
    agentPurchasableCount,
    agentCommerceEnabledCount:
      data.meta?.agentCommerceEnabledCount
      ?? all.filter((c) => c.agentCommerceEnabled).length,
    walletOnlyCount: walletOnly.length,
    stockedNoWalletCount: stockedNoWallet.length,
    phase1Target: 5,
    ready: agentPurchasableCount >= 5,
    purchasable: purchasable.map((c) => ({
      slug: c.slug,
      name: c.name,
      physicalListingCount: c.physicalListingCount ?? null,
      liveListingCount: c.liveListingCount,
    })),
    stockedNoWallet: stockedNoWallet.map((c) => ({
      slug: c.slug,
      name: c.name,
      type: c.type,
      liveListingCount: c.liveListingCount,
      digitalListingCount: c.digitalListingCount,
      estimatedPhysical:
        c.physicalListingCount
        ?? Math.max(0, (c.liveListingCount || 0) - (c.digitalListingCount || 0)),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
