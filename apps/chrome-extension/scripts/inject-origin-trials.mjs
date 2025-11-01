#!/usr/bin/env node
/**
 * Inject Origin Trial tokens from .env into manifest.json
 * - Reads apps/chrome-extension/.env (if present) and process.env
 * - Collects OT_* token values and writes them under manifest.trial_tokens
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const manifestPath = path.join(rootDir, 'manifest.json');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function collectTokens() {
  const keys = [
    'OT_WRITER_TOKEN',
    'OT_REWRITER_TOKEN',
    'OT_PROOFREADER_TOKEN',
    'OT_PROMPT_TOKEN', // optional for Chrome 131–136
  ];
  const tokens = [];
  for (const k of keys) {
    const v = (process.env[k] || '').trim();
    if (v) tokens.push(v);
  }
  const extra = (process.env.OT_EXTRA_TOKENS || '').trim();
  if (extra) {
    for (const part of extra.split(',')) {
      const t = part.trim();
      if (t) tokens.push(t);
    }
  }
  // de-duplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  return unique;
}

function main() {
  // 1) Load .env (non-fatal if missing)
  loadDotEnv(envPath);

  // 2) Collect tokens
  const tokens = collectTokens();

  // 3) Read manifest
  if (!fs.existsSync(manifestPath)) {
    console.error(`manifest.json not found at ${manifestPath}`);
    process.exit(1);
  }
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (e) {
    console.error('Failed to parse manifest.json:', e.message);
    process.exit(1);
  }

  // 4) Update trial_tokens
  if (!Array.isArray(tokens) || tokens.length === 0) {
    console.log('No Origin Trial tokens found in env; leaving manifest.trial_tokens unchanged.');
  } else {
    manifest.trial_tokens = tokens;
    console.log(`Applied ${tokens.length} Origin Trial token(s) to manifest.trial_tokens.`);
  }

  // 5) Write manifest back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Updated manifest.json');
}

main();