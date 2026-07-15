import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  inet,
} from "drizzle-orm/pg-core";
import { curators } from "./curators";
import { listings } from "./listings";

/**
 * Funnel Events — tracks the try-on → view → purchase journey.
 *
 * Each event captures a step in the conversion funnel so we can measure
 * whether try-ons (which cost ~$0.01-0.03 each) actually drive purchases.
 *
 * Event types:
 *   tryon_start   — user/agent initiated a try-on
 *   tryon_complete — try-on render delivered successfully
 *   tryon_share   — user shared the polaroid (strong intent signal)
 *   listing_view  — user viewed a listing page after try-on
 *   purchase      — user/agent purchased the item
 *
 * The sessionId links events from the same browsing session. The
 * listingId + curatorSlug identify the item. visitorHash is a non-PII
 * fingerprint for anonymous users; payerAddress is set when known.
 *
 * tier: 'free' (web, Venice SD35) or 'paid' (agent, Replicate IDM-VTON)
 * source: 'web' or 'agent'
 */
export const funnelEvents = pgTable("funnel_events", {
  id: uuid("id").primaryKey().defaultRandom(),

  eventType: text("event_type").notNull(),
  tier: text("tier"), // 'free' | 'paid'
  source: text("source").notNull(), // 'web' | 'agent'

  curatorSlug: text("curator_slug").references(() => curators.slug),
  listingId: uuid("listing_id").references(() => listings.id),

  sessionId: text("session_id"),
  visitorHash: text("visitor_hash"),
  payerAddress: text("payer_address"),

  /** Cost incurred by platform for this event (USD) */
  costUsd: text("cost_usd"),
  /** Revenue received from this event (USD) */
  revenueUsd: text("revenue_usd"),

  metadata: jsonb("metadata").notNull().default("{}"),
  clientIp: inet("client_ip"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
