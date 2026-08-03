/**
 * Shared DB connection helper — lazy singleton Neon/Drizzle.
 *
 * Usage:
 *   const { getDb } = require('../lib/db');
 *   const db = getDb();                          // no schema
 *   const db = getDb({ curators, listings });    // with schema
 *
 * Replaces the copy-pasted getDb() in 15+ route files.
 */

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');

let _sql = null;
let _connectionString = null;
let _dbCache = new Map(); // keyed by schema keys

/**
 * Resolve the connection string at call time rather than module load time.
 * This keeps long-lived processes honest when configuration is injected or
 * rotated, and lets tests isolate configured/unconfigured database states.
 */
function getConnectionString() {
  const connectionString = process.env.NEON_DATABASE_URL || null;
  if (connectionString !== _connectionString) {
    _connectionString = connectionString;
    _sql = null;
    _dbCache = new Map();
  }
  return connectionString;
}

/**
 * Get a Drizzle ORM instance backed by Neon serverless.
 * @param {Record<string, unknown>} [schema] — optional schema map for relational queries
 * @returns {import('drizzle-orm/neon-http').NeonHttpDatabase}
 */
function getDb(schema) {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  if (!_sql) {
    _sql = neon(connectionString);
  }
  if (!schema) {
    // No schema → return a bare drizzle instance (cached once)
    if (!_dbCache.has('__bare__')) {
      _dbCache.set('__bare__', drizzle(_sql));
    }
    return _dbCache.get('__bare__');
  }
  // With schema → cache per unique schema key set
  const key = Object.keys(schema).sort().join(',');
  if (!_dbCache.has(key)) {
    _dbCache.set(key, drizzle(_sql, { schema }));
  }
  return _dbCache.get(key);
}

/**
 * Get the raw Neon SQL tagged template function.
 * Use this for routes that use `sql\`SELECT ...\`` syntax
 * instead of Drizzle's query builder.
 * @returns {import('@neondatabase/serverless').NeonQueryFunction}
 */
function getSql() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  if (!_sql) {
    _sql = neon(connectionString);
  }
  return _sql;
}

module.exports = { getDb, getSql, getConnectionString };
