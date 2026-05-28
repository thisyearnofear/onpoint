import { pgTable, text } from "drizzle-orm/pg-core";

/**
 * Kit SKUs — shared Premier League backbone reference data.
 *
 * 20 clubs × current season × {home, away, third} = 60 base rows.
 * Official imagery stored as R2 keys, not URLs.
 */
export const kitSkus = pgTable("kit_skus", {
  id: text("id").primaryKey(), // e.g. "arsenal-2425-home"

  club: text("club").notNull(),
  season: text("season").notNull(),
  kitType: text("kit_type", {
    enum: ["home", "away", "third", "goalkeeper"],
  }).notNull(),

  // R2 keys — never URLs
  officialImageKey: text("official_image_key"),
  crestKey: text("crest_key"),
});
