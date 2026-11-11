#!/usr/bin/env node
/**
 * otari-agent-keys.mjs — per-agent Otari key ops for OnPoint.
 *
 * OnPoint's agent-commerce thesis applied to AI spend: every agent
 * gets its own Otari (Mozilla AI) key, budget-capped and metered in
 * the Otari Activity view. The agent sends it as `x-otari-key` on
 * OnPoint agent routes and reads its own spend back via
 * GET /api/agent/ai-usage.
 *
 * Usage:
 *   node scripts/otari-agent-keys.mjs provision --agent=0xABC --budget=5 [--days=30]
 *   node scripts/otari-agent-keys.mjs usage [--key=otk_…] [--days=30]
 *   node scripts/otari-agent-keys.mjs budget [--key=otk_…]
 *   node scripts/otari-agent-keys.mjs models
 *
 * Env:
 *   OTARI_BASE_URL   default https://api.otari.ai/api/v1
 *   OTARI_API_KEY    workspace key — used for `usage`/`budget` when
 *                    --key is not given
 *   OTARI_ADMIN_KEY  master key — required for `provision` (hosted
 *                    otari.ai: mint keys in the dashboard instead)
 *
 * The provisioned raw key prints ONCE — store it before exiting.
 */

const BASE_URL = (process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1').replace(/\/$/, '');
const WORKSPACE_KEY = process.env.OTARI_API_KEY;
const ADMIN_KEY = process.env.OTARI_ADMIN_KEY;

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

async function call(key, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) die(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

async function provision() {
  if (!ADMIN_KEY) {
    die(
      'OTARI_ADMIN_KEY is not set. Key/budget provisioning needs the deployment master key. ' +
        'On hosted otari.ai, mint per-agent keys in the dashboard instead — ' +
        'usage/budget readback works with any otk_ key.',
    );
  }
  const agent = arg('agent') ?? die('provision requires --agent=<id> (agent address or name)');
  const budgetUsd = Number(arg('budget', '5'));
  const days = Number(arg('days', '30'));
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) die('--budget must be a positive USD number');

  const key = await call(ADMIN_KEY, 'POST', '/keys', {
    user_id: agent,
    label: `onpoint-agent:${agent}`,
  });
  const budget = await call(ADMIN_KEY, 'POST', '/budgets', {
    max_budget: budgetUsd,
    duration_seconds: days * 86400,
    label: `onpoint-agent:${agent}`,
  });
  const scoped = await call(ADMIN_KEY, 'POST', '/scoped-budgets', {
    scope_type: 'api_token',
    scope_id: key.id,
    budget_id: budget.id,
  });

  console.log(
    JSON.stringify(
      {
        agent,
        keyId: key.id,
        apiKey: key.key,
        budgetId: budget.id,
        scopedBudgetId: scoped.id,
        maxBudgetUsd: budgetUsd,
        durationDays: days,
        usage:
          'Send this key as x-otari-key on OnPoint agent calls; ' +
          'read spend via GET /api/agent/ai-usage or `usage --key=<key>`.',
        note: 'The apiKey is shown once — store it now.',
      },
      null,
      2,
    ),
  );
}

function resolveKey() {
  const key = arg('key') || WORKSPACE_KEY;
  if (!key) die('no key: pass --key=otk_… or set OTARI_API_KEY');
  return key;
}

async function usage() {
  const days = Number(arg('days', '30'));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const qs = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    bucket: 'day',
  });
  const data = await call(resolveKey(), 'GET', `/key/usage/summary?${qs}`);
  console.log(JSON.stringify(data, null, 2));
}

async function budget() {
  const data = await call(resolveKey(), 'GET', '/key/budget');
  console.log(JSON.stringify(data, null, 2));
}

async function models() {
  const data = await call(resolveKey(), 'GET', '/models');
  const list = Array.isArray(data.data) ? data.data : [];
  for (const m of list) {
    const mods = m.architecture || {};
    console.log(
      `${m.id}\t${m.type || '?'}\tin=${(mods.input_modalities || []).join('+')}\tout=${(mods.output_modalities || []).join('+')}`,
    );
  }
}

const cmd = process.argv[2];
switch (cmd) {
  case 'provision':
    await provision();
    break;
  case 'usage':
    await usage();
    break;
  case 'budget':
    await budget();
    break;
  case 'models':
    await models();
    break;
  default:
    console.log(
      'usage: otari-agent-keys.mjs <provision|usage|budget|models>\n' +
        '  provision --agent=<id> --budget=<usd> [--days=30]  (needs OTARI_ADMIN_KEY)\n' +
        '  usage [--key=otk_…] [--days=30]\n' +
        '  budget [--key=otk_…]\n' +
        '  models',
    );
    process.exit(cmd ? 1 : 0);
}
