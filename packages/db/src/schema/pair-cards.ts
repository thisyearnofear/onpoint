import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

export const pairCards = pgTable("pair_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  // waiting → the sender's half exists; complete → both renders + cardUrl.
  status: text("status").notNull().default("waiting"),
  caption: text("caption"),
  senderName: text("sender_name"),
  recipientName: text("recipient_name"),
  // { kind: 'listing'|'photo', listingId?, curatorSlug?, title, imageUrl }
  garment: jsonb("garment").notNull(),
  senderRenderUrl: text("sender_render_url"),
  recipientRenderUrl: text("recipient_render_url"),
  // Set when the recipient tried on a different garment (the swap).
  recipientGarmentUrl: text("recipient_garment_url"),
  cardR2Key: text("card_r2_key"),
  cardUrl: text("card_url"),
  replyTo: uuid("reply_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
