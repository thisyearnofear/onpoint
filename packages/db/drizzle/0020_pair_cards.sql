CREATE TABLE IF NOT EXISTS pair_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'waiting',
  caption text,
  sender_name text,
  recipient_name text,
  garment jsonb NOT NULL,
  sender_render_url text,
  recipient_render_url text,
  recipient_garment_url text,
  card_r2_key text,
  card_url text,
  reply_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
