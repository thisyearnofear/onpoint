-- Legacy databases created the referral-code uniqueness constraint with a
-- generated `_key` name. Referral codes are intentionally reusable, so remove
-- that constraint/index when present; fresh databases have nothing to remove.
ALTER TABLE "agent_referrals" DROP CONSTRAINT IF EXISTS "agent_referrals_referral_code_key";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_referrals_referral_code_key";
