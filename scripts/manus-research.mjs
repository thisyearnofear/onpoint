#!/usr/bin/env node
/**
 * Manus Research Driver — design-intelligence collection for OnPoint.
 *
 * The Manus API key is a TIME-BOXED asset (unlimited credits for a few hours),
 * not an ongoing dependency. Its only durable value is PERMANENT research
 * artifacts that de-risk design decisions. This script spends that window on the
 * one thing neither the founder nor a coding agent can cheaply produce:
 * browser-native competitive teardowns + best-practice pattern boards + digital
 * SKU-expansion concepts. The results are evidence; the design execution that
 * follows is done by the coding agent with ordinary tools and stays forever.
 *
 * Re-running produces a fresh timestamped run so collections never go stale.
 *
 * Usage:
 *   node scripts/manus-research.mjs                       # full run
 *   node scripts/manus-research.mjs --only teardowns      # one group
 *   node scripts/manus-research.mjs --only patterns
 *   node scripts/manus-research.mjs --only sku
 *   node scripts/manus-research.mjs --profile manus-1.6-lite   # cheaper profile
 *   node scripts/manus-research.mjs --max-parallel 4
 *
 * Env:
 *   MANUS_API_KEY   (repo-root .env.local)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// --- load .env.local manually (no dotenv dependency, matches repo convention) ---
function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    const p = resolve(repoRoot, name);
    try {
      const txt = readFileSync(p, "utf-8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* file absent, skip */
    }
  }
}
loadEnv();

const API_KEY = process.env.MANUS_API_KEY;
if (!API_KEY) {
  console.error("✗ MANUS_API_KEY not found in .env.local");
  process.exit(1);
}

const BASE = "https://api.manus.ai/v2";
const args = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const only = args.includes("--only") ? argVal("--only", "all") : "all";
const PROFILE = argVal("--profile", "manus-1.6");
const MAX_PARALLEL = parseInt(argVal("--max-parallel", "6"), 10);
const POLL_MS = 20_000;
const MAX_TASK_MIN = 30; // safety cap per task
const CREATE_GAP_MS = 2_000; // be polite to per-user rate limits

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-manus-api-key": API_KEY,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data.ok === false) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Manus API ${path}: ${msg}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Task specs
// ---------------------------------------------------------------------------

const ONPOINT_CONTEXT = `
OnPoint is "the execution layer for fashion intent that needs fit + real stock +
local pay." It is NOT a horizontal AI-stylist app. Its scarce asset is a
fit-aware, locally-payable, agent-addressable SUPPLY GRAPH of African fashion
curators (Ankara, Kente, Adire, Bogolan, Shweshwe, football-kit culture). Humans
shop branded storefronts with AI try-on -> WhatsApp/M-Pesa; AI agents buy the SAME
inventory via API (x402, cUSD). It is a beachhead in emerging markets (Nairobi /
Lagos / Accra).
`.trim();

// 1) Competitor teardowns — the browser-native thing a coding agent can't do.
const TEARDOWN_TARGETS = [
  { slug: "doji", url: "https://www.doji.com", focus: "AI try-on app, US fashion" },
  { slug: "styleai", url: "https://www.styleai.com", focus: "AI stylist / outfit generator" },
  { slug: "walmart-be-your-own-model", url: "https://www.walmart.com", focus: "Zeekit 'Be Your Own Model' virtual try-on on a mass retailer" },
  { slug: "amazon", url: "https://www.amazon.com", focus: "virtual try-on / AI shopping assistant" },
  { slug: "jumia", url: "https://www.jumia.co.ke", focus: "African marketplace, fashion category, checkout rails (M-Pesa)" },
  { slug: "kilimall", url: "https://www.kilimall.co.ke", focus: "African marketplace, fashion, local payment rails" },
  { slug: "zeekit", url: "https://www.zeekit.co", focus: "dedicated virtual try-on tech (Walmart acquisition)" },
  { slug: "vue-ai-or-virtual-tryon-vendor", url: "https://vue.ai", focus: "virtual try-on / digital fashion B2B vendor" },
];

const TEARDOWN_PROMPT = (t) => `
You are doing a product-design teardown of a real competitor for a fashion-tech
startup. Target product: "${t.slug}" (${t.url}) — focus: ${t.focus}.

Do the following IN A REAL BROWSER, taking annotated screenshots of each step:
1. Land on the product. Describe the value proposition as a first-time visitor sees it.
2. Find the try-on / styling / "see it on you" feature. If it requires sign-up or
   a photo, go as far as you reasonably can WITHOUT entering real payment details
   or a real personal photo (use a placeholder if it insists, and say so). If it
   cannot be reached, say exactly where it blocks and screenshot the blocker.
3. Determine: does the try-on show the ACTUAL specific garment on the person, or a
   generic "similar look" approximation? Quote any UI copy that sets (or fails to
   set) this expectation. This distinction is the single most important finding.
4. Capture pricing / free-vs-paid tiers if any.
5. Capture checkout rails (card, PayPal, M-Pesa, WhatsApp, crypto, etc.).
6. Note any agent / developer / API / machine-consumable surface (agent.json,
   OpenAPI, developer docs, affiliate API).
7. Assess mobile UX quality (responsive? fast? clear CTAs?).
8. Take a minimum of 4 screenshots: landing, try-on entry, try-on result (or
   blocker), and pricing/checkout. Save them and reference them by filename in the
   result.

Context on the startup this teardown informs:
${ONPOINT_CONTEXT}

Finally: state the specific GAP between this product and OnPoint's positioning —
what OnPoint could do better, and what this product does well that OnPoint should
copy. Be concrete and evidence-based; cite screenshots.
`.trim();

const TEARDOWN_SCHEMA = {
  type: "object",
  properties: {
    product: { type: "string" },
    url: { type: "string" },
    value_proposition: { type: "string" },
    try_on_reached: { type: "boolean" },
    try_on_render_type: {
      type: "string",
      enum: ["actual_garment", "similar_look_approximation", "none", "unknown"],
      description: "Does try-on show the specific garment, or a generic approximation?",
    },
    expectation_copy: {
      type: ["string", "null"],
      description: "Verbatim UI copy that labels the try-on as real vs. approximation, if any.",
    },
    pricing_tiers: { type: ["string", "null"] },
    checkout_rails: { type: "array", items: { type: "string" } },
    has_agent_or_api_surface: { type: "boolean" },
    mobile_ux_quality: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
    screenshots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          caption: { type: "string" },
        },
        required: ["filename", "caption"],
        additionalProperties: false,
      },
    },
    gap_vs_onpoint: { type: "string" },
    what_onpoint_should_copy: { type: "string" },
    task_url: { type: "string" },
  },
  required: [
    "product", "url", "value_proposition", "try_on_reached", "try_on_render_type",
    "expectation_copy", "pricing_tiers", "checkout_rails", "has_agent_or_api_surface",
    "mobile_ux_quality", "screenshots", "gap_vs_onpoint", "what_onpoint_should_copy",
    "task_url",
  ],
  additionalProperties: false,
};

// 2) Best-practice pattern boards — the three hardest design problems.
const PATTERN_TOPICS = [
  {
    slug: "approximation-labeling",
    prompt: `Research how the BEST consumer products label an AI-generated result as an
APPROXIMATION rather than the real thing — without killing conversion. Concrete
examples from virtual try-on, AR furniture placement (IKEA Place), beauty try-on
(Sephora Virtual Artist, L'Oréal), and any AI image product. For each example:
what exact copy/badge/disclaimer do they use, where is it placed, and how do they
balance honesty with confidence? Save screenshots. End with 5 concrete, copy-paste
recommendations for how OnPoint should label its free-tier "similar look" try-on so
users are never misled about seeing the actual garment.`,
  },
  {
    slug: "honest-social-proof",
    prompt: `Research honest activity / social-proof patterns for early-stage products
that have low real volume — specifically alternatives to fake "live activity" feeds.
Look at how products like Product Hunt, Linear, Cal.com, Notion, and early SaaS
show genuine traction without fabricating streaming feeds. For each: what do they
show (real counters, waitlists, "recently shipped", curated case studies), and how
do they avoid looking fake? Save screenshots. End with 5 concrete recommendations
for OnPoint's homepage, which currently shows a hardcoded "STREAMING / live agent
feed" that is mostly fake — propose honest replacements that still build trust.`,
  },
  {
    slug: "tryon-to-purchase",
    prompt: `Research how virtual try-on products set expectations and drive the user
from try-on to purchase. Look at Sephora, Warby Parker, IKEA Place, Zeekit/Walmart,
and any African fashion marketplace. For each: the exact flow from "see it on you"
to "buy it", how they handle the gap between render and reality, and how they reduce
returns/refund anxiety. Save screenshots. End with 5 concrete recommendations for
OnPoint's storefront try-on-to-WhatsApp/M-Pesa purchase flow.`,
  },
];

const PATTERN_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product: { type: "string" },
          what_they_do: { type: "string" },
          screenshot: { type: ["string", "null"] },
        },
        required: ["product", "what_they_do", "screenshot"],
        additionalProperties: false,
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
    task_url: { type: "string" },
  },
  required: ["topic", "examples", "recommendations", "task_url"],
  additionalProperties: false,
};

// 3) Digital SKU-expansion concepts — keep Nia Digital's catalog fresh/varied.
const SKU_PROMPT = `
OnPoint's first digital curator is "Nia Digital" — an AI curator generating
avant-garde African-football-culture designs (e.g. "Jersey Dress — Nairobi Sunrise",
"Arsenal Away — Mudcloth Minimal", "Man City Home — Kente Crown"). Current catalog
is 8 digital designs.

Produce a structured expansion plan to keep the digital catalog fresh and varied,
with a wide spread of SKUs and options. Generate 20 new digital design concepts
organized as a matrix across:
- African textile motifs: Ankara, Kente, Adire, Bogolan (mudcloth), Shweshwe, Kitenge, Ndebele
- Garment types: jersey dress, tracksuit, bomber, football kit (home/away), bucket hat, scarf, sneaker skin, phone-case skin
- Occasions/moods: matchday, street, festival, date-night, rooftop brunch, gym
- A naming scheme consistent with the existing catalog (City/Place + Motif + Vibe).

For each of the 20 concepts give: name, motif, garment type, occasion, a one-line
design brief (colors + pattern description an image model could render), and an
estimated price band (try-on $0.03, NFT mint $0.10). Also suggest 5 "collection
drops" (themed bundles of 3-5 concepts) that could be released over time to keep
supply fresh.

Context: ${ONPOINT_CONTEXT}
`.trim();

const SKU_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          motif: { type: "string" },
          garment: { type: "string" },
          occasion: { type: "string" },
          design_brief: { type: "string" },
          price_band: { type: "string" },
        },
        required: ["name", "motif", "garment", "occasion", "design_brief", "price_band"],
        additionalProperties: false,
      },
    },
    collection_drops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          concept_names: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["title", "concept_names", "rationale"],
        additionalProperties: false,
      },
    },
    task_url: { type: "string" },
  },
  required: ["concepts", "collection_drops", "task_url"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Task runner
// ---------------------------------------------------------------------------

async function createTask(prompt, schema, title) {
  const data = await api("/task.create", {
    method: "POST",
    body: {
      message: { content: prompt },
      structured_output_schema: schema,
      interactive_mode: false,
      hide_in_task_list: false,
      agent_profile: PROFILE,
      title,
    },
  });
  return { id: data.task_id, url: data.task_url, title };
}

// Poll one task to completion; auto-confirm any waiting states so it never stalls.
async function pollTask(task) {
  const startedAt = Date.now();
  const rawEvents = [];
  let lastStatus = null;
  while (Date.now() - startedAt < MAX_TASK_MIN * 60_000) {
    const data = await api(
      `/task.listMessages?task_id=${task.id}&order=desc&limit=20`
    );
    const events = data.data || data.messages || [];
    for (const e of events) rawEvents.push(e);

    // find latest status_update
    const status = events.find((e) => e.type === "status_update");
    const agentStatus = status?.status_update?.agent_status;
    if (agentStatus !== lastStatus) {
      console.log(`    [${task.id.slice(0, 8)}] status: ${agentStatus || "?"}`);
      lastStatus = agentStatus;
    }

    if (agentStatus === "waiting") {
      const detail = status?.status_update?.status_detail || {};
      const evtType = detail.waiting_for_event_type;
      if (evtType === "messageAskUser") {
        // best-effort: nudge it to proceed autonomously
        await api("/task.sendMessage", {
          method: "POST",
          body: {
            task_id: task.id,
            message: {
              content:
                "Proceed autonomously with your best judgment. Do not wait for further input.",
            },
          },
        }).catch(() => {});
      } else if (detail.waiting_for_event_id) {
        await api("/task.confirmAction", {
          method: "POST",
          body: {
            task_id: task.id,
            event_id: detail.waiting_for_event_id,
            input: { accept: true, global_allow: true, always_allow: true },
          },
        }).catch(() => {});
      }
    }

    if (agentStatus === "stopped" || agentStatus === "error") {
      // grab structured result
      const so = events.find((e) => e.type === "structured_output_result");
      return {
        task,
        status: agentStatus,
        structured: so?.structured_output_result || null,
        rawEvents,
        timedOut: false,
      };
    }

    await sleep(POLL_MS);
  }
  return { task, status: "timeout", structured: null, rawEvents, timedOut: true };
}

// ---------------------------------------------------------------------------
// Run a group with bounded parallelism
// ---------------------------------------------------------------------------

async function runGroup(label, items, makeSpec) {
  console.log(`\n=== ${label}: launching ${items.length} tasks (profile ${PROFILE}) ===`);
  const launched = [];
  for (const item of items) {
    const { prompt, schema, title } = makeSpec(item);
    try {
      const task = await createTask(prompt, schema, title);
      console.log(`  + ${title} -> ${task.url}`);
      launched.push({ item, task });
      await sleep(CREATE_GAP_MS);
    } catch (err) {
      console.error(`  ! failed to launch ${title}: ${err.message}`);
    }
  }

  // poll all in parallel, but respect MAX_PARALLEL active at once
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < launched.length) {
      const my = idx++;
      const { item, task } = launched[my];
      try {
        const r = await pollTask(task);
        results.push({ item, ...r });
        console.log(`  ✓ done: ${task.title} (${r.status})`);
      } catch (err) {
        console.error(`  ! poll error ${task.title}: ${err.message}`);
        results.push({ item, task, status: "poll_error", error: err.message });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_PARALLEL, launched.length) }, worker)
  );
  return results;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeJSON(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2), "utf-8");
}

async function main() {
  const runDir = resolve(repoRoot, "research/manus", `run-${stamp()}`);
  mkdirSync(join(runDir, "teardowns"), { recursive: true });
  mkdirSync(join(runDir, "patterns"), { recursive: true });
  mkdirSync(join(runDir, "sku-expansion"), { recursive: true });
  mkdirSync(join(runDir, "raw"), { recursive: true });
  console.log(`Run dir: ${runDir}`);

  const groups = [];
  if (only === "all" || only === "teardowns") {
    groups.push(["teardowns", TEARDOWN_TARGETS, (t) => ({
      prompt: TEARDOWN_PROMPT(t),
      schema: TEARDOWN_SCHEMA,
      title: `Teardown: ${t.slug}`,
    })]);
  }
  if (only === "all" || only === "patterns") {
    groups.push(["patterns", PATTERN_TOPICS, (p) => ({
      prompt: p.prompt + `\n\nContext: ${ONPOINT_CONTEXT}`,
      schema: PATTERN_SCHEMA,
      title: `Pattern board: ${p.slug}`,
    })]);
  }
  if (only === "all" || only === "sku") {
    groups.push(["sku-expansion", [{ slug: "nia-expansion" }], () => ({
      prompt: SKU_PROMPT,
      schema: SKU_SCHEMA,
      title: `SKU expansion: Nia Digital`,
    })]);
  }

  const indexLines = [`# Manus Research Run — ${stamp()}`, "", `Profile: ${PROFILE}`, ""];

  for (const [dir, items, makeSpec] of groups) {
    const results = await runGroup(dir, items, makeSpec);
    for (const r of results) {
      const slug = r.item.slug;
      const outFile = join(runDir, dir, `${slug}.json`);
      const value = r.structured?.value || null;
      writeJSON(outFile, {
        slug,
        status: r.status,
        task_url: r.task?.url || null,
        structured_success: r.structured?.success ?? false,
        value,
      });
      if (r.rawEvents) {
        writeJSON(join(runDir, "raw", `${slug}.events.json`), r.rawEvents);
      }
      indexLines.push(`- **${dir}/${slug}** — ${r.status} — [task](${r.task?.url || "n/a"})`);
    }
  }

  writeFileSync(join(runDir, "INDEX.md"), indexLines.join("\n"), "utf-8");
  console.log(`\n=== Done. Index: ${join(runDir, "INDEX.md")} ===`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
