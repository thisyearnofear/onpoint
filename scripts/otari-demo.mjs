#!/usr/bin/env node
/**
 * otari-demo.mjs — the Devs Wilding demo run, one script.
 *
 * Walks the per-agent metered-key story end to end against the live
 * OnPoint API + the Otari gateway:
 *
 *   1. Otari /models — the open-weight + frontier catalog
 *   2. OnPoint GET /api/agent/ai-usage — workspace spend + budgets
 *   3. OnPoint POST /api/ai/agent (suggest) — aiCost in the response
 *   4. Same call with x-otari-key — meteredBy flips to the caller's
 *      workspace
 *   5. ai-usage again — the spend just moved
 *
 * Env (loaded from apps/api/.env when run with --env-file):
 *   OTARI_API_KEY / OTARI_BASE_URL   workspace key + endpoint
 *   ONPOINT_API_URL                  default https://api.onpoint.famile.xyz
 *   ONPOINT_API_KEY                  x-api-key for /api/ai/* (VENICE_API_KEY)
 *   AGENT_OTARI_KEY                  optional second otk_ key to demo BYO
 *                                    metering; defaults to the workspace key
 */

const OTARI_BASE = (process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1').replace(/\/$/, '');
const OTARI_KEY = process.env.OTARI_API_KEY;
const API = (process.env.ONPOINT_API_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');
const API_KEY = process.env.ONPOINT_API_KEY || process.env.VENICE_API_KEY;
const AGENT_KEY = process.env.AGENT_OTARI_KEY || OTARI_KEY;

if (!OTARI_KEY) {
  console.error('OTARI_API_KEY is not set — run with --env-file=apps/api/.env');
  process.exit(1);
}

const H = (k) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${k}` });

async function step(n, title, fn) {
  console.log(`\n── ${n}. ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
  try {
    await fn();
  } catch (e) {
    console.log(`   (skipped — ${e.message})`);
  }
}

await step(1, 'Otari catalog — open-weight + frontier behind one key', async () => {
  const r = await fetch(`${OTARI_BASE}/models`, { headers: H(OTARI_KEY) });
  const d = await r.json();
  const chat = (d.data || []).filter((m) => m.type === 'chat').length;
  console.log(`   ${(d.data || []).length} models visible, ${chat} chat-capable`);
  console.log(`   e.g. ${(d.data || []).slice(0, 3).map((m) => m.id).join(', ')}`);
});

async function printUsage(key, label) {
  const r = await fetch(`${API}/api/agent/ai-usage`, { headers: { 'x-otari-key': key } });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.success) {
    console.log(`   ${label}: HTTP ${r.status} — ${JSON.stringify(d).slice(0, 160)} (needs the new deploy on ${API})`);
    return;
  }
  console.log(`   ${label}: keySource=${d.keySource}  requests=${d.usage?.totals?.request_count}  cost=$${d.usage?.totals?.cost}`);
  console.log(`   budgets_enforced=${d.budget?.budgets_enforced}  limits=${(d.budget?.limits || []).length}`);
}

await step(2, 'OnPoint ai-usage — workspace spend so far', async () => {
  await printUsage(OTARI_KEY, 'workspace');
});

async function agentSuggest(otariKey, label) {
  const r = await fetch(`${API}/api/ai/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(otariKey ? { 'x-otari-key': otariKey } : {}),
    },
    body: JSON.stringify({ mode: 'suggest', stylePreferences: { styleAesthetics: ['streetwear'], budgetTier: 'mid' } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(d).slice(0, 160)}`);
  console.log(`   ${label}: suggestions=${(d.suggestions || []).length}`);
  console.log(`   aiCost=${JSON.stringify(d.aiCost || null)}`);
  return d;
}

await step(3, 'Agent styling call — workspace-metered', async () => {
  await agentSuggest(null, 'no x-otari-key');
});

await step(4, 'Same call, BYO key — metered to the caller', async () => {
  await agentSuggest(AGENT_KEY, 'x-otari-key set');
});

await step(5, 'ai-usage again — the meter moved', async () => {
  await printUsage(AGENT_KEY, 'agent');
});

console.log('\nDone. The cUSD ledger pays for actions; Otari meters the model calls behind them.');
