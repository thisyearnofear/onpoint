# Qwen Cloud Hackathon — Track 4 (Autopilot Agent) Implementation Plan

> Submission target: Global AI Hackathon with Qwen Cloud, Track 4: Autopilot Agent.
> Entry: OnPoint — autonomous fashion commerce agent with African textile specialization.
> Status: PLAN ONLY — no code changes made yet.

## 1. Strategic positioning

**One-line pitch:** OnPoint is an autopilot agent that turns a photo of an outfit into a verifiable on-chain purchase from a real African fashion curator — perceiving with Qwen3-VL, reasoning about fit/cultural context, and acting through x402-paid try-on and Celo checkout, with a human-in-the-loop checkpoint above $5.

**Why this wins Track 4:**
- Real business workflow end-to-end (perceive → reason → act), not a toy demo.
- Ambiguous inputs (outfit photos with cultural context).
- External tools: Qwen Cloud, x402 payments, Celo, R2/OSS, Neon/RDS, IPFS.
- Human-in-the-loop checkpoint already implemented ($5 autonomy threshold in `packages/agent-core/src/autonomous-executor.ts`).
- Production-live at https://beonpoint.netlify.app with real curators and inventory.
- African fashion angle is genuinely differentiated among 8000+ entries — ADR 0006 + pattern-aware prompts (Ankara/Kente/Adire/Bogolan/Shweshwe) already in `apps/api/routes/ai-zerog-analyze.js`.

## 2. Current state (verified)

| Capability | Status | File |
|---|---|---|
| Qwen3-VL-30B + Qwen3-VL-235B-A22B in use | ✅ via 0G Router and Venice | `packages/0g-compute/src/models.ts` |
| Outfit analysis route | ✅ hits 0G Router | `apps/api/routes/ai-zerog-analyze.js` |
| Live session factory chain | ✅ venice→replicate→azure→0g→gemini | `packages/ai-client/src/providers/live-session-factories.ts` |
| Autonomous executor + $5 threshold | ✅ | `packages/agent-core/src/autonomous-executor.ts` |
| x402 try-on + checkout | ✅ | `apps/api/routes/agent-tryon.js`, `apps/api/routes/agent-checkout.js` |
| Reference buyer script | ✅ | `scripts/agent-buyer.mjs` |
| OpenAPI contract | ✅ | `apps/web/public/openapi.json` |
| Funnel analytics | ✅ | `apps/api/routes/funnel-analytics.js` |
| Architecture docs | ✅ | `docs/ARCHITECTURE.md` |
| LICENSE file | ❌ missing | repo root |
| Direct Qwen Cloud (DashScope) integration | ❌ | — |
| Alibaba Cloud deployment proof | ❌ | — |
| Qwen Cloud MCP server | ❌ | — |
| Architecture diagram (image) | ❌ | — |
| Demo video | ❌ | — |

## 3. Hard requirements (eligibility blockers)

These MUST ship or the entry is disqualified:

1. **Direct Qwen Cloud API usage** — today every Qwen call is proxied through 0G Compute Router or Venice. The rubric (Technical Depth, 30%) explicitly rewards "sophisticated use of QwenCloud APIs (e.g., custom skills, MCP integrations)." Routing through a third-party router does not count.
2. **Alibaba Cloud deployment proof** — "a link to a code file in their code repo that demonstrates use of Alibaba Cloud services and APIs." Today: zero Alibaba Cloud usage.
3. **Open-source license file** at repo root, visible in the GitHub "About" section.
4. **Architecture diagram** (visual).
5. **3-minute demo video** on YouTube/Vimeo/Facebook, public.
6. **Text description** for Devpost.
7. **Track declaration**: Track 4.
8. **Public repo**.

## 4. Implementation phases

Ordered by dependency. Each phase is independently shippable.

### Phase 1 — License + repo hygiene (30 min)

- [ ] Add `LICENSE` (Apache-2.0) at repo root.
- [ ] Confirm repo is public on GitHub.
- [ ] Add `LICENSE` reference to `package.json` (`"license": "Apache-2.0"`).
- [ ] Add a `# Qwen Cloud Hackathon` badge/section to `README.md` lede with track declaration.

### Phase 2 — Qwen Cloud (DashScope) client package (core requirement)

**Goal:** Direct, first-party Qwen Cloud integration. This is the single most important change for eligibility and the Technical Depth rubric.

- [ ] New package `packages/qwen-cloud/`:
  - `src/client.ts` — `QwenCloudClient` class, ported from `packages/0g-compute/src/client.ts`. Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1` (OpenAI-compatible). Auth: `DASHSCOPE_API_KEY` env.
  - `src/models.ts` — catalog of Qwen Cloud models we use: `qwen-vl-max-latest`, `qwen-vl-plus`, `qwen3-vl-30b-a3b-instruct`, `qwen-plus`, `qwen-max`. Include pricing fields for spend-policy billing.
  - `src/types.ts` — request/response types (subset of OpenAI Chat Completions + Qwen-specific fields like `enable_search`, `result_format`).
  - `src/index.ts` — exports + `getQwenCloudClient()` singleton factory (mirrors `getZeroGClient`).
  - `package.json` — workspace package, no runtime deps (uses `fetch`).
  - `src/__tests__/client.test.ts` — unit tests for payload shape, error handling, env-missing fallback.
- [ ] Methods on `QwenCloudClient`:
  - `chat(request)` — OpenAI-compatible chat completions.
  - `analyzeOutfit(imageDataUrl, prompt, options)` — vision analysis returning strict JSON `CritiqueResponse`.
  - `analyzeAfricanTextile(imageDataUrl)` — specialized method: pattern ID (Ankara/Kente/Adire/Bogolan/Shweshwe), cultural context, occasion-appropriateness. This is the differentiated capability — call it out in the video.
  - `chatPersona(systemPrompt, userMessage, options)` — stylist persona chat.
  - `isAvailable()` — health check for the live-session factory chain.
- [ ] Env vars (add to `apps/api/.env.example`): `DASHSCOPE_API_KEY`, `QWEN_CLOUD_BASE_URL` (optional override), `QWEN_CLOUD_VISION_MODEL` (default `qwen-vl-max-latest`), `QWEN_CLOUD_CHAT_MODEL` (default `qwen-plus`).

### Phase 3 — API route + live-session wiring

- [ ] New route `apps/api/routes/ai-qwen-analyze.js`:
  - Mirrors `ai-zerog-analyze.js` structure (frame rate limit, goal-based prompts, TEE-style trace field if Qwen Cloud returns one).
  - Calls `getQwenCloudClient()`; returns 503 if `DASHSCOPE_API_KEY` missing.
  - Adds `provider: 'qwen-cloud'` to the response.
  - Includes the African textile prompt set as a first-class `goal: 'african'` path.
- [ ] Mount in `apps/api/server.js` alongside the other analyze routes:
  `app.use('/api/ai/qwen-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, veniceBurstLimit, require('./routes/ai-qwen-analyze'));`
- [ ] Add `qwen-cloud` as the **first** entry in the live-session fallback chain in `packages/ai-client/src/providers/live-session-factories.ts`:
  - New `qwenCloudFactory` (mirrors `veniceFactory`).
  - Update every other factory's `fallbackChain` to prepend `'qwen-cloud'`.
  - New `QwenCloudLiveProvider` in `packages/ai-client/src/providers/qwen-cloud-live-provider.ts` (mirror `ZeroGLiveProvider`).
  - Add a backend branch in `apps/api/routes/ai-live-session.js` for `provider: 'qwen-cloud'`.
- [ ] Add a `/api/ai/qwen-analyze` proxy route in `apps/web/app/api/ai/qwen-analyze/route.ts` (mirror the existing `zerog-analyze` route).
- [ ] Health endpoint: add `qwenCloud: !!process.env.DASHSCOPE_API_KEY` to the `/health` response in `server.js`.

### Phase 4 — Alibaba Cloud OSS storage adapter (deployment proof)

**Goal:** Satisfy "Proof of Alibaba Cloud Deployment" with two real Alibaba Cloud services (DashScope + OSS), not just one.

- [ ] New file `packages/storage/src/oss.ts` — Alibaba Cloud OSS adapter:
  - Uses `ali-oss` SDK (add as optional dep) or raw SigV4-style signing against `oss-<region>.aliyuncs.com`.
  - Methods: `putObject(key, buffer, contentType)`, `getObject(key)`, `signedUrl(key, ttlSec)`.
  - Env: `ALIBABA_OSS_ACCESS_KEY_ID`, `ALIBABA_OSS_ACCESS_KEY_SECRET`, `ALIBABA_OSS_BUCKET`, `ALIBABA_OSS_REGION` (default `us-west-1`).
- [ ] Mirror try-on input/output images to OSS in `apps/api/routes/agent-tryon.js`:
  - After R2 upload, also `putObject` to OSS under `tryon/{receiptId}/{role}.jpg`.
  - Make this best-effort (fail-open) so production isn't blocked if OSS is unavailable.
- [ ] This file (`packages/storage/src/oss.ts`) becomes the **proof link** in the Devpost submission.
- [ ] Add `ALIBABA_OSS_*` to `apps/api/.env.example`.

### Phase 5 — Qwen Cloud MCP server (Technical Depth rubric, 30%)

**Goal:** The rubric explicitly names "MCP integrations" as a sophistication signal. OnPoint already has an OpenAPI contract — expose it as an MCP server so any Qwen-powered agent can drive OnPoint.

- [ ] New package `packages/qwen-mcp/`:
  - `src/server.ts` — MCP server (using `@modelcontextprotocol/sdk`).
  - Tools exposed (one per OnPoint capability):
    1. `browse_curator_directory` — `GET /api/curator/directory?agentPurchasable=1`
    2. `browse_storefront` — `GET /api/curator/{slug}/storefront`
    3. `analyze_outfit` — `POST /api/ai/qwen-analyze` (uses Qwen Cloud directly)
    4. `try_on` — `POST /api/agent/try-on` (handles 402 → payment → re-POST)
    5. `buy_item` — `POST /api/curator/{slug}/order` (handles 402 → payment → re-POST)
    6. `check_earnings` — `GET /api/curator/{slug}/earnings`
    7. `list_looks` — `GET /api/looks`
    8. `create_look` — `POST /api/looks`
  - `src/tools/*.ts` — one file per tool with input schema (Zod), API call, and result formatter.
  - `src/index.ts` — stdio + HTTP transports.
  - `package.json` — depends on `@modelcontextprotocol/sdk`, `zod`.
- [ ] Add a `QWEN_MCP_*` env block (`ONPOINT_API_BASE`, `BUYER_PRIVATE_KEY` for the buy tool).
- [ ] Document in `packages/qwen-mcp/README.md` how to register the MCP server with Qwen Cloud's agent runtime.
- [ ] This is the headline Technical Depth artifact for the writeup and video.

### Phase 6 — Autopilot orchestrator (the "Autopilot Agent" demo)

**Goal:** A single entry point that demonstrates the full perceive→reason→act loop with the human-in-the-loop checkpoint on camera. This is what the 3-minute video shows.

- [ ] New script `scripts/qwen-autopilot.mjs`:
  - Input: a photo (file path or URL) + optional budget + optional curator slug.
  - Step 1 **Perceive**: call `QwenCloudClient.analyzeOutfit` + `analyzeAfricanTextile` on the photo.
  - Step 2 **Reason**: call `chatPersona` with the stylist system prompt + the analysis JSON + the user's style memory. Output: a ranked list of recommended listings from a chosen curator storefront, with fit rationale.
  - Step 3 **Act (auto)**: if the top recommendation is under $5 cUSD, run the buy flow from `scripts/agent-buyer.mjs` automatically.
  - Step 4 **Act (HITL)**: if over $5, print the recommendation + quote and wait for `y/n` approval. On approval, execute. On rejection, log and exit.
  - Step 5 **Verify**: print the Celo receipt + IPFS receipt URL.
  - `--dry-run` flag skips the actual payment.
- [ ] This script is the demo. The video shows it running on 2–3 outfit photos, including one above-$5 HITL pause.

### Phase 7 — Architecture diagram + docs

- [ ] `docs/qwen-hackathon/architecture.png` (or `.svg`) — clear visual:
  - Client: `scripts/qwen-autopilot.mjs` + web UI
  - Reasoning: **Qwen Cloud (DashScope)** — qwen-vl-max-latest, qwen-plus
  - MCP: `packages/qwen-mcp/` server
  - API: Hetzner API + Alibaba Cloud OSS (try-on artifacts)
  - Storage: Neon Postgres + Cloudflare R2 + Alibaba Cloud OSS
  - Chain: Celo (cUSD x402 payments, 0xSplits royalties)
  - Verifiability: IPFS/Filecoin receipts + Celo memo tx
  - HITL checkpoint: $5 autonomy threshold
- [ ] `docs/qwen-hackathon/SUBMISSION.md` — the Devpost text description (features, functionality, track, Alibaba Cloud proof link = `packages/storage/src/oss.ts`).
- [ ] Update `README.md` with a Qwen Cloud hackathon section linking to the diagram, video, and `docs/qwen-hackathon/SUBMISSION.md`.
- [ ] Update `docs/ARCHITECTURE.md` to add Qwen Cloud as the primary reasoning provider and Alibaba Cloud OSS as the secondary storage.

### Phase 8 — Demo video + blog post

- [ ] 3-minute YouTube video (public, unlisted-ok during judging) covering:
  1. The problem: African fashion commerce lacks an agent-accessible supply layer.
  2. Architecture diagram on screen (10s).
  3. Live demo: `scripts/qwen-autopilot.mjs` on a real outfit photo with an African textile — show Qwen Cloud identifying the pattern, recommending a curator listing, autopilot-purchasing under $5, then a second demo with a >$5 HITL approval pause.
  4. Celo receipt on Celoscan + IPFS receipt.
  5. MCP server pitch: "any Qwen-powered agent can drive OnPoint through this MCP server."
- [ ] Blog post (for the $500 Blog Post Award): "Building an African-Fashion Autopilot Agent on Qwen Cloud" — journey, architecture, what worked, what didn't. Cross-post to Devpost optional field.

## 5. Files to create

```
LICENSE                                          (Apache-2.0)
packages/qwen-cloud/
  package.json
  tsconfig.json
  src/index.ts
  src/client.ts
  src/models.ts
  src/types.ts
  src/__tests__/client.test.ts
packages/qwen-mcp/
  package.json
  tsconfig.json
  README.md
  src/index.ts
  src/server.ts
  src/tools/browse-directory.ts
  src/tools/browse-storefront.ts
  src/tools/analyze-outfit.ts
  src/tools/try-on.ts
  src/tools/buy-item.ts
  src/tools/check-earnings.ts
  src/tools/list-looks.ts
  src/tools/create-look.ts
packages/storage/src/oss.ts
packages/ai-client/src/providers/qwen-cloud-live-provider.ts
apps/api/routes/ai-qwen-analyze.js
apps/web/app/api/ai/qwen-analyze/route.ts
scripts/qwen-autopilot.mjs
docs/qwen-hackathon/architecture.svg
docs/qwen-hackathon/SUBMISSION.md
```

## 6. Files to modify

```
README.md                          — hackathon section + license
package.json                       — license field
apps/api/server.js                 — mount qwen-analyze route, /health field
apps/api/.env.example              — DASHSCOPE_API_KEY, QWEN_CLOUD_*, ALIBABA_OSS_*
apps/web/.env.example              — same where needed
apps/api/routes/agent-tryon.js     — best-effort OSS mirror
packages/ai-client/src/providers/live-session-factories.ts — add qwenCloudFactory, prepend to chains
packages/ai-client/src/index.ts    — export QwenCloudLiveProvider
apps/api/routes/ai-live-session.js — qwen-cloud branch
docs/ARCHITECTURE.md               — Qwen Cloud + Alibaba OSS in the diagram + tables
```

## 7. Sequencing & estimated effort

| Phase | Depends on | Effort | Risk |
|---|---|---|---|
| 1. License + repo hygiene | — | 30 min | none |
| 2. Qwen Cloud client | 1 | 1 day | low — DashScope is OpenAI-compatible, port is mechanical |
| 3. API route + live-session wiring | 2 | 0.5 day | low — mirrors existing 0G wiring |
| 4. Alibaba Cloud OSS adapter | 1 | 0.5 day | low — `ali-oss` SDK is well-documented |
| 5. Qwen Cloud MCP server | 2, 3 | 1 day | medium — first MCP server in this repo; need to validate tool schemas |
| 6. Autopilot orchestrator | 2, 3, 5 | 0.5 day | low — reuses `agent-buyer.mjs` patterns |
| 7. Architecture diagram + docs | 2, 3, 4, 5, 6 | 0.5 day | none |
| 8. Video + blog | 7 | 0.5–1 day | low — content, not code |

**Total: ~4–5 focused days.** Phases 2, 4, and 5 are the highest-leverage for the rubric.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| DashScope model names differ from 0G Router's | Verify against `https://dashscope.aliyuncs.com/compatible-mode/v1/models` before coding Phase 2. Fallback to `qwen-vl-plus` if `qwen-vl-max-latest` is unavailable. |
| Qwen Cloud free trial credits run out during demo recording | Record the demo in one session; keep `--dry-run` recordings as backup. |
| Alibaba Cloud OSS signup requires real-name verification (China region) | Use a non-China region (`us-west-1` or `ap-southeast-1`) to avoid the China ICP/real-name requirement. |
| MCP server is new territory for this repo | Phase 5 has its own validation step — run the MCP server against the inspector (`@modelcontextprotocol/inspector`) before wiring it into the demo. |
| Judges may not understand the African fashion angle | Lead the video and writeup with it. Make `analyzeAfricanTextile` a named, visible method — not a hidden prompt. |
| Hetzner API is the deploy target, not Alibaba Cloud | The rules require *proof of Alibaba Cloud services usage*, not full migration. DashScope + OSS is sufficient. Do NOT migrate the whole API — that's out of scope and risky. |

## 9. What NOT to do

- Do NOT migrate the whole backend to Alibaba Cloud. DashScope + OSS is enough.
- Do NOT remove the 0G Router or Venice paths — keep them as fallbacks. Qwen Cloud becomes primary, others become secondary.
- Do NOT enter Track 3 (Agent Society). The autopilot loop is single-agent with tool calls; reframing as multi-agent would dilute the story.
- Do NOT add Qwen Cloud as a new "provider card" in the web UI for the hackathon — the demo is the autopilot script + MCP server, not a UI toggle. UI polish can come after.
- Do NOT skip the LICENSE file. It's a hard requirement and a 30-second fix.

## 10. Submission checklist (final)

- [ ] Public GitHub repo with Apache-2.0 LICENSE visible in About
- [ ] Track 4 declared in Devpost submission
- [ ] Code repo URL on Devpost
- [ ] Proof of Alibaba Cloud Deployment link: `packages/storage/src/oss.ts`
- [ ] Architecture diagram: `docs/qwen-hackathon/architecture.svg`
- [ ] 3-min YouTube video, public
- [ ] Text description: `docs/qwen-hackathon/SUBMISSION.md` (paste into Devpost)
- [ ] Optional blog post URL for the $500 Blog Post Award
- [ ] Qwen Cloud is the primary reasoning provider in the demo (not 0G, not Venice)
- [ ] Demo shows: perceive → reason → act (auto <$5) → act (HITL >$5) → verifiable receipt
- [ ] Demo shows the African textile recognition capability by name

## 11. Open questions for the user

1. **Qwen Cloud account + DashScope API key** — do you already have a Qwen Cloud account and key, or do I need to plan around the signup flow?
2. **Alibaba Cloud account + OSS bucket** — same question. Need region preference (recommend `us-west-1` to avoid China real-name verification).
3. **Celo wallet with cUSD** — the autopilot demo needs a funded wallet for the live on-chain purchase. Is the existing `BUYER_PRIVATE_KEY` wallet funded, or should the demo use `--dry-run` only?
4. **Video recording setup** — do you want to record the 3-min video yourself with my script/shot-list, or have me produce a HyperFrames composition? (HyperFrames would add ~1 day.)
5. **MCP server runtime** — should the MCP server run as a standalone stdio process (simplest for the demo), or also as an HTTP endpoint on the Hetzner API (more production-y, more work)?
