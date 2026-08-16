-- Reconcile migrations that exist in this repository but were not recorded
-- in the historical Drizzle journal. These statements are idempotent so this
-- is safe for databases that already applied any of them.
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
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text DEFAULT 'live' NOT NULL,
  "try_on_count" integer DEFAULT 0 NOT NULL,
  "purchase_count" integer DEFAULT 0 NOT NULL,
  "share_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY ("curator_slug") REFERENCES "curators"("slug") ON DELETE SET NULL,
  FOREIGN KEY ("hero_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL
);--> statement-breakpoint
ALTER TABLE "agent_looks" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_agent" ON "agent_looks" ("agent_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_curator" ON "agent_looks" ("curator_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_status" ON "agent_looks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_looks_tags" ON "agent_looks" USING GIN ("tags");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_address" text NOT NULL,
  "referral_code" text NOT NULL,
  "order_id" uuid NOT NULL,
  "commission_cusd" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
);--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "order_amount_cusd" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "curator_slug" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "payout_tx_hash" text;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_referrals" DROP CONSTRAINT IF EXISTS "agent_referrals_referral_code_unique";--> statement-breakpoint
ALTER TABLE "curators" ADD COLUMN IF NOT EXISTS "linked_agent_address" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_curators_linked_agent" ON "curators" ("linked_agent_address");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" text NOT NULL,
  "tier" text,
  "source" text NOT NULL,
  "curator_slug" text REFERENCES "curators"("slug"),
  "listing_id" uuid REFERENCES "listings"("id"),
  "session_id" text,
  "visitor_hash" text,
  "payer_address" text,
  "cost_usd" text,
  "revenue_usd" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "client_ip" inet,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_funnel_events_session" ON "funnel_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_funnel_events_listing" ON "funnel_events" ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_funnel_events_type" ON "funnel_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_funnel_events_created" ON "funnel_events" ("created_at" DESC);--> statement-breakpoint

-- A nullable value is intentional: legacy inventory must be reverified rather
-- than certified from an unrelated updated_at mutation.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamptz;
