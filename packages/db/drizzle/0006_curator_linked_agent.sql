ALTER TABLE "curators" ADD COLUMN IF NOT EXISTS "linked_agent_address" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_curators_linked_agent" ON "curators" ("linked_agent_address");--> statement-breakpoint
