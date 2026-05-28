import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";

/**
 * Sessions — a customer try-on session on a Curator's storefront.
 *
 * visitor_hash for analytics (no PII).
 * Polaroid and try-on images reference R2 keys.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  curatorSlug: text("curator_slug")
    .notNull()
    .references(() => curators.slug),

  visitorHash: text("visitor_hash"),
  tryOnImageKey: text("try_on_image_key"),
  polaroidKey: text("polaroid_key"),

  shared: boolean("shared").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
