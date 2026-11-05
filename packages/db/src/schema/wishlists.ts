import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const wishlists = pgTable("wishlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 'want' = "things I want" · 'see-you-in' = "things I want to see you in"
  kind: text("kind").notNull().default("want"),
  ownerName: text("owner_name"),
  items: jsonb("items").notNull().default([]), // [{listingId, curatorSlug, title, imageUrl}]
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
