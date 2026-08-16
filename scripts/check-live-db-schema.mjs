#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error('live-db-schema: NEON_DATABASE_URL is required');
  process.exit(2);
}

const query = `
SELECT json_build_object(
  'migrationTable', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  ),
  'migrationCount', COALESCE((
    SELECT COUNT(*) FROM drizzle.__drizzle_migrations
  ), 0),
  'latestMigration', (
    SELECT json_build_object('hash', hash, 'createdAt', created_at)
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  ),
  'requiredColumns', COALESCE((
    SELECT json_agg(table_name || '.' || column_name ORDER BY table_name, column_name)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'listings' AND column_name = 'last_verified_at')
        OR (table_name = 'orders' AND column_name IN ('payment_method', 'payment_asset', 'refund_status', 'refund_attempts', 'refund_last_error')))
  ), '[]'::json),
  'refundIndex', EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_orders_refund_queue'
  )
);
`;

let raw;
try {
  raw = execFileSync('psql', [url, '-Atqc', query], { encoding: 'utf8' }).trim();
} catch (error) {
  console.error(`live-db-schema: read-only query failed: ${error.message}`);
  process.exit(1);
}

let result;
try {
  result = JSON.parse(raw);
} catch {
  console.error(`live-db-schema: unexpected psql output: ${raw}`);
  process.exit(1);
}

const required = [
  'listings.last_verified_at',
  'orders.payment_method',
  'orders.payment_asset',
  'orders.refund_status',
  'orders.refund_attempts',
  'orders.refund_last_error',
];
const columns = result.requiredColumns || [];
const missing = required.filter((name) => !columns.includes(name));
console.log(JSON.stringify({ ...result, missing }, null, 2));
if (!result.migrationTable || result.migrationCount === 0 || missing.length > 0 || !result.refundIndex) process.exit(1);
