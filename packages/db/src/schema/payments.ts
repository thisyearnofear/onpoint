import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";

/**
 * Payments — x402 pay-per-call API revenue (non-order payments).
 *
 * One row per verified on-chain payment for a metered capability
 * (e.g. agent try-on). The unique tx_hash doubles as the replay guard:
 * a payment transaction can only ever unlock one API call.
 *
 * Order payments live on the orders table (payment_tx_hash); together the
 * two tables are the complete revenue ledger — every cent reconciles to a
 * Celoscan-verifiable transaction or an M-Pesa receipt.
 */
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** What the payment unlocked, e.g. "try_on" */
  purpose: text("purpose").notNull(),

  /** Curator whose catalog/asset was used (earns a share via their Split) */
  curatorSlug: text("curator_slug").references(() => curators.slug),

  payerAddress: text("payer_address"),
  amountCusd: text("amount_cusd").notNull(),
  txHash: text("tx_hash").notNull().unique(),

  /** Resource path that was unlocked, e.g. "/api/agent/try-on" */
  resource: text("resource"),

  metadata: jsonb("metadata").notNull().default("{}"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
