import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Curators — the single primitive for human merchants + AI personas.
 *
 * See ADR 0002: docs/adr/0002-curator-primitive.md
 * Maps to the Curator interface in @onpoint/shared-types.
 */
export const curators = pgTable("curators", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["human", "ai"] }).notNull(),

  // JSON blobs — flexible, matches the optional-heavy Curator interface
  channels: jsonb("channels").notNull().default("{}"),
  brand: jsonb("brand").notNull().default("{}"),
  commerce: jsonb("commerce").notNull().default("{}"),

  // Non-JSON fields for queryable columns
  verticals: text("verticals").array().notNull().default([]),

  // Soft link: an agent wallet that creates looks for this curator's storefront.
  // Not authorization — the agent still uses their own wallet. This is for
  // attribution and discovery: looks created by this agent appear on the
  // curator's storefront page. A curator can also set this to their own
  // wallet to create looks themselves.
  linkedAgentAddress: text("linked_agent_address"),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
