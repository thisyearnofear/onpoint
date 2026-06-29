# GoodBuilders Season 4 — Celo Distributing G$

> Program: [GoodBuilders Season 4](https://gooddollar.org) (run in partnership with Flow State)
> Format: 3-month continuous funding round · $50K USD streamed in G$ via GoodDollar's native Superfluid capabilities
> Goal: ship three live G$ integrations on Celo mainnet that grow the GoodDollar ecosystem, then apply with measurable KPIs.

---

## TL;DR

OnPoint is a curator-first styling + retail intelligence platform with an ERC-8004-registered self-custodial agent wallet on Celo (agent ID 9177). The existing tip, subscription, and onboarding surfaces already run on Celo mainnet — the integration shape is well-defined. This plan adds GoodDollar's G$ as a **first-class token** in three places:

1. **G$ tip jar** on `AgentStatus` — every post-session tip can be paid in cUSD or G$. Lowest risk, highest visibility.
2. **G$ streaming subscriptions** for curators — pay for Pro/Concierge tiers via second-by-second Superfluid G$ flows. Directly mirrors S4's funding mechanism.
3. **G$ UBI claim hook** at `/curator/onboard` and inside `AddFundsButton` — first-time curators can claim their daily G$ on signup. Highest leverage for S4's "growing the ecosystem" KPI.

All three hang off one new package, `@repo/gooddollar`, that supplies addresses, ABIs, claim helpers, and Superfluid stream helpers. No parallel "gooddollar" packages, no copy-pasted ERC-20 utilities.

## Why now

S4 requires a **live G$ integration before or at the start of the season**. The current repo has zero GoodDollar touchpoints (verified by grep across `gooddollar`, `G$`, `ubi`, `claim`, `goodprotocol`). Shipping these three integrations in the next 2–4 weeks moves the project from "ineligible" to "credible applicant."

The 0G Bridge Buildathon (current primary focus, ends Aug 21) does not conflict — G$ integrations are an enhancement to the existing agent wallet stack, not a competing initiative.

## Verified facts

- G$ on Celo mainnet: `0x62B8B1109F25406f3D27cDaA3F8d2305d6eDbBB7` (ERC-20, 18 decimals)
- G$ is a **native Superfluid SuperToken** on Celo — no wrapping needed. `CFAv1Forwarder.createFlow()` works directly. Confirmed by GoodDollar's official docs (`docs.gooddollar.org/.../use-gusd-streaming`).
- Existing tip infra: `apps/api/routes/agent-tip.js` (record-only), `agent-tip-agent.js` (real on-chain via signer), `apps/web/components/Agent/TipModal.tsx` (real wagmi `writeContract`).
- Existing Superfluid slot: `subscription-service.ts` already has `paymentMethod: "superfluid"` but stores `flowRate` only — no on-chain flow creation yet. S4 implementation closes that TODO.
- Existing onboard: `apps/web/app/curator/onboard/page.tsx` → POST `/api/curator/apply`. No wallet, no claim.

## What ships

| Surface | Status | Notes |
|---|---|---|
| `@repo/gooddollar` package | Planned | Single source of truth for G$ addresses, ABIs, claim helpers, streaming helpers |
| `getTokenAddress("GOOD_DOLLAR", "celo")` in `chains.ts` | Planned | Replaces hardcoded `CUSD_ADDRESS` const in TipModal |
| `isSuperfluidNativeToken(symbol, chain)` helper | Planned | Returns true only for G$ on Celo |
| `"G$"` in spend-policy allowlist | Planned | One line in `spend-policy.ts` |
| `"ubi_claim"` action type in `AgentControls` | Planned | Owns its own daily cap + audit trail, separate from tip/purchase |
| `packages/gooddollar/src/claim.ts` | Planned | `claimUBI(publicClient, walletClient)` → tx |
| `packages/gooddollar/src/streaming.ts` | Planned | `createGStream` / `updateGStream` / `deleteGStream` / `getFlowRate` |
| `packages/gooddollar/src/balance.ts` | Planned | Cached G$ balance + stream rate reads |
| **I1: G$ tip jar** in `TipModal` + `AgentStatus` | Planned | Score-gated amounts rendered as "1,000 G$" etc. |
| **I2: G$ streaming subs** in `subscription-service` | Planned | Closes the on-chain flow TODO in the subscription route |
| **I3: G$ claim onboarding** in `/curator/onboard` + `AddFundsButton` | Planned | One CTA component reused in both surfaces |
| KPI dashboard action types | Planned | `tip_g$`, `claim`, `stream_g$` registered with `Metrics.countAction` |

## What we explicitly will **not** build

Per **PREVENT BLOAT** and **CONSOLIDATION**:

- No parallel "gooddollar" route group — existing `agent-tip.js`, `subscription-service.ts`, `curator-apply.js` get one new branch each.
- No GoodDollar mini-app or standalone dapp.
- No G$ as a payment rail for actual product checkout. G$ is ~$0.0001 with high volatility — wrong medium for commerce.
- No GoodDollar V2 (V4) protocol migration work.
- No GoodDollar Reserve, Savings (sG$), or DAO governance integration.
- No GoodDollar face-verification backend — we surface the contract revert and link to GoodDollar's verification flow.

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
| # of G$ tips sent to agent | `agent:tip-ledger:v1` filter `token=G$` | 500 |
| Total G$ tipped | same | 50,000 G$ |
| # of curators claiming UBI | on-chain `Identity.lastClaim` events | 25 |
| # of G$ streaming subs active | `subscription:*` filter `paymentMethod=superfluid-G$` | 10 |
| Total G$ streamed to curators | on-chain CFAv1 events | 1,000,000 G$ (~$100) |

Tracking via `packages/agent-core/src/metrics.ts` (already exports `Metrics.countAction(actionType, status)`). New action types: `"tip_g$"`, `"claim"`, `"stream_g$"`.

## Execution order

1. E1–E3 cross-cutting enablers (1 PR)
2. `@repo/gooddollar` skeleton + addresses + ABIs + types (1 PR)
3. `packages/gooddollar/src/claim.ts` + test (1 PR)
4. **Integration 3: G$ claim onboarding** (1 PR) — uses claim.ts immediately, smallest UI surface
5. `packages/gooddollar/src/streaming.ts` + test (1 PR)
6. **Integration 2: G$ streaming subs** (1 PR) — needs streaming.ts + price oracle wiring
7. `packages/gooddollar/src/balance.ts` (1 PR)
8. **Integration 1: G$ tip jar** (1 PR) — uses balance.ts + ERC20.transferToken
9. KPI dashboard action types + dashboard tile (1 PR)
10. S4 application write-up (uses metrics from step 9)

Total: ~10 PRs.

## Verification

```bash
pnpm install                                # picks up @repo/gooddollar workspace
pnpm turbo run check-types --filter=@repo/gooddollar
pnpm turbo run check-types --filter=@repo/agent-core
pnpm turbo run lint
pnpm turbo run test --filter=@repo/gooddollar
# Manual smoke: Celo mainnet, open AgentStatus, send a G$ tip; claim UBI; subscribe via G$ stream
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
- G$ on CeloScan: https://celoscan.io/token/0x62B8B1109F25406f3D27cDaA3F8d2305d6eDbBB7
- GoodDollar docs — G$ streaming: https://docs.gooddollar.org/for-developers/developer-guides/use-gusd-streaming
- Superfluid CFAv1Forwarder on Celo: `0xcfA132E353cB4E398081B7F68C40dA562f0Fa1Da`
