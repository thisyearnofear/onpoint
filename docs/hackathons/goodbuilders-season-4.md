# GoodBuilders Season 4 — Celo Distributing G$

> Program: [GoodBuilders Season 4](https://gooddollar.org) (run in partnership with Flow State)
> Format: 3-month continuous funding round · $50K USD streamed in G$ via GoodDollar's native Superfluid capabilities
> Goal: ship three live G$ integrations on Celo mainnet that grow the GoodDollar ecosystem, then apply with measurable KPIs.

---

## TL;DR

OnPoint is a curator-first AI styling app: upload a photo, get a critique from an AI persona (Miranda Priestly, Edina Monsoon, John Shaft — or premium personas like Anna Wintour / Virgil Abloh / Stella McCartney), discover matching products, and tip or subscribe to curators. ERC-8004-registered self-custodial agent wallet on Celo (agent ID 9177).

G$ is the **free, no-card-needed path to premium styling.** Celo's audience skews toward users where card access is limited; G$ UBI gives them purchasing power for premium AI services they otherwise couldn't access. This is the genuine product value — not a bolted-on chore.

### The G$ value loop

```
Claim G$ daily (free UBI via @goodsdks/citizen-sdk — gas sponsored, face-verified)
   ↓
G$ funds premium styling sessions (per-session G$ cost: 1k–3k G$ ≈ $0.10–0.30)
   ↓
Use a premium persona (Anna Wintour / Virgil Abloh / Stella McCartney)
   ↓
Tip your curator in G$ (TipModal + TipTokenPicker) — G$ circulates in the ecosystem
   ↓
Stream G$ to a curator you love (GStreamPanel — Superfluid per-second payments)
   ↓
Build a Style Streak — consecutive daily claims unlock premium personas PERMANENTLY
   ↓
"Protect" your streak — claim daily to keep advancing. Positive-only: missing a day
   forfeits the next bonus but NEVER revokes perks already earned. Your G$ is
   self-custodied; the streak is positive reinforcement, not a trap.
   ↓
Continue claiming daily → the loop sustains premium access + creator support
```

This is the loop the S4 reviewers asked for: **Claim G$ → Build a savings streak → Protect savings → Continue claiming daily.** "Savings" = accrued style perks (premium personas unlocked via streak badges). "Protect" = maintain your daily claim habit so your streak keeps advancing (opportunity cost, not punishment — earned badges are permanent).

### Why the loop works: real premium value gap

The G$ loop only works if paying G$ for a premium persona delivers a **genuinely better experience** than the free tier. If premium is just a personality reskin, the loop is theater.

Premium personas produce **structurally richer output** than free personas:

| Aspect | Free personas (Miranda/Edina/Shaft) | Premium personas (Anna/Virgil/Stella) |
|---|---|---|
| Token limit | 500 | 800 |
| Output structure | Generic 6-point analysis | Structured: Score + Verdict + Brand Picks (with price ranges) + Next Level |
| Brand recommendations | General references | Specific brands + approximate price ranges |
| Scoring | None | X/10 score with justification |
| Actionability | General suggestions | Specific product recommendations with cost |

This gap is made **visible at the point of friction**: locked premium persona cards show a "Preview their style" link that expands to show an example of the structured output (score, brand picks, price ranges). The user sees exactly what they'd get before deciding to claim G$ and pay for a session.

### Wallet-first: the loop works without an account

The G$ loop is **wallet-first** — no Auth0 account required. A wallet-only user can:

1. **Claim G$** — citizen-sdk + wagmi (wallet-only by design)
2. **Build a streak** — localStorage (wallet-only)
3. **Pay G$ for premium sessions** — wagmi ERC-20 transfer (wallet-only)
4. **See streak mission progress** — wallet-based fallback in `useMissionState` + `/api/agent/missions`

Auth0 is a convenience layer (subscriptions, preferences, external account connections) — not a gate for the G$ loop. The `/api/agent/missions` endpoint accepts wallet-based auth for `g-claim-streak` events, and `useMissionState` falls back to the wallet address when Auth0 is absent.

### Where the loop is surfaced

| Surface | What the user sees | When |
|---|---|---|
| HomePanel (Day 0) | "Unlock premium stylists with free G$" card with milestone path + connect wallet CTA | Before first claim |
| HomePanel (Day 1+) | GStreakPill with streak count, next milestone, protect prompt | After first claim |
| VirtualTryOn (locked personas) | "Preview their style" → structured output snippet + G$ cost + "No G$ yet? Claim below" | When viewing locked premium personas |
| AgentStatus (compact) | "Claim G$" pill (Day 0) or streak count (Day 1+) | Always visible in status bar |

The loop is **not surfaced on the landing page** — introducing G$ before the user has tried the product adds cognitive load at the wrong moment. The user first experiences free styling, then discovers G$ when they hit the premium wall.

### Four G$ integrations on Celo mainnet

1. **G$ UBI claim** (`GClaimCTA` + `@goodsdks/citizen-sdk`) — daily claim with gas faucet + face verification. Surfaces in `AgentStatus` (`GBalancePill`), `AddFundsButton`, and `/curator/onboard`.
2. **G$ per-session premium access** (`useGSessionPayment` + `VirtualTryOn` persona gate) — pay 1k–3k G$ per premium styling session. The core "G$ has real value" surface: G$ is the no-card on-ramp to premium AI styling.
3. **G$ tip jar** (`TipModal` + `TipTokenPicker`) — every post-session tip can be paid in cUSD or G$. Score-gated G$ amounts (1k–20k G$).
4. **G$ streaming subscriptions** (`GStreamPanel` + Superfluid `CFAv1Forwarder`) — per-second G$ streams to curators. Directly mirrors S4's funding mechanism.

Plus the **G$ Style Streak** (`useGStreak` + `GStreakPill` + `g-streak-config`) — the retention loop that ties daily claims to premium persona unlocks via the existing `MissionService` badge system.

All hang off one package, `@repo/gooddollar`, that supplies addresses, ABIs, claim helpers, and Superfluid stream helpers. No parallel "gooddollar" packages, no copy-pasted ERC-20 utilities.

## Why now

S4 requires a **live G$ integration before or at the start of the season**. The current repo has zero GoodDollar touchpoints (verified by grep across `gooddollar`, `G$`, `ubi`, `claim`, `goodprotocol`). Shipping these three integrations in the next 2–4 weeks moves the project from "ineligible" to "credible applicant."

The 0G Bridge Buildathon (current primary focus, ends Aug 21) does not conflict — G$ integrations are an enhancement to the existing agent wallet stack, not a competing initiative.

## Verified facts

- G$ on Celo mainnet: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` (SuperGoodDollar SuperToken, 18 decimals) — verified against `@goodsdks/citizen-sdk` v1.2.5 and GoodDollar docs
- G$ is a **native Superfluid SuperToken** on Celo — no wrapping needed. `CFAv1Forwarder.createFlow()` works directly.
- GoodDollar on Celo uses **three separate contracts**: Identity (`0xC361...`) for whitelist/FV, UBIScheme (`0x43d7...`) for claims, Faucet (`0x4F93...`) for gas sponsorship
- `@goodsdks/citizen-sdk` (viem-based, 2 deps) provides `ClaimSDK` + `IdentitySDK` with gas faucet, face verification (`generateFVLink`), and connected-wallet detection (`getWhitelistedRoot`)
- Superfluid CFAv1Forwarder on Celo: `0xcfA132E353cB4E398081B7F68C40dA562f0Fa1Da`
- Existing tip infra: `apps/api/routes/agent-tip.js` (record-only), `agent-tip-agent.js` (real on-chain via signer), `apps/web/components/Agent/TipModal.tsx` (real wagmi `writeContract`).
- Existing Superfluid slot: `subscription-service.ts` already has `paymentMethod: "superfluid"` but stores `flowRate` only — no on-chain flow creation yet. S4 implementation closes that TODO.
- Existing onboard: `apps/web/app/curator/onboard/page.tsx` → POST `/api/curator/apply`. No wallet, no claim.

## What ships

| Surface | Status | Notes |
|---|---|---|
| `@repo/gooddollar` package | **Shipped** | Single source of truth for G$ addresses, ABIs, claim helpers, streaming helpers, balance reads |
| `packages/gooddollar/src/addresses.ts` | **Shipped** | Split Identity / UBIScheme / Faucet / G$ token / CFA Forwarder (verified against citizen-sdk v1.2.5) |
| `packages/gooddollar/src/claim.ts` | **Shipped** | `getClaimStatus` (getWhitelistedRoot + checkEntitlement) + `claimUBI` with simulation + revert decoding |
| `packages/gooddollar/src/streaming.ts` | **Shipped** | `createGStream` / `updateGStream` / `deleteGStream` / `getFlowRate` / `getTotalFlowRate` + `monthlyToFlowRate` / `flowRateToMonthly` |
| `packages/gooddollar/src/balance.ts` | **Shipped** | `getGBalanceSnapshot` (30s cache) + `formatGAmount` |
| `packages/gooddollar/src/__tests__/` | **Shipped** | 23 tests (claim + balance + streaming), all passing |
| `@goodsdks/citizen-sdk` dep in `apps/web` | **Shipped** | ClaimSDK + IdentitySDK for gas faucet, FV redirect, connected-wallet detection |
| `apps/web/lib/services/g-claim-service.ts` | **Shipped** | Wrapper using citizen-sdk: createIdentitySDK, createClaimSDK, checkWhitelist, checkEntitlement, generateFVLink, claimUBI |
| `apps/web/lib/services/g-stream-service.ts` | **Shipped** | Thin wrapper: openStream, updateStream, closeStream, getStreamMonthly, getTotalOutgoingMonthly |
| `apps/web/components/Curator/GClaimCTA.tsx` | **Shipped** | Full claim flow: disconnected → wrong-chain → not-whitelisted (FV) → can-claim → claiming → success → cooldown. Wired to streak on success. |
| `apps/web/components/Curator/GBalancePill.tsx` | **Shipped** | Persistent G$ balance indicator with 30s cache, expandable claim CTA, in AgentStatus |
| `apps/web/components/Curator/GStreamPanel.tsx` | **Shipped** | Superfluid streaming subscription panel with preset amounts, active stream management |
| `apps/web/components/Curator/GStreakPill.tsx` | **Shipped** | G$ Style Streak surface — streak count, active perks, next milestone, "protect your streak" prompt. Compact (AgentStatus) + full card (HomePanel). Day 0 state: "Unlock premium stylists with free G$" card with milestone path + connect wallet CTA, visible to users who haven't claimed yet. |
| `apps/web/lib/utils/g-streak-config.ts` | **Shipped** | Streak milestones (3/7/14/30 days) → badges → persona unlocks. Single source of truth. 12 tests. |
| `apps/web/lib/hooks/use-g-streak.ts` | **Shipped** | Claim-driven streak hook (positive-only, localStorage). Replaces visit-based streak in HomePanel. |
| `apps/web/lib/hooks/use-g-session-payment.ts` | **Shipped** | Per-session G$ payment hook — ERC-20 transfer to agent wallet. Reuses TipModal's wagmi pattern. |
| `apps/web/lib/utils/persona-config.ts` | **Shipped** | Added `gCost` to premium personas (1k/2k/3k G$). Streak badges as alt-unlock path. `canPayWithG` + `getGSessionCost` helpers. `previewSnippet` field with example structured output for locked card previews. |
| `apps/web/components/VirtualTryOn.tsx` | **Shipped** | Premium persona gate: unlocked → direct access; locked + G$ payable → per-session payment confirm → on tx confirm, session runs. Streak badges merged into unlock check. "No G$ yet? Claim free daily G$ below" hint on premium persona wall. |
| `apps/web/components/VirtualTryOn/PersonalityCard.tsx` | **Shipped** | Shows G$ cost badge on locked premium cards; G$-payable cards are clickable (open payment confirm). "Preview their style" link expands to show a snippet of the premium output (scores, brand picks, price ranges) — makes the value gap visible at the point of friction. |
| `packages/ai-client/src/services/personality-service.ts` | **Shipped** | Premium personas (luxury/streetwear/sustainable) now produce structured output: Score + Verdict + Brand Picks (with price ranges) + Next Level. Token limit raised from 500 → 800 for premium. Free personas keep the generic 6-point analysis. |
| `apps/web/app/api/ai/personality-critique/route.ts` | **Shipped** | Respects persona-specific `maxTokens` (was silently capping all at 400). Detects premium personas and skips the generic 6-point prompt structure, letting the persona's own structured output instructions drive the response. |
| `apps/web/components/Dashboard/HomePanel.tsx` | **Shipped** | Uses `useGStreak` (replaces visit-streak); GStreakPill card in the home dashboard. GStreakPill Day 0 state surfaces the G$ loop entry point to new users who haven't claimed yet. |
| `apps/web/lib/services/mission-service.ts` | **Shipped** | 4 streak missions (3/7/14/30 days) + `g-claim-streak` event type. Streak progress SET (not increment) to handle resets. |
| `apps/web/components/Agent/AgentStatus.tsx` | **Shipped** | GStreakPill (compact) next to GBalancePill. |
| `apps/web/components/Agent/AddFundsButton.tsx` | **Shipped** | "Claim G$ instead" tile + unified success state with auto-close |
| `apps/web/app/curator/onboard/page.tsx` | **Shipped** | Collapsible G$ UBI claim section |
| `apps/web/app/s/[slug]/page.tsx` | **Shipped** | GStreamPanel in curator storefront sidebar (shows when curator has `commerce.walletAddress`) |
| `Curator.commerce.walletAddress` | **Shipped** | Added to shared-types for G$ streaming destination |
| `getTokenAddress("GOOD_DOLLAR", "celo")` in `chains.ts` | **Shipped** | Used by TipModal + useGSessionPayment to resolve G$ token address |
| `"G$"` in spend-policy allowlist | **Shipped** | One line in `spend-policy.ts` |
| `"ubi_claim"` action type in `AgentControls` | **Shipped** | Owns its own daily cap + audit trail |
| **I1: G$ tip jar** in `TipModal` + `AgentStatus` | **Shipped** | TipTokenPicker (cUSD/G$), score-gated G$ amounts (1k–20k G$), G$ Tips stat tile in AgentStatus |
| `apps/web/components/Agent/TipTokenPicker.tsx` | **Shipped** | Segmented control for selecting cUSD or G$ UBI as tip currency |
| KPI dashboard action types | **Shipped** | `tip_g$`, `claim`, `stream_g$`, `session_g$` via countAction + POST /api/agent/metrics |
| `apps/web/lib/utils/metrics.ts` | **Shipped** | Fire-and-forget client-side metric recording for claim + stream_g$ + session_g$ actions |
| `apps/api/routes/agent-metrics.js` POST endpoint | **Shipped** | Accepts `{ action, status }` from client, records via `Metrics.countAction()` |

## What we explicitly will **not** build

Per **PREVENT BLOAT** and **CONSOLIDATION**:

- No parallel "gooddollar" route group — existing `agent-tip.js`, `subscription-service.ts`, `curator-apply.js` get one new branch each.
- No GoodDollar mini-app or standalone dapp.
- No G$ as a payment rail for actual product checkout. G$ is ~$0.0001 with high volatility — wrong medium for commerce.
- No GoodDollar V2 (V4) protocol migration work.
- No GoodDollar Reserve, Savings (sG$), or DAO governance integration.
- No GoodDollar face-verification backend — handled by `@goodsdks/citizen-sdk`'s `generateFVLink()` which opens GoodDollar's hosted FV flow in-app.

## Architecture (Core Principles compliance)

```
┌──────────────────────────┐    tip / claim / stream    ┌────────────────────┐
│ apps/web                 │ ─────────────────────────▶ │ apps/api           │
│ TipModal (extended)      │                            │ agent-tip.js       │
│ AddFundsButton (extended)│                            │ (record-only)      │
│ CuratorOnboard (extended)│                            │                    │
└──────────────────────────┘                            └────────┬───────────┘
                                                                │ uses
                                                                ▼
                                                  ┌──────────────────────────┐
                                                  │ @repo/gooddollar         │
                                                  │ (single source of truth) │
                                                  └────────┬─────────────────┘
                                                           │
                            ┌──────────────────────────────┼──────────────────────────┐
                            ▼                              ▼                          ▼
                     addresses.ts (SSOT)        claim.ts (UBI)            streaming.ts (Superfluid)
                     abis.ts (ERC20/Claim/CFA)   balance.ts (cached reads)  types.ts
```

### How each principle is honoured

- **Enhancement First** — Each integration adds one branch to an existing surface (`token: "G$"` in tip route, `paymentMethod: "superfluid-G$"` in subscription, one CTA in onboard). No new pages, no new top-level routes, no new packages at the app level.
- **Consolidation** — The hardcoded `CUSD_ADDRESS` literal in `TipModal.tsx:32` and the `cUSDAddress` lookup in `agent-tip-agent.js:166` collapse into `getTokenAddress("GOOD_DOLLAR", chain)` from `chains.ts`. The TODO at `subscription/route.ts:158` (`// For Superfluid: verify flow rate on-chain`) gets implemented, not bypassed.
- **Prevent Bloat** — One new package (`@repo/gooddollar`), ~6 source files. Zero new env-var prefixes. Zero new payment endpoints.
- **DRY** — Token addresses, ABIs, RPC client construction, and stream math live in exactly one place (`@repo/gooddollar`). The three integrations import from it.
- **Modular** — `addresses`, `abis`, `claim`, `streaming`, `balance`, `types` are independently importable subpaths. No consumer has to take more than what they need.
- **Clean** — No HTTP calls in `streaming.ts`. No RPC client construction in `addresses.ts`. No claim math in the UI. The `GClaimCTA` component owns the UI only; the server-side ledger integration is one Redis write.
- **Performant** — G$ price feed (CoinGecko) cached 5 minutes. G$ balance cached 30 seconds per address. Stream rate reads cached 60 seconds per `(user, recipient)` pair.
- **Organised** — `@repo/gooddollar` follows the same shape as `@repo/etherfuse` and `@repo/agent-core`: `src/index.ts` barrel, `tsup` build to `dist/index.cjs`, subpath exports per module.

## Cross-cutting enablers (first PR)

These are prerequisites for all three integrations. Implement as one audit pass.

### E1. Extend `packages/agent-core/src/chains.ts`

Add `GOOD_DOLLAR` to `TOKEN_ADDRESSES` (Celo only). Add helpers `getGTokenAddress(chain)` and `isSuperfluidNativeToken(symbol, chain)`.

### E2. Extend spend-policy allowlist

One line in `apps/web/lib/services/spend-policy.ts` — add `"G$"` to `allowedTokens`.

### E3. Extend `ActionType`

Add `"ubi_claim"` to `packages/agent-core/src/agent-controls.ts`. Add a `DEFAULT_LIMITS.ubi_claim` entry with `perActionLimit: parseEther("1")`, `requiresApproval: false`, `dailyLimit: parseEther("1")`. Per-action and daily caps are enforced at the app layer because GoodDollar's `ClaimFacet` enforces its own rate limit on-chain — the cap is just to make our audit trail honest.

### E4. Mission-service allowlist (skipped)

Reviewed `apps/web/lib/services/mission-service.ts`. No token allowlist present. Skip.

## `@repo/gooddollar` package (skeleton + helpers)

```
packages/gooddollar/
├── src/
│   ├── addresses.ts        # GOOD_DOLLAR_ADDRESSES, CFAv1Forwarder address, ClaimFacet address (SSOT)
│   ├── abis.ts             # Minimal ABIs (ERC-20 transfer/balance, ClaimFacet, Superfluid CFAv1Forwarder)
│   ├── claim.ts            # claimUBI(publicClient, walletClient) → tx
│   ├── streaming.ts        # createGStream / updateGStream / deleteGStream / getFlowRate
│   ├── balance.ts          # Cached G$ balance + stream rate helpers
│   ├── types.ts            # GClaimResult, GStreamParams, etc.
│   └── index.ts            # barrel
├── test/
│   ├── claim.test.ts
│   └── streaming.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

Dependencies: `viem` (already in workspace) + `@superfluid-finance/sdk-core` (new, only if streaming helpers benefit from it — otherwise raw viem writes to CFAv1Forwarder keep the dep surface smaller). **Decision**: start raw-viem only; add SDK only if a helper actually demands it. Stays in line with **PREVENT BLOAT**.

## Integration 1 — G$ tip jar on AgentStatus

**Highest visibility, lowest risk.** S4's most-frequent user surface.

**Files modified:**

- `apps/api/routes/agent-tip.js` — accept `token: "G$"`, derive address from `agent-core.getTokenAddress("GOOD_DOLLAR", chain)`. Schema already polymorphic (no DB change).
- `apps/api/routes/agent-tip-agent.js:166` — replace hardcoded `agentCore.ERC20?.getCUSDAddress?.(chain)` with token-resolver that picks `GOOD_DOLLAR` on Celo when `req.body.token === "G$"`.
- `apps/web/components/Agent/TipModal.tsx:32` — delete the `const CUSD_ADDRESS` literal; read from `getTokenAddress("GOOD_DOLLAR", chain)` when G$ is selected. Add `<TipTokenPicker />` segmented control.
- `apps/web/components/Agent/AgentStatus.tsx` — add a "G$ Tips this week" stat tile next to existing wallet balance tile.

**Files added:**

- `apps/web/components/Agent/TipTokenPicker.tsx` — ~50-line segmented control.

**Display math:** G$ amounts are 18-decimal but USD-tiny. Render as "1,000 G$" rather than "0.0001 cUSD equivalent". `formatGAmount()` helper lives in `packages/gooddollar/balance.ts`.

## Integration 2 — G$ streaming for curator subscriptions

Directly mirrors S4's funding mechanism (Superfluid streams of G$).

**Files modified:**

- `apps/web/lib/services/subscription-service.ts:38` — extend `paymentMethod` enum: `"stripe" | "superfluid-cUSD" | "superfluid-G$" | "manual"`. The existing `"superfluid"` slot becomes `"superfluid-cUSD"` for backward compat.
- `apps/web/lib/services/subscription-service.ts:227` — extend `upgradeSubscription` to accept the new union, store `superfluidGTokenFlowRate` separately.
- `apps/web/app/api/auth/subscription/route.ts:36` — extend `UpgradeSchema` enum; replace the TODO at line 158 (`// For Superfluid: verify flow rate on-chain`) with actual `verifyGStreamRateOnChain(userWallet, expectedRatePerMonth)`.
- `apps/web/app/pricing/page.tsx:657` — replace "crypto (ETH/cUSD via Celo/Superfluid)" with G$ Superfluid streams as a first-class row.

**Files added:**

- `apps/web/lib/services/g-stream-service.ts` — thin wrapper mapping subscription tier to G$ flow rate via cached `getGUSDPrice()` (CoinGecko, 5-min TTL). Single place that knows tier ↔ flow rate math.

**Price-volatility handling:** flow rate is fixed at stream creation. We snapshot the G$ price at stream start, lock the rate, and accept drift over the 30-day period. Documented clearly on the pricing page.

## Integration 3 — G$ claim onboarding hook

**Highest leverage for S4's "growing the GoodDollar ecosystem" KPI.**

**Files modified:**

- `apps/web/app/curator/onboard/page.tsx` — after existing form fields, before "Create storefront", add a collapsed "Claim your daily G$ UBI" section. Expands on click. Shows "Claim 1.00 G$" CTA when wallet connected and not yet claimed today, "Come back in 12h 23m" countdown otherwise, "Switch to Celo (free, ~2s)" button on non-Celo chains.
- `apps/web/components/Agent/AddFundsButton.tsx` — when modal opens, add "Claim G$ instead" tile above Etherfuse fiat options.

**Files added:**

- `apps/web/components/Curator/GClaimCTA.tsx` — the on-board UI component (~80 lines). Reusable in both `AddFundsButton.tsx` and `curator/onboard/page.tsx`. Composable: takes `onClaimed` callback, doesn't own success UX.
- `apps/web/lib/services/g-claim-service.ts` — `getClaimStatus(address)` reads `lastClaim` from GoodDollar's Identity contract, returns "next claim in" string. Cached 60s.

**Error surfacing:** if revert reason is `NotIdentityVerified` or similar, link to GoodDollar's verification flow. Don't swallow the error.

## KPI dashboard (S4 application evidence)

Once shipped, each integration produces a measurable surface:

| KPI | Source | Target (12 weeks) |
|---|---|---|
| # of G$ UBI claims | `agent_actions_total{type="claim",status="succeeded"}` | 500 |
| # of unique claimers | on-chain `UBIScheme.claim` events | 50 |
| # of premium sessions paid in G$ | `agent_actions_total{type="session_g$",status="succeeded"}` | 200 |
| # of G$ tips sent to curators | `agent:tip-ledger:v1` filter `token=G$` | 300 |
| Total G$ tipped | same | 30,000 G$ |
| # of G$ streaming subs active | `subscription:*` filter `paymentMethod=superfluid-G$` | 10 |
| Total G$ streamed to curators | on-chain CFAv1 events | 1,000,000 G$ (~$100) |
| # of users reaching 7-day streak | `mission:*` filter `missionId=g-streak-7` completed | 25 |
| # of users reaching 30-day streak | `mission:*` filter `missionId=g-streak-30` completed | 5 |

Tracking via `packages/agent-core/src/metrics.ts` (already exports `Metrics.countAction(actionType, status)`). Action types: `"tip_g$"`, `"claim"`, `"stream_g$"`, `"session_g$"`. Streak milestones via `MissionService` (g-streak-3/7/14/30).

## Execution order

1. ~~E1–E3 cross-cutting enablers~~ ✅ Shipped
2. ~~`@repo/gooddollar` skeleton + addresses + ABIs + types~~ ✅ Shipped
3. ~~`packages/gooddollar/src/claim.ts` + test~~ ✅ Shipped
4. ~~**Integration 3: G$ claim onboarding**~~ ✅ Shipped — uses citizen-sdk for FV + gas faucet
5. ~~`packages/gooddollar/src/streaming.ts` + test~~ ✅ Shipped
6. ~~**Integration 2: G$ streaming subs**~~ ✅ Shipped — GStreamPanel on curator storefronts
7. ~~`packages/gooddollar/src/balance.ts`~~ ✅ Shipped — GBalancePill in AgentStatus
8. ~~**Integration 1: G$ tip jar**~~ ✅ Shipped — TipTokenPicker + G$ amounts in TipModal
9. ~~KPI dashboard action types~~ ✅ Shipped — tip_g$, claim, stream_g$ via countAction + POST /api/agent/metrics
10. ~~**G$ value loop: per-session premium access + Style Streak**~~ ✅ Shipped — `useGSessionPayment` (per-session G$ cost for premium personas), `useGStreak` + `GStreakPill` + `g-streak-config` (claim-driven streak → badges → persona unlocks), streak missions in MissionService, GStreakPill in AgentStatus + HomePanel, `session_g$` metric
11. ~~**Wallet-first G$ loop**~~ ✅ Shipped — `/api/agent/missions` accepts wallet-based auth for `g-claim-streak` events, `useMissionState` falls back to wallet address when Auth0 is absent, Upstash Redis deep health check in `/api/health?deep=true`
12. ~~**Premium value gap + loop surfacing**~~ ✅ Shipped — Premium personas produce structurally richer output (800 tokens, Score + Brand Picks + Price Ranges + Next Level), `previewSnippet` on locked persona cards makes the gap visible, GStreakPill Day 0 state surfaces the loop to new users, "No G$ yet?" hint on premium persona wall
13. S4 application write-up (pending — apply at https://ubi.gd/4oiCPk7)

All code shipped. Remaining: deploy, mainnet smoke test, apply on Flow State.

## Verification

```bash
pnpm install                                # picks up @repo/gooddollar workspace
pnpm turbo run check-types --filter=@repo/gooddollar
cd apps/web && npx tsc --noEmit             # web app typecheck (includes G$ loop)
cd packages/gooddollar && npx vitest run    # 23 package tests
cd apps/web && npx vitest run lib/utils/__tests__/g-streak-config.test.ts  # 12 streak config tests
# Manual smoke: Celo mainnet, open AgentStatus, claim G$ (streak advances), 
# select a locked premium persona → pay G$ per session, tip curator in G$,
# open a G$ stream to a curator storefront
```

## Risk register

| Risk | Mitigation |
|---|---|
| G$ price volatility breaks USD-denominated subs | Snapshot price at stream creation, document drift |
| Curators on non-Celo chains can't claim | Detect + one-click `switchChain(celo)` via wagmi |
| GoodDollar's `ClaimFacet` reverts for unverified identities | Surface revert reason verbatim + link to GoodDollar verification flow |
| Hardcoded `CUSD_ADDRESS` in TipModal missed in audit | Single audit pass in E1 removes both hardcodings |
| `superfluid` enum change breaks callers | `"superfluid"` → `"superfluid-cUSD"` migration handled in subscription-service's `upgradeSubscription` with a default branch |
| `Mission` UI never gets G$ claims wired in | Out of scope per E4; revisit after S4 if engagement metric justifies |

## Related decisions

- ADR 0009 — GoodDollar G$ Integration (new): the architectural decision that this plan implements.

## Links

- GoodBuilders Season 4: https://gooddollar.org
- G$ on CeloScan: https://celoscan.io/token/0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
- GoodDollar docs — core contracts: https://docs.gooddollar.org/for-developers/core-contracts
- GoodDollar docs — Sybil Resistance / Identity SDK: https://docs.gooddollar.org/for-developers/apis-and-sdks/sybil-resistance
- `@goodsdks/citizen-sdk` on npm: https://www.npmjs.com/package/@goodsdks/citizen-sdk
- Superfluid CFAv1Forwarder on Celo: `0xcfA132E353cB4E398081B7F68C40dA562f0Fa1Da`
