import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const magazines = pgTable("magazines", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoUrl: text("photo_url"),
  recipientName: text("recipient_name"),
  senderName: text("sender_name"),
  note: text("note"),
  items: jsonb("items").notNull().default([]), // [{listingId, curatorSlug, title, imageUrl}]
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
