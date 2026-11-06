import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const coupleCards = pgTable("couple_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  r2Key: text("r2_key").notNull(),
  cardUrl: text("card_url").notNull(),
  theme: text("theme"),
  senderName: text("sender_name"),
  // [{ listingId, curatorSlug, title, imageUrl }] — the strip under the hero
  items: jsonb("items").notNull().default([]),
  // Sender opt-out from the public /cards board; the card always resolves by link.
  listed: boolean("listed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
