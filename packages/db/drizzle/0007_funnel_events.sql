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
