/**
 * Standalone migration runner — run against Neon from Hetzner.
 *
 * Usage:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/migrate.ts
 *
 * Or via the package script:
 *   pnpm --filter @repo/db db:migrate
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "./index.js";
import { resolve } from "node:path";

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.error("NEON_DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema });

  // Prefer an explicit path in deployment. Otherwise resolve from the
  // package working directory, which works for both source and bundled CJS.
  const migrationsFolder = process.env.DB_MIGRATIONS_DIR
    ? resolve(process.env.DB_MIGRATIONS_DIR)
    : resolve(process.cwd(), "drizzle");

  console.log(`Running migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
