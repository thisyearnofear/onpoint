CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"curator_slug" text,
	"payer_address" text,
	"amount_cusd" text NOT NULL,
	"tx_hash" text NOT NULL,
	"resource" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_kes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mpesa_receipt" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_curator_slug_curators_slug_fk" FOREIGN KEY ("curator_slug") REFERENCES "public"."curators"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_mpesa_receipt_unique" UNIQUE("mpesa_receipt");