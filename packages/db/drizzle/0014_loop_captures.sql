CREATE TABLE IF NOT EXISTS loop_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  contact text NOT NULL,
  source text NOT NULL,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
