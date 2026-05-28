import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { kitSkus } from "./kit-skus";

/**
 * Listings — a Curator's inventory item, referencing a KitSKU.
 *
 * Created when Wanja texts "+ arsenal home M 2500 4" + photo.
 * Photo references are R2 keys (never URLs).
 */
export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),

  curatorSlug: text("curator_slug")
    .notNull()
    .references(() => curators.slug, { onDelete: "cascade" }),

  skuId: text("sku_id")
    .notNull()
    .references(() => kitSkus.id),

  // [{size: "M", stock: 4, price: 2500}]
  sizes: jsonb("sizes").notNull().default("[]"),

  // R2 keys for Curator's own photos (override official kit image)
  photoKeys: text("photo_keys").array().notNull().default([]),

  status: text("status", {
    enum: ["live", "paused", "archived"],
  })
    .notNull()
    .default("live"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
