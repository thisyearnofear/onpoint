#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const distPath = path.join(root, 'packages/db/dist/index.cjs');
if (!fs.existsSync(distPath)) {
  console.error(`db-runtime: missing ${distPath}; run the @repo/db build first`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const db = require(distPath);
const requiredColumns = [
  'paymentMethod',
  'paymentAsset',
  'refundStatus',
  'refundAttempts',
  'refundLastError',
];
const missing = requiredColumns.filter((name) => !db.orders?.[name]);
if (missing.length > 0) {
  console.error(`db-runtime: orders schema is missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('db-runtime: built @repo/db exposes the current orders schema');
