/**
 * Premier League Kit Backbone seed data.
 *
 * 20 clubs × 2024/25 season × {home, away, third} = 60 rows.
 *
 * Run against Neon via:
 *   npx tsx packages/db/src/seed/pl-backbone.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { kitSkus } from "../schema/kit-skus.js";

const CLUBS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Ipswich Town",
  "Leicester City",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Southampton",
  "Tottenham Hotspur",
  "West Ham United",
  "Wolves",
];

const KIT_TYPES = ["home", "away", "third"] as const;
const SEASON = "2024/25";

function slugify(club: string): string {
  return club.toLowerCase().replace(/\s+/g, "-");
}

function buildSeedData() {
  const rows: Array<{
    id: string;
    club: string;
    season: string;
    kitType: "home" | "away" | "third";
    officialImageKey: string | null;
    crestKey: string | null;
  }> = [];

  for (const club of CLUBS) {
    const slug = slugify(club);
    for (const kitType of KIT_TYPES) {
      rows.push({
        id: `${slug}-${SEASON.replace("/", "")}-${kitType}`,
        club,
        season: SEASON,
        kitType,
        officialImageKey: `kits/${slug}-${SEASON.replace("/", "")}-${kitType}.jpg`,
        crestKey: `kits/${slug}-${SEASON.replace("/", "")}/crest.png`,
      });
    }
  }

  return rows;
}

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.error("NEON_DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql);

  const data = buildSeedData();
  console.log(`Seeding ${data.length} kit SKUs...`);

  for (const row of data) {
    await db.insert(kitSkus).values(row).onConflictDoNothing();
  }

  console.log("PL backbone seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
