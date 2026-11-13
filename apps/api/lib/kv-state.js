/**
 * kv-state — Postgres-backed Map for the demo's ephemeral state stores.
 *
 * The intent mailbox, negotiation mailbox, and negotiation sessions were
 * in-memory Maps: every deploy wiped pending settlements and live haggles
 * mid-flight. This wraps a plain Map with write-through persistence —
 * reads stay synchronous and hot, writes upsert asynchronously, and a
 * cold process hydrates once from the table on boot.
 *
 * Env: persists when NEON_DATABASE_URL is set; otherwise pure in-memory
 * (tests + dev unchanged). In-place mutations need an explicit re-`set`
 * to persist — the call sites that mutate records do that.
 */

const TABLE = 'kv_state';
let sql = null;
let sqlErr = null;
function client() {
  if (sql || sqlErr) return sql;
  const url = process.env.NEON_DATABASE_URL;
  if (!url) { sqlErr = 'unconfigured'; return null; }
  try {
    const { neon } = require('@neondatabase/serverless');
    sql = neon(url);
  } catch (e) { sqlErr = e.message; sql = null; }
  return sql;
}

let warned = false;
function warn(op, ns, err) {
  if (warned) return; // once per process — don't spam
  warned = true;
  try {
    require('./logger').warn?.('kv-state write failed; running memory-only until restart', {
      component: 'kv-state', op, namespace: ns, error: String(err?.message ?? err).slice(0, 200),
    });
  } catch { /* logger optional */ }
}

const pendingMigrations = new Map(); // namespace → Promise (schema apply once)
function ensureTable(db) {
  if (pendingMigrations.has('__schema')) return pendingMigrations.get('__schema');
  const p = (async () => {
    await db`CREATE TABLE IF NOT EXISTS kv_state (
      namespace text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (namespace, id)
    )`;
    await db`CREATE INDEX IF NOT EXISTS kv_state_ns_exp ON kv_state (namespace, expires_at)`;
  })().catch((e) => { warn('schema', 'kv_state', e); });
  pendingMigrations.set('__schema', p);
  return p;
}

/**
 * A Map<string, record> that persists to kv_state under `namespace`.
 * `expiresAtOf` extracts an ISO/ms expiry from a record for the column
 * (enables a DB-side sweep later; in-memory sweep stays authoritative).
 */
function persistedMap(namespace, { expiresAtOf } = {}) {
  const map = new Map();
  const db = client();
  let hydrated = !db;

  if (db) {
    ensureTable(db).then(async () => {
      try {
        const rows = await db`SELECT id, data FROM kv_state WHERE namespace = ${namespace}`;
        for (const r of rows) map.set(r.id, r.data);
      } catch (e) { warn('hydrate', namespace, e); }
      hydrated = true;
    });
  }

  const upsert = (id, value) => {
    if (!db) return;
    const expires = expiresAtOf ? expiresAtOf(value) : null;
    ensureTable(db).then(() =>
      db`INSERT INTO kv_state (namespace, id, data, expires_at, updated_at)
         VALUES (${namespace}, ${id}, ${JSON.stringify(value)}::jsonb, ${expires}, now())
         ON CONFLICT (namespace, id) DO UPDATE SET data = EXCLUDED.data,
           expires_at = EXCLUDED.expires_at, updated_at = now()`
    ).catch((e) => warn('upsert', namespace, e));
  };

  const del = (id) => {
    if (!db) return;
    ensureTable(db).then(() =>
      db`DELETE FROM kv_state WHERE namespace = ${namespace} AND id = ${id}`
    ).catch((e) => warn('delete', namespace, e));
  };

  return {
    get size() { return map.size; },
    get(id) { return map.get(id); },
    set(id, value) { map.set(id, value); upsert(id, value); return this; },
    delete(id) { const had = map.delete(id); if (had) del(id); return had; },
    clear() {
      map.clear();
      if (!db) return;
      ensureTable(db).then(() =>
        db`DELETE FROM kv_state WHERE namespace = ${namespace}`
      ).catch((e) => warn('clear', namespace, e));
    },
    values() { return map.values(); },
    entries() { return map.entries(); },
    [Symbol.iterator]() { return map.entries(); },
    has(id) { return map.has(id); },
    hydrated: () => hydrated,
  };
}

module.exports = { persistedMap };
