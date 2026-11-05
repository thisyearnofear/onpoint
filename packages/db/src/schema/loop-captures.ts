import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const loopCaptures = pgTable("loop_captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: text("channel").notNull(), // whatsapp | email
  contact: text("contact").notNull(),
  source: text("source").notNull(), // try-invite | couple-card | gift
  ref: text("ref"), // token or card id that produced the opt-in
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
