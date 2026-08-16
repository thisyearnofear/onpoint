#!/usr/bin/env node
/**
 * YouCam Apparel VTO Smoke Test — live validation of the Perfect Corp
 * YouCam API integration (cloth-v4) for the YouCam API Skin AI & Apparel
 * VTO Hackathon (Devpost, deadline 2026-08-17 11:45 EDT).
 *
 * Loads YOUCAM_API_KEY from apps/api/.env (gitignored), runs one full
 * File-API-upload → cloth-v4-task → poll → render cycle, and prints the
 * task id, latency, and result URL.
 *
 * Default inputs are the official YouCam docs sample images (publicly
 * hosted by Perfect Corp), so the smoke test needs zero local assets.
 *
 * Usage:
 *   node scripts/youcam-tryon-smoke.mjs
 *   node scripts/youcam-tryon-smoke.mjs --person=https://... --garment=https://...
 *   node scripts/youcam-tryon-smoke.mjs --person=./photo.jpg   # uploaded via File API
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Load apps/api/.env manually (no dotenv dependency for this script)
const envFile = resolve(repoRoot, "apps/api/.env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    }),
);

// Official YouCam docs sample images (publicly hosted by Perfect Corp)
const DEFAULT_PERSON =
  "https://plugins-media.makeupar.com/strapi/assets/clothes_03_cccd5d4803.jpeg";
const DEFAULT_GARMENT =
  "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png";

async function resolveInput(value, fallback, label) {
  if (!value) return fallback;
  if (value.startsWith("http")) return value;
  if (value.startsWith("data:")) return value;
  // local file → data URI (exercises the File API upload path)
  const buf = readFileSync(resolve(repoRoot, value));
  const ext = value.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  console.log(`  · ${label}: local file ${value} (${buf.length} bytes) → data URI`);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function main() {
  if (!process.env.YOUCAM_API_KEY) {
    console.error("✗ YOUCAM_API_KEY not set. Add it to apps/api/.env");
    console.error("  (key console: https://yce.makeupar.com/api-console/en/api-keys/)");
    process.exit(3);
  }

  const youcamVto = require("../apps/api/lib/youcam-vto.js");
  if (!youcamVto.isConfigured()) {
    console.error("✗ youcam-vto reports not configured");
    process.exit(3);
  }

  const personImage = await resolveInput(args.person, DEFAULT_PERSON, "person");
  const garmentImage = await resolveInput(args.garment, DEFAULT_GARMENT, "garment");

  console.log("YouCam Apparel VTO smoke test");
  console.log(`  · server: ${process.env.YOUCAM_API_BASE_URL || "https://yce-api-01.makeupar.com"}`);
  console.log(`  · person: ${personImage.slice(0, 80)}${personImage.length > 80 ? "…" : ""}`);
  console.log(`  · garment: ${garmentImage.slice(0, 80)}${garmentImage.length > 80 ? "…" : ""}`);
  console.log(`  · category: ${args.category || "auto"}`);

  const startedAt = Date.now();
  try {
    const result = await youcamVto.tryOn({
      personImage,
      garmentImage,
      garmentCategory: args.category || "auto",
    });
    console.log(`\n✓ Render complete in ${Date.now() - startedAt}ms`);
    console.log(`  · task_id:   ${result.taskId}`);
    console.log(`  · latency:   ${result.latencyMs}ms (library-measured)`);
    console.log(`  · renderUrl: ${result.renderUrl}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n✗ YouCam try-on failed after ${Date.now() - startedAt}ms`);
    console.error(`  · code: ${error.code || "unknown"}`);
    console.error(`  · youcamErrorCode: ${error.youcamErrorCode || "none"}`);
    console.error(`  · taskId: ${error.taskId || "none"}`);
    console.error(`  · message: ${error.message}`);
    process.exit(1);
  }
}

main();
