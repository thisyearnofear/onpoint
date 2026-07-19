# Qwen Cloud Hackathon — Track 4: Autopilot Agent

> **OnPoint** is an AI-powered fashion commerce platform that uses Qwen Cloud models to perceive outfits, plan styling recommendations, and act on OnPoint's agent commerce infrastructure.

## Submission Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Sophisticated use of Qwen Cloud APIs | ✅ | Qwen3-VL-Flash (vision) + Qwen3.6-Flash (text) via DashScope API |
| Autopilot agent loop (perceive → plan → act) | ✅ | `scripts/qwen-autopilot.mjs` |
| MCP server for tool use | ✅ | `packages/qwen-mcp/` — 8 tools over stdio |
| Proof of Alibaba Cloud deployment | ✅ | `packages/storage/src/oss.ts` — Alibaba Cloud OSS adapter |
| Spend controls | ✅ | Kill switch, daily budget, max_tokens caps, `enable_thinking: false` |
| Open source | ✅ | MIT License |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QWEN CLOUD AUTOPILOT                         │
│                    Track 4: Autopilot Agent                         │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
  │  User Photo  │────▶│  Qwen3-VL-Flash  │────▶│  Qwen3.6-Flash  │
  │  (outfit)    │     │  (PERCEIVE)      │     │  (PLAN)         │
  └──────────────┘     │  Qwen Cloud API  │     │  Qwen Cloud API │
                       │  DashScope       │     │  DashScope      │
                       └────────┬─────────┘     └────────┬────────┘
                                │                        │
                                │   ┌────────────────────┘
                                ▼   ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     AUTOPILOT ORCHESTRATOR                       │
  │                     scripts/qwen-autopilot.mjs                   │
  │                                                                  │
  │  1. PERCEIVE: Qwen3-VL identifies outfit + African textiles      │
  │  2. PLAN:     Qwen3.6-Flash generates styling recommendations    │
  │  3. ACT:      Browse curators → find items → try-on → buy       │
  └──────────────────────┬───────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────┐
  │  MCP Server │ │  OnPoint    │ │  Alibaba Cloud OSS              │
  │  (8 tools)  │ │  API        │ │  (artifact mirror)              │
  │             │ │             │ │                                 │
  │  browse     │ │ /api/agent/ │ │  packages/storage/src/oss.ts    │
  │  analyze    │ │ /api/curator│ │  • putObject                    │
  │  try_on     │ │ /api/looks  │ │  • mirrorTryOnArtifact          │
  │  buy_item   │ │             │ │  • signedUrl                    │
  │  earnings   │ │             │ │  Best-effort (fail-open)        │
  │  looks      │ │             │ │                                 │
  └─────────────┘ └──────┬──────┘ └─────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    ONPOINT AGENT COMMERCE                        │
  │                                                                  │
  │  Celo Mainnet (chainId 42220)                                    │
  │  • x402 payment protocol (HTTP 402 → cUSD → tx hash)            │
  │  • ERC-8021 attribution tags                                     │
  │  • 0xSplits royalty distribution                                 │
  │  • Curator payout wallets                                        │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                    QWEN CLOUD INTEGRATION                        │
  │                                                                  │
  │  Endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1│
  │  Models:   qwen3-vl-flash ($0.05/$0.40 per 1M tokens)           │
  │            qwen3.6-flash  ($0.25/$1.50 per 1M tokens)           │
  │                                                                  │
  │  Spend Controls:                                                 │
  │  • Kill switch (QWEN_CLOUD_KILL_SWITCH=1)                       │
  │  • Daily budget (QWEN_CLOUD_DAILY_BUDGET_USD=1.00)              │
  │  • max_tokens caps (200 for analysis, 300 for African textile)  │
  │  • enable_thinking: false (saves ~576 tokens/call)              │
  │  • Model tiering (cheapest vision: qwen3-vl-flash)              │
  └──────────────────────────────────────────────────────────────────┘
```

## Qwen Cloud API Usage

### Models Used

| Model | Purpose | Pricing (per 1M tokens) |
|-------|---------|--------------------------|
| `qwen3-vl-flash` | Vision — outfit analysis, African textile identification | $0.05 input / $0.40 output |
| `qwen3.6-flash` | Text — styling plan generation, persona chat | $0.25 input / $1.50 output |

### API Endpoint

```
https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
```

OpenAI Chat Completions compatible. Authentication: `Bearer sk-...`

### Key Implementation: `enable_thinking: false`

Qwen3.6-Flash enables "thinking mode" by default, which generates hundreds of hidden reasoning tokens. We discovered during testing that a `max_tokens: 1` health check generated **586 completion tokens** (576 reasoning tokens). Setting `enable_thinking: false` reduced this to **1 token** — a 586x cost reduction.

This is enforced in three places:
1. `packages/qwen-cloud/src/client.ts` — the canonical TS client
2. `apps/api/routes/ai-qwen-analyze.js` — the API route
3. `packages/qwen-mcp/src/tools.ts` — the MCP server

## Components

### 1. Qwen Cloud Client (`packages/qwen-cloud/`)

The canonical TypeScript client with spend controls:
- `QwenCloudClient` class with `chat`, `analyzeOutfit`, `analyzeAfricanTextile`, `chatPersona`
- Kill switch, daily budget, per-call token caps
- `enable_thinking: false` by default
- Cost estimation per call
- 8 unit tests (all passing)

### 2. API Route (`apps/api/routes/ai-qwen-analyze.js`)

Express route on the Hetzner backend:
- `POST /api/ai/qwen-analyze` — vision analysis with goal-based prompts
- Frame rate limiting (30 frames/min per IP)
- Spend guards (kill switch, daily budget)
- Returns `estimatedCostUsd`, `dailySpendUsd`, `dailyBudgetUsd` in every response
- Mounted in `server.js`, proxied through Next.js at `/api/ai/qwen-analyze`

### 3. Live Session Provider (`packages/ai-client/src/providers/qwen-cloud-live-provider.ts`)

Real-time camera frame analysis:
- Polling-based live session (2.5s interval)
- Routes through `/api/ai/qwen-analyze`
- Surfaces spend info as protocol milestones
- Registered as the primary provider in `SESSION_FACTORIES`

### 4. Alibaba Cloud OSS Adapter (`packages/storage/src/oss.ts`)

**Proof of Alibaba Cloud Deployment:**
- Uses official `ali-oss@6.23.0` SDK
- `mirrorTryOnArtifact()` — mirrors try-on polaroids to OSS after R2 upload
- Best-effort (fail-open) — never blocks production
- Health check via `isOssAvailable()`
- Called in `apps/api/routes/agent-tryon.js` after every successful try-on

### 5. MCP Server (`packages/qwen-mcp/`)

**Technical Depth — Model Context Protocol:**
- 8 tools: `browse_curator_directory`, `browse_storefront`, `analyze_outfit`, `analyze_african_textile`, `try_on`, `buy_item`, `check_earnings`, `list_looks`
- stdio transport (for local agent runtimes)
- Tools 3-4 call Qwen Cloud directly
- Tools 5-6 demonstrate x402 payment protocol (402 challenge → cUSD payment → re-POST)
- Configurable in any MCP-compatible client (Claude Desktop, Qwen Agent, etc.)

### 6. Autopilot Orchestrator (`scripts/qwen-autopilot.mjs`)

**The demo script:**
- `PERCEIVE` → Qwen3-VL-Flash analyzes outfit photo
- `PLAN` → Qwen3.6-Flash generates styling recommendations
- `ACT` → Browses OnPoint curator directory + storefronts
- Outputs JSON to stdout, human-readable progress to stderr
- `--dry-run` flag for no API calls
- Total cost per run: ~$0.0005

## Spend Controls

| Control | Env Var | Default | Effect |
|---------|---------|---------|--------|
| Kill switch | `QWEN_CLOUD_KILL_SWITCH` | `0` | When `1`, every call throws immediately |
| Daily budget | `QWEN_CLOUD_DAILY_BUDGET_USD` | `1.00` | Blocks calls when daily spend exceeds this |
| Max tokens (analysis) | — | 200 | Hard cap on completion tokens |
| Max tokens (African textile) | — | 300 | Slightly higher for detailed pattern ID |
| Thinking mode | — | `false` | Disables hidden reasoning tokens (586x savings) |
| Model tiering | `QWEN_CLOUD_VISION_MODEL` | `qwen3-vl-flash` | Cheapest vision model by default |

## Verified Spend

| Test | Calls | Total Cost |
|------|-------|------------|
| Unit tests (8) | 0 real calls | $0.000 |
| Smoke test (3 calls) | 3 | $0.000207 |
| Route integration test | 2 | $0.000383 |
| MCP vision test | 1 | $0.000205 |
| Autopilot full loop | 2 | $0.000503 |
| **Total testing spend** | **8** | **$0.001298** |

## Running the Demo

```bash
# 1. Dry run (no API calls)
node scripts/qwen-autopilot.mjs --dry-run

# 2. Live autopilot loop
node scripts/qwen-autopilot.mjs

# 3. With a custom photo
node scripts/qwen-autopilot.mjs --photo path/to/outfit.jpg --goal african

# 4. MCP server (for agent runtimes)
npx tsx packages/qwen-mcp/src/index.ts

# 5. MCP inspector (visual tool browser)
npx @modelcontextprotocol/inspector npx tsx packages/qwen-mcp/src/index.ts

# 6. Qwen Cloud smoke test
node scripts/qwen-cloud-smoke.mjs

# 7. OSS adapter smoke test
node scripts/oss-adapter-smoke.mjs
```

## Environment Variables

See `apps/api/.env.example` for the full list. Key variables:

```bash
# Qwen Cloud (required)
DASHSCOPE_API_KEY=sk-...

# Spend controls
QWEN_CLOUD_DAILY_BUDGET_USD=1.00
QWEN_CLOUD_KILL_SWITCH=0

# Alibaba Cloud OSS (for artifact mirror)
ALIBABA_OSS_ACCESS_KEY_ID=...
ALIBABA_OSS_ACCESS_KEY_SECRET=...
ALIBABA_OSS_BUCKET=onpoint-tryon
ALIBABA_OSS_REGION=oss-us-west-1

# OnPoint API
ONPOINT_API_BASE=https://api.onpoint.famile.xyz
```

## Differentiated Capability: African Textile Identification

OnPoint's unique value for the Qwen Cloud Hackathon is **African textile pattern identification**. The `analyze_african_textile` tool (available via the MCP server and the API route) uses Qwen3-VL-Flash to identify:

- **Ankara** (West African wax print)
- **Kente** (Ghanaian woven cloth)
- **Adire** (Nigerian indigo tie-dye)
- **Bogolan** (Malian mud cloth)
- **Shweshwe** (South African printed cotton)
- **Kitenge** (East African wax print)
- **Wax Print** (general West African)

For each pattern, the model notes cultural origin, styling approach, and occasion-appropriateness. This is culturally-aware fashion AI — not just "describe the outfit" but "understand the cultural context of the textiles."

## License

MIT — see [LICENSE](../LICENSE)
