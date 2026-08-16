#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const drizzleDir = path.join(root, 'packages/db/drizzle');
const journalPath = path.join(drizzleDir, 'meta/_journal.json');
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const tags = journal.entries.map((entry) => entry.tag);
const sqlFiles = fs.readdirSync(drizzleDir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => name.slice(0, -4));

const requiredJournal = [
  '0000_clumsy_shadowcat',
  '0001_sparkling_archangel',
  '0002_confused_viper',
  '0003_lonely_mongoose',
  '0004_smart_sinister_six',
  '0008_listing_verification',
  '0009_order_refund_state',
  '0010_legacy_referral_constraint',
];
const reconciledHistory = [
  '0005_agent_looks.sql',
  '0006_curator_linked_agent.sql',
  '0007_funnel_events.sql',
];
const expectedMigrations = {
  '0008_listing_verification.sql': { hash: '7b40c8fb107fdc20e624c31a2e28eee09d12aa1076607b74b3a8fbfe783c5d95', when: 1786378130000 },
  '0009_order_refund_state.sql': { hash: '46ed58456b5d12a7c3bc47da49afe1054d8b4c47084aa4f3358780f6ff344f57', when: 1786380100000 },
  '0010_legacy_referral_constraint.sql': { hash: 'ad63b5ff0f8636e31d50ba821e6f254195185ecce3cb5fd79cbe54854065d167', when: 1786384300000 },
};

function fail(message) {
  console.error(`db-migrations: ${message}`);
  process.exit(1);
}

if (new Set(tags).size !== tags.length) fail('journal contains duplicate migration tags');
if (journal.entries.some((entry, index) => entry.idx !== index)) {
  fail('journal indexes are not contiguous');
}
const missingRequired = requiredJournal.filter((tag) => !tags.includes(tag));
if (missingRequired.length > 0) fail(`required journal entries are missing: ${missingRequired.join(', ')}`);
const missingSql = tags.filter((tag) => !sqlFiles.includes(tag));
if (missingSql.length > 0) fail(`journal entries without SQL files: ${missingSql.join(', ')}`);

for (const filename of reconciledHistory) {
  if (!fs.existsSync(path.join(drizzleDir, filename))) {
    fail(`historical reconciliation file is missing: ${filename}`);
  }
}

for (const [filename, expected] of Object.entries(expectedMigrations)) {
  const actualHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(drizzleDir, filename)))
    .digest('hex');
  if (actualHash !== expected.hash) {
    fail(`${filename} hash mismatch: expected ${expected.hash}, got ${actualHash}`);
  }
  const tag = filename.slice(0, -4);
  const entry = journal.entries.find((candidate) => candidate.tag === tag);
  if (!entry || entry.when !== expected.when) {
    fail(`${filename} journal timestamp mismatch: expected ${expected.when}`);
  }
}

const reconciliation = fs.readFileSync(path.join(drizzleDir, '0008_listing_verification.sql'), 'utf8');
for (const marker of [
  'CREATE TABLE IF NOT EXISTS "agent_looks"',
  'CREATE TABLE IF NOT EXISTS "funnel_events"',
  'ALTER TABLE "curators" ADD COLUMN IF NOT EXISTS "linked_agent_address"',
  'ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "last_verified_at"',
]) {
  if (!reconciliation.includes(marker)) fail(`0008 is missing reconciliation marker: ${marker}`);
}

const legacyConstraintMigration = fs.readFileSync(path.join(drizzleDir, '0010_legacy_referral_constraint.sql'), 'utf8');
if (!legacyConstraintMigration.includes('agent_referrals_referral_code_key')) {
  fail('0010 is missing legacy referral constraint cleanup');
}

const refundMigration = fs.readFileSync(path.join(drizzleDir, '0009_order_refund_state.sql'), 'utf8');
for (const marker of [
  'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method"',
  'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_asset"',
  'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_status"',
  'CREATE INDEX IF NOT EXISTS "idx_orders_refund_queue"',
]) {
  if (!refundMigration.includes(marker)) fail(`0009 is missing refund marker: ${marker}`);
}

console.log('db-migrations: repository chain is consistent');
console.log(`db-migrations: ${reconciledHistory.join(', ')} are intentionally reconciled by 0008_listing_verification`);
