ALTER TABLE "orders" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_cusd" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_tx_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payout_tx_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_tx_hash_unique" UNIQUE("payment_tx_hash");