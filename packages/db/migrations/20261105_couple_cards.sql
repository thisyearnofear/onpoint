CREATE TABLE IF NOT EXISTS couple_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key text NOT NULL,
  card_url text NOT NULL,
  theme text,
  sender_name text,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
