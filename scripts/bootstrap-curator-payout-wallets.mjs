#!/usr/bin/env node
/**
 * Bootstrap custodial payout wallets for stocked human curators.
 *
 * Usage:
 *   NEON_DATABASE_URL=... node scripts/bootstrap-curator-payout-wallets.mjs
 *   NEON_DATABASE_URL=... node scripts/bootstrap-curator-payout-wallets.mjs wanja mo amara
 *
 * Keys are written to CURATOR_PAYOUT_KEYS_PATH (default: apps/api/.curator-payout-keys.json).
 * Deploy that file to Hetzner with chmod 600 — never commit it.
 */

const API_BASE = (
  process.env.AGENT_API_URL
  || process.env.NEXT_PUBLIC_AGENT_API_URL
  || 'https://api.onpoint.famile.xyz'
).replace(/\/$/, '');

const SERVICE_KEY = process.env.SERVICE_API_KEY || '';

async function main() {
  const slugs = process.argv.slice(2).filter(Boolean);
  const body = slugs.length > 0 ? { slugs } : {};

  if (!SERVICE_KEY) {
    console.error('SERVICE_API_KEY is required for admin batch provision.');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE}/api/admin/curators/provision-custodial-batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-key': SERVICE_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(JSON.stringify({ error: data.error || res.statusText, status: res.status }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));

  const verify = await fetch(`${API_BASE}/api/curator/directory`);
  const directory = await verify.json().catch(() => ({}));
  const count = directory.meta?.agentPurchasableCount ?? '?';
  console.error(`\nagentPurchasableCount: ${count} (target ≥ 5)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
