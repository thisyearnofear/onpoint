ALTER TABLE magazines
  ADD COLUMN IF NOT EXISTS issue integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reply_to uuid,
  ADD COLUMN IF NOT EXISTS hero_listing_id text;
