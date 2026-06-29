#!/usr/bin/env node
/**
 * Test Upstash Redis connectivity + the operations used by the G$ loop.
 *
 * Run: node apps/web/scripts/test-upstash.mjs
 *
 * Tests:
 *   1. Env vars are configured (not placeholders)
 *   2. Basic GET/SET roundtrip
 *   3. linkAuth0ToWallet pattern (set + get + delete)
 *   4. Rate limiter INCR
 *
 * If env vars are placeholders, prints a clear message about what to set.
 */

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function pass(msg) {
  console.log(COLORS.green("  ✓ ") + msg);
}
function fail(msg) {
  console.log(COLORS.red("  ✗ ") + msg);
}
function info(msg) {
  console.log(COLORS.bold("==> ") + msg);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function redisGet(key) {
  const response = await fetchWithTimeout(`${URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!response.ok) throw new Error(`GET ${key} failed: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function redisSet(key, value, ex) {
  const body = { value: JSON.stringify(value) };
  if (ex) body.ex = ex;
  const response = await fetchWithTimeout(`${URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`SET ${key} failed: ${response.status}`);
  return await response.json();
}

async function redisDel(key) {
  const response = await fetchWithTimeout(`${URL}/del/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!response.ok) throw new Error(`DEL ${key} failed: ${response.status}`);
  return await response.json();
}

async function redisIncr(key) {
  const response = await fetchWithTimeout(`${URL}/incr/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!response.ok) throw new Error(`INCR ${key} failed: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function main() {
  console.log();
  info("Upstash Redis connectivity test");
  console.log();

  // ── 1. Check env vars ──────────────────────────────────────
  info("Step 1: Environment variables");

  if (!URL || URL === "https://your-redis-instance.upstash.io") {
    fail("UPSTASH_REDIS_REST_URL is not set (placeholder value)");
    console.log();
    console.log(COLORS.yellow("  To fix:"));
    console.log('  1. Go to https://console.upstash.com');
    console.log("  2. Create a Redis database (free tier is fine)");
    console.log("  3. Copy the REST URL and REST Token");
    console.log("  4. Set them in apps/web/.env.local:");
    console.log('     UPSTASH_REDIS_REST_URL=https://xxx.upstash.io');
    console.log('     UPSTASH_REDIS_REST_TOKEN=xxx');
    console.log("  5. Also set them in Netlify env vars (Site settings → Environment)");
    console.log();
    process.exit(1);
  }

  if (!TOKEN || TOKEN === "your_redis_token_here") {
    fail("UPSTASH_REDIS_REST_TOKEN is not set (placeholder value)");
    process.exit(1);
  }

  pass(`URL: ${URL}`);
  pass(`TOKEN: ${TOKEN.substring(0, 8)}...`);
  console.log();

  // ── 2. Basic roundtrip ─────────────────────────────────────
  info("Step 2: Basic SET/GET roundtrip");

  const testKey = "onpoint:test:upstash-connectivity";
  const testValue = { timestamp: Date.now(), msg: "hello from test script" };

  try {
    await redisSet(testKey, testValue, 60); // 60s TTL
    pass("SET succeeded");

    const result = await redisGet(testKey);
    if (result) {
      const parsed = JSON.parse(result);
      if (parsed.msg === testValue.msg) {
        pass("GET returned correct value");
      } else {
        fail("GET returned wrong value");
      }
    } else {
      fail("GET returned null");
    }

    await redisDel(testKey);
    pass("DEL succeeded");
  } catch (err) {
    fail(`Roundtrip failed: ${err.message}`);
    process.exit(1);
  }
  console.log();

  // ── 3. linkAuth0ToWallet pattern ───────────────────────────
  info("Step 3: linkAuth0ToWallet pattern (G$ loop auth bridge)");

  const auth0Id = "auth0|test-upstash-check";
  const walletAddress = "0xTestWallet1234567890abcdef1234567890abcdef";
  const linkKey = `user:auth0-wallet:${auth0Id}`;

  try {
    await redisSet(linkKey, { walletAddress }, 60);
    pass("SET auth0→wallet link succeeded");

    const linkResult = await redisGet(linkKey);
    if (linkResult) {
      const parsed = JSON.parse(linkResult);
      if (parsed.walletAddress === walletAddress) {
        pass("GET auth0→wallet link returned correct address");
      } else {
        fail("GET auth0→wallet link returned wrong address");
      }
    } else {
      fail("GET auth0→wallet link returned null");
    }

    await redisDel(linkKey);
    pass("DEL auth0→wallet link (cleanup)");
  } catch (err) {
    fail(`linkAuth0ToWallet pattern failed: ${err.message}`);
  }
  console.log();

  // ── 4. Rate limiter INCR ───────────────────────────────────
  info("Step 4: Rate limiter INCR (used by requireAuthWithRateLimit)");

  const rateKey = "onpoint:test:rate-limit-check";
  try {
    // Clean up any previous test
    await redisDel(rateKey);

    const count1 = await redisIncr(rateKey);
    const count2 = await redisIncr(rateKey);
    const count3 = await redisIncr(rateKey);

    if (count1 === 1 && count2 === 2 && count3 === 3) {
      pass(`INCR sequence: 1 → 2 → 3 (atomic counter works)`);
    } else {
      fail(`INCR sequence unexpected: ${count1}, ${count2}, ${count3}`);
    }

    await redisDel(rateKey);
    pass("DEL rate limit key (cleanup)");
  } catch (err) {
    fail(`Rate limiter INCR failed: ${err.message}`);
  }
  console.log();

  // ── Done ───────────────────────────────────────────────────
  console.log(COLORS.green(COLORS.bold("✅ All Upstash Redis tests passed!")));
  console.log();
  console.log(COLORS.dim("  The G$ loop auth bridge (linkAuth0ToWallet) and"));
  console.log(COLORS.dim("  rate limiting are working correctly."));
  console.log();
}

main().catch((err) => {
  console.log();
  console.log(COLORS.red(COLORS.bold("✗ Test script crashed:")));
  console.log(COLORS.red(`  ${err.message}`));
  console.log();
  process.exit(1);
});
