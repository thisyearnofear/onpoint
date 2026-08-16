-- Make payment rail and refund state explicit for stock-race recovery.
-- Automatic refunds are restricted to platform-custodied cUSD; other rails
-- remain visible for operator/manual reconciliation.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_asset" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_last_error" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_refund_queue"
  ON "orders" ("refund_status", "status")
  WHERE "status" = 'cancelled';
