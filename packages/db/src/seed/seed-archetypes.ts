/**
 * Seed curator archetypes — loads JSON configs from apps/web/config/curators/
 * into Neon as seed curator profiles.
 *
 * Each JSON file represents a human curator archetype (Sportswear, Streetwear,
 * Ankara, Vintage, Tailor, Luxury) and follows the Curator interface from
 * @onpoint/shared-types.
 *
 * Run against Neon:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-archetypes.ts
 *
 * Or with just the archetype slug:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-archetypes.ts mo
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { curators } from "../schema/curators.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Path to config files (relative to project root) ──────────

const CONFIG_DIR = join(__dirname, "..", "..", "..", "..", "apps", "web", "config", "curators");

// ── Types ────────────────────────────────────────────────────

interface CuratorConfig {
  slug: string;
  name: string;
  type: "human" | "ai";
  verticals: string[];
  channels?: Record<string, string>;
  brand?: {
    colors?: { primary?: string; accent?: string };
    shareCopy?: string;
    location?: { city?: string; landmark?: string };
  };
  commerce?: {
    checkout: "whatsapp" | "shopify" | "stripe";
    checkoutUrl?: string;
    whatsappTemplate?: string;
    revShare?: number;
  };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.error("NEON_DATABASE_URL is required");
    console.error("  NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-archetypes.ts");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema: { curators } });

  // Discover JSON config files
  const files = readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.error(`No JSON config files found in ${CONFIG_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} curator archetype configs:\n`);

  // Load and validate each config
  const configs: CuratorConfig[] = files.map((file) => {
    const path = join(CONFIG_DIR, file);
    const raw = readFileSync(path, "utf-8");
    const config = JSON.parse(raw) as CuratorConfig;

    if (!config.slug || !config.name || !config.verticals?.length) {
      console.error(`  ✗ ${file} — missing required fields (slug, name, verticals)`);
      process.exit(1);
    }

    return config;
  });

  // Filter by slug argument if provided
  const targetSlug = process.argv[2];
  const toSeed = targetSlug
    ? configs.filter((c) => c.slug === targetSlug)
    : configs;

  if (targetSlug && toSeed.length === 0) {
    console.error(`No archetype found with slug "${targetSlug}"`);
    console.log(`Available: ${configs.map((c) => c.slug).join(", ")}`);
    process.exit(1);
  }

  // Insert each curator profile
  let inserted = 0;
  let skipped = 0;

  for (const config of toSeed) {
    console.log(`\n  ${config.slug} — ${config.name}`);
    console.log(`    verticals: ${config.verticals.join(", ")}`);
    console.log(`    brand:     ${JSON.stringify(config.brand?.colors || {})}`);

    try {
      await db
        .insert(curators)
        .values({
          slug: config.slug,
          name: config.name,
          type: config.type,
          verticals: config.verticals,
          channels: config.channels ?? {},
          brand: config.brand ?? {},
          commerce: config.commerce ?? { checkout: "whatsapp" },
        })
        .onConflictDoNothing();

      console.log(`    ✓ seeded`);
      inserted++;
    } catch (err) {
      console.error(`    ✗ ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  console.log(`\nDone. ${inserted} seeded, ${skipped} skipped.`);

  if (inserted > 0 && !targetSlug) {
    console.log(`\nTip: Seed individual profiles:`);
    console.log(`  NEON_DATABASE_URL=... npx tsx packages/db/src/seed/seed-archetypes.ts <slug>`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
