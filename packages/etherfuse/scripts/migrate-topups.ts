#!/usr/bin/env tsx
/**
 * Credit Migration CLI — replay past top-up credits into the Redis store.
 *
 * Use when bootstrapping a new Redis instance (e.g. switching from in-memory
 * to persistent storage in production) or recovering from data loss.
 *
 * Usage:
 *   # Import credits from a JSON file (array of TopUpCredit)
 *   pnpm migrate --import ./credits.json
 *
 *   # Sync completed orders from Etherfuse API (requires ETHERFUSE_API_KEY)
 *   ETHERFUSE_API_KEY=efk_... pnpm migrate --sync
 *
 *   # Dry-run: preview what would be written
 *   pnpm migrate --import ./credits.json --dry-run
 *
 *   # Pipe from stdin
 *   cat credits.json | pnpm migrate --import -
 *
 * Input format (--import):
 *   JSON array of TopUpCredit objects:
 *   [
 *     {
 *       "userAddress": "0x1234...",
 *       "orderId": "ord_...",
 *       "fiat": "MXN",
 *       "fiatAmount": "100.00",
 *       "cryptoAsset": "USDC",
 *       "cryptoAmount": "5000000",
 *       "chain": "base",
 *       "transactionHash": "0x...",
 *       "creditedAt": "2026-06-01T00:00:00Z"
 *     }
 *   ]
 *
 * Environment:
 *   REDIS_URL            — Redis connection (default: redis://localhost:6379)
 *   ETHERFUSE_API_KEY    — Required for --sync mode
 *   ETHERFUSE_ENV        — "sandbox" (default) or "production"
 *   ETHERFUSE_BASE_URL   — Optional override
 */

import { readFileSync } from "fs";
import type { Redis } from "ioredis";

// ── Types (inline to keep the script self-contained) ─────────────────

interface TopUpCredit {
  userAddress: `0x${string}`;
  orderId: string;
  fiat: string;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  chain: string;
  transactionHash?: string;
  creditedAt: string;
}

interface MigrateResult {
  mode: "import" | "sync";
  totalFound: number;
  skipped: number;
  written: number;
  dryRun: boolean;
  elapsedMs: number;
}

// ── Help ─────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
Usage:
  pnpm migrate --import <file>   Import credits from a JSON file
  pnpm migrate --sync            Sync completed orders from Etherfuse API
  pnpm migrate --help            Show this message

Options:
  --file <path>    JSON file path (use "-" for stdin)
  --dry-run        Preview without writing to Redis
  --verbose        Show each credit as it's processed

Environment:
  REDIS_URL        Redis connection string (default: redis://localhost:6379)
  ETHERFUSE_API_KEY  Required for --sync mode
  ETHERFUSE_ENV    sandbox (default) or production
`.trim());
}

// ── Redis helpers ────────────────────────────────────────────────────

const REDIS_KEY_PREFIX = "etherfuse:topups:";

function userKey(address: string): string {
  return `${REDIS_KEY_PREFIX}${address.toLowerCase()}`;
}

async function writeCredit(
  redis: Redis,
  credit: TopUpCredit,
  dryRun: boolean,
): Promise<void> {
  const key = userKey(credit.userAddress);
  const value = JSON.stringify(credit);
  if (dryRun) return;
  await redis.lpush(key, value);
}

async function countExisting(
  redis: Redis,
  credit: TopUpCredit,
): Promise<boolean> {
  const key = userKey(credit.userAddress);
  const raw = await redis.lrange(key, 0, -1);
  return raw.some((s) => {
    try {
      const parsed = JSON.parse(s) as TopUpCredit;
      return parsed.orderId === credit.orderId;
    } catch {
      return false;
    }
  });
}

// ── Import mode ──────────────────────────────────────────────────────

async function importCredits(
  redis: Redis,
  filePath: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<MigrateResult> {
  const start = Date.now();
  let raw: string;

  if (filePath === "-") {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString("utf-8");
  } else {
    raw = readFileSync(filePath, "utf-8");
  }

  const credits: TopUpCredit[] = JSON.parse(raw);
  let written = 0;
  let skipped = 0;

  for (const credit of credits) {
    if (await countExisting(redis, credit)) {
      skipped++;
      if (verbose) console.log(`  SKIP  ${credit.orderId} (already exists)`);
      continue;
    }
    await writeCredit(redis, credit, dryRun);
    written++;
    if (verbose) {
      console.log(
        `  ${dryRun ? "WOULD" : "WRITE"} ${credit.orderId} → ${credit.userAddress} (${credit.cryptoAmount} ${credit.cryptoAsset})`,
      );
    }
  }

  return {
    mode: "import",
    totalFound: credits.length,
    skipped,
    written,
    dryRun,
    elapsedMs: Date.now() - start,
  };
}

// ── Sync mode ────────────────────────────────────────────────────────

async function syncFromEtherfuse(
  redis: Redis,
  dryRun: boolean,
  verbose: boolean,
): Promise<MigrateResult> {
  const start = Date.now();
  const apiKey = process.env.ETHERFUSE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ETHERFUSE_API_KEY is required for --sync mode. Set it in the environment.",
    );
  }

  const environment =
    process.env.ETHERFUSE_ENV === "production" ? "production" : "sandbox";
  const baseUrl =
    process.env.ETHERFUSE_BASE_URL ??
    (environment === "production"
      ? "https://api.etherfuse.com"
      : "https://api.sand.etherfuse.com");

  if (verbose) console.log(`  Etherfuse environment: ${environment}`);

  let totalFound = 0;
  let written = 0;
  let skipped = 0;
  let pageNumber = 0;
  let totalPages = 1;

  while (pageNumber < totalPages) {
    if (verbose) console.log(`  Fetching page ${pageNumber + 1}...`);

    const res = await fetch(`${baseUrl}/ramp/order/lookup`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        status: "completed",
        pageSize: 100,
        pageNumber,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Etherfuse API error (${res.status}): ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      items: Array<{
        orderId: string;
        status: string;
        type?: string;
        recipientAddress?: string;
        sourceAsset?: string;
        targetAsset?: string;
        sourceAmount?: string;
        targetAmount?: string;
        chain?: string;
        transactionHash?: string;
        updatedAt?: string;
        createdAt?: string;
      }>;
      totalCount: number;
      pageNumber: number;
      pageSize: number;
      totalPages: number;
    };

    totalPages = data.totalPages;
    totalFound += data.items.length;

    for (const order of data.items) {
      // Only process onramp completed orders with a recipient
      if (order.status !== "completed") continue;
      if (order.type && order.type !== "onramp") continue;
      if (!order.recipientAddress) continue;

      const credit: TopUpCredit = {
        userAddress: order.recipientAddress as `0x${string}`,
        orderId: order.orderId,
        fiat: (order.sourceAsset as TopUpCredit["fiat"]) ?? "MXN",
        fiatAmount: order.sourceAmount ?? "0",
        cryptoAsset: order.targetAsset ?? "USDC",
        cryptoAmount: order.targetAmount ?? "0",
        chain: order.chain ?? "base",
        transactionHash: order.transactionHash,
        creditedAt: order.updatedAt ?? order.createdAt ?? new Date().toISOString(),
      };

      if (await countExisting(redis, credit)) {
        skipped++;
        if (verbose) console.log(`  SKIP  ${credit.orderId} (already exists)`);
        continue;
      }

      await writeCredit(redis, credit, dryRun);
      written++;
      if (verbose) {
        console.log(
          `  ${dryRun ? "WOULD" : "WRITE"} ${credit.orderId} → ${credit.userAddress} (${credit.cryptoAmount} ${credit.cryptoAsset})`,
        );
      }
    }

    pageNumber++;
  }

  return {
    mode: "sync",
    totalFound,
    skipped,
    written,
    dryRun,
    elapsedMs: Date.now() - start,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  const importIdx = args.indexOf("--import");
  const syncMode = args.includes("--sync");

  let importFile: string | null = null;
  if (importIdx !== -1 && args[importIdx + 1]) {
    importFile = args[importIdx + 1];
  }

  if (!importFile && !syncMode) {
    console.error("Specify --import <file> or --sync");
    process.exit(1);
  }
  if (importFile && syncMode) {
    console.error("Use either --import or --sync, not both");
    process.exit(1);
  }

  // Load Redis client
  let redis: Redis;
  try {
    const { Redis: IORedis } = await import("ioredis");
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    await redis.ping();
    if (verbose) console.log(`  Redis connected: ${redisUrl}`);
  } catch (err) {
    console.error("Failed to connect to Redis:", (err as Error).message);
    process.exit(1);
  }

  let result: MigrateResult;

  try {
    if (syncMode) {
      console.log("Mode: sync from Etherfuse API");
      result = await syncFromEtherfuse(redis, dryRun, verbose);
    } else {
      console.log(`Mode: import from ${importFile}`);
      result = await importCredits(redis, importFile!, dryRun, verbose);
    }

    // Summary
    const action = dryRun ? "WOULD WRITE" : "WRITTEN";
    console.log("");
    console.log("── Migration summary ──────────────────────────────");
    console.log(`  Mode:       ${result.mode}`);
    console.log(`  Found:      ${result.totalFound} credits`);
    console.log(`  Skipped:    ${result.skipped} (already exist)`);
    console.log(`  ${action}:     ${result.written} credits`);
    console.log(`  Duration:   ${result.elapsedMs}ms`);
    console.log("───────────────────────────────────────────────────");
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
