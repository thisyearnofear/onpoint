ALTER TABLE "listings" ALTER COLUMN "sku_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "inventory_type" text DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;