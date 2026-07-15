import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { listings } from "./listings";

/**
 * Orders — a customer purchase initiated from a storefront.
 *
 * Minimal PII: only customer_phone is stored. Full addresses / PII
 * require a separate ADR if needed.
 *
 * Agent orders (source "agent") settle on-chain: the buyer pays cUSD to
 * the payTo address (either the platform wallet for custodial flow, or a
 * 0xSplits SplitV2 contract for non-custodial flow). The curator's share
 * is either sent as a separate transfer (custodial) or distributed by the
 * Split contract (non-custodial). Both are Celoscan-verifiable.
 *
 * Referrals: when an agent shares a link with their referral code, any
 * resulting order will have referral_code set to track who drove the sale.
 *
 * Fulfillment lifecycle:
 *   confirmed → shipped → delivered → (disputed → resolved)
 *   confirmed → cancelled (stock race or dispute escalation)
 *
 * Escrow: when using 0xSplits, funds are held in the Split contract until
 * `distribute` is called. The curator payout (payoutTxHash) is set when
 * distribution happens, which can be after delivery confirmation.
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

  // M-Pesa settlement (site_buy orders only) — one ledger for all channels.
  // The unique M-Pesa receipt is the fiat twin of payment_tx_hash.
  amountKes: text("amount_kes"),
  mpesaReceipt: text("mpesa_receipt").unique(),

  source: text("source", {
    enum: ["whatsapp_deeplink", "site_buy", "agent"],
  }).notNull(),

  // Referral tracking
  referralCode: text("referral_code"),
  referralPayoutTxHash: text("referral_payout_tx_hash"),

  status: text("status", {
    enum: ["pending", "confirmed", "shipped", "delivered", "disputed", "resolved", "cancelled"],
  })
    .notNull()
    .default("pending"),

  // Fulfillment tracking
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),

  // Dispute handling
  disputeReason: text("dispute_reason"),
  disputeOpenedAt: timestamp("dispute_opened_at", { withTimezone: true }),
  disputeResolution: text("dispute_resolution", {
    enum: ["refund", "partial_refund", "reship", "closed_favor_curator", "closed_favor_buyer"],
  }),
  disputeResolvedAt: timestamp("dispute_resolved_at", { withTimezone: true }),

  // Refund tracking (for stock-race cancellations or dispute resolutions)
  refundTxHash: text("refund_tx_hash"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Agent Referrals — tracks agent earnings from referral commissions.
 *
 * When an agent shares a link with their referral code and someone makes
 * a purchase, the platform pays a commission to the agent. This table
 * tracks the referral relationship and payout status.
 */
export const agentReferrals = pgTable("agent_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentAddress: text("agent_address").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  commissionCusd: text("commission_cusd").notNull(),
  payoutTxHash: text("payout_tx_hash"),
  status: text("status", {
    enum: ["pending", "paid", "failed"],
  })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
