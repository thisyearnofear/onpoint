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

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;

let _sql = null;
let _dbCache = new Map(); // keyed by schema keys

/**
 * Get a Drizzle ORM instance backed by Neon serverless.
 * @param {Record<string, unknown>} [schema] — optional schema map for relational queries
 * @returns {import('drizzle-orm/neon-http').NeonHttpDatabase}
 */
function getDb(schema) {
  if (!CONNECTION_STRING) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  if (!_sql) {
    _sql = neon(CONNECTION_STRING);
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
  if (!CONNECTION_STRING) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  if (!_sql) {
    _sql = neon(CONNECTION_STRING);
  }
  return _sql;
}

module.exports = { getDb, getSql, CONNECTION_STRING };
