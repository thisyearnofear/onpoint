-- Sender opt-out from the public /cards board. Existing cards were published
-- under the old always-public behavior, so they backfill to listed = true.
ALTER TABLE couple_cards
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true;
