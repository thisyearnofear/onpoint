-- Card threading: a card made from another card's "make yours" CTA records
-- which card it answers, the way magazines thread reply_to + issue.
ALTER TABLE couple_cards
  ADD COLUMN IF NOT EXISTS reply_to uuid;
