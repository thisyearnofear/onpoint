CREATE TABLE "curators" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"channels" jsonb DEFAULT '{}' NOT NULL,
	"brand" jsonb DEFAULT '{}' NOT NULL,
	"commerce" jsonb DEFAULT '{}' NOT NULL,
	"verticals" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_skus" (
	"id" text PRIMARY KEY NOT NULL,
	"club" text NOT NULL,
	"season" text NOT NULL,
	"kit_type" text NOT NULL,
	"official_image_key" text,
	"crest_key" text
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curator_slug" text NOT NULL,
	"sku_id" text NOT NULL,
	"sizes" jsonb DEFAULT '[]' NOT NULL,
	"photo_keys" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curator_slug" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"size" text NOT NULL,
	"customer_phone" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curator_slug" text NOT NULL,
	"visitor_hash" text,
	"try_on_image_key" text,
	"polaroid_key" text,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_curator_slug_curators_slug_fk" FOREIGN KEY ("curator_slug") REFERENCES "public"."curators"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_sku_id_kit_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."kit_skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_curator_slug_curators_slug_fk" FOREIGN KEY ("curator_slug") REFERENCES "public"."curators"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_curator_slug_curators_slug_fk" FOREIGN KEY ("curator_slug") REFERENCES "public"."curators"("slug") ON DELETE no action ON UPDATE no action;