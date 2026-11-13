CREATE TABLE IF NOT EXISTS kv_state (
  namespace text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, id)
);
CREATE INDEX IF NOT EXISTS kv_state_ns_exp ON kv_state (namespace, expires_at);
