CREATE TABLE IF NOT EXISTS "agent_looks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_address" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "curator_slug" text,
  "listing_ids" text[] DEFAULT '{}' NOT NULL,
  "hero_listing_id" uuid,
  "cover_image_key" text,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "status" text DEFAULT 'live' NOT NULL,
  "try_on_count" integer DEFAULT 0 NOT NULL,
  "purchase_count" integer DEFAULT 0 NOT NULL,
  "share_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY ("curator_slug") REFERENCES "curators"("slug") ON DELETE SET NULL,
  FOREIGN KEY ("hero_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_agent_looks_agent" ON "agent_looks" ("agent_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_curator" ON "agent_looks" ("curator_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_status" ON "agent_looks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_tags" ON "agent_looks" USING GIN ("tags");--> statement-breakpoint

-- Add referral payout tracking columns to agent_referrals
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "order_amount_cusd" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "curator_slug" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "payout_tx_hash" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;--> statement-breakpoint

-- Drop the unique constraint on referral_code (multiple referrals can share a code)
ALTER TABLE "agent_referrals" DROP CONSTRAINT IF EXISTS "agent_referrals_referral_code_unique";--> statement-breakpoint
