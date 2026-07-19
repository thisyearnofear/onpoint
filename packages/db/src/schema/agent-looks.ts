import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { listings } from "./listings";

/**
 * Agent Looks — a composition of OnPoint listings into a shareable "look"
 * or "style board" created by an external agent.
 *
 * The agent's value is curation and distribution, not markup. They compose
 * looks from existing inventory, share them, and earn referral commissions
 * when their looks drive try-ons and purchases.
 *
 * The viral loop:
 *   Agent creates look → shares it → someone tries it on → gets a
 *   shareable collage card (face + outfit) → posts to Instagram →
 *   followers discover the look → try on / buy → agent earns.
 */
export const agentLooks = pgTable("agent_looks", {
  id: uuid("id").primaryKey().defaultRandom(),

  // The agent's wallet address — they earn referral commissions
  agentAddress: text("agent_address").notNull(),

  // URL slug for the look page: /look/:slug
  slug: text("slug").notNull().unique(),

  title: text("title").notNull(),
  description: text("description"),

  // Curator slug this look is associated with (for discovery)
  // A look can span multiple curators but is anchored to one for directory purposes
  curatorSlug: text("curator_slug").references(() => curators.slug, {
    onDelete: "set null",
  }),

  // Listing IDs that compose this look (ordered: hero first)
  // Stored as text array — we resolve to full listing objects at query time
  listingIds: text("listing_ids").array().notNull().default([]),

  // Which listing is the "hero" — gets the try-on render
  heroListingId: uuid("hero_listing_id").references(() => listings.id, {
    onDelete: "set null",
  }),

  // Agent's own cover/styling image (R2 key)
  // This is the agent's creative contribution — their styled photo or collage
  coverImageKey: text("cover_image_key"),

  // Tags for discoverability (e.g. ["streetwear", "vintage", "summer"])
  tags: text("tags").array().notNull().default([]),

  // Structured metadata derived from tags or AI classification.
  // Stores { category, occasion, season } for filtering and badges.
  // Populated by the auto-classification endpoint or set manually.
  metadata: jsonb("metadata").notNull().default({}),

  status: text("status", {
    enum: ["live", "paused", "archived"],
  })
    .notNull()
    .default("live"),

  // Analytics (denormalized counts for fast reads)
  tryOnCount: integer("try_on_count").notNull().default(0),
  purchaseCount: integer("purchase_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
