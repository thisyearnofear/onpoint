import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { listings } from "./listings";

/**
 * Orders — a customer purchase initiated from a storefront.
 *
 * Minimal PII: only customer_phone is stored. Full addresses / PII
 * require a separate ADR if needed.
 *
 * Agent orders (source "agent") settle on-chain: the buyer pays cUSD to the
 * platform wallet (payment_tx_hash), then the curator's share is paid out to
 * commerce.walletAddress (payout_tx_hash). Both are Celoscan-verifiable.
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
  quantity: integer("quantity").notNull().default(1),
  customerPhone: text("customer_phone"),

  // On-chain settlement (agent orders only)
  amountCusd: text("amount_cusd"),
  buyerAddress: text("buyer_address"),
  paymentTxHash: text("payment_tx_hash").unique(),
  payoutTxHash: text("payout_tx_hash"),

  source: text("source", {
    enum: ["whatsapp_deeplink", "site_buy", "agent"],
  }).notNull(),

  status: text("status", {
    enum: ["pending", "confirmed", "fulfilled", "cancelled"],
  })
    .notNull()
    .default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
