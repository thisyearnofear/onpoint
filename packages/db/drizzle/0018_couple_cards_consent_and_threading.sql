-- Sender opt-out from the public /cards board + reply threading.
-- Existing cards were published under the old always-public behavior, so they
-- backfill to listed = true. Applied to prod 2026-11-06.
ALTER TABLE couple_cards
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE couple_cards
  ADD COLUMN IF NOT EXISTS reply_to uuid;
