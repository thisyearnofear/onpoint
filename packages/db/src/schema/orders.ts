import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { listings } from "./listings";

/**
 * Orders — a customer purchase initiated from a storefront.
 *
 * Minimal PII: only customer_phone is stored. Full addresses / PII
 * require a separate ADR if needed.
 */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),

  curatorSlug: text("curator_slug")
    .notNull()
    .references(() => curators.slug),

  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id),

  size: text("size").notNull(),
  customerPhone: text("customer_phone"),

  source: text("source", {
    enum: ["whatsapp_deeplink", "site_buy"],
  }).notNull(),

  status: text("status", {
    enum: ["pending", "confirmed", "fulfilled", "cancelled"],
  })
    .notNull()
    .default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
