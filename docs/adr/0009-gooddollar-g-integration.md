# ADR 0009 — GoodDollar G$ Integration

- Status: Accepted
- Date: 2026-06-29
- Deciders: Agent Core, Curator, Billing
- Related: ADR 0002 (Curator Primitive), ADR 0005 (Agent Spending Controls), ADR 0008 (TinyFish Async Streaming)

## Context

GoodBuilders Season 4 distributes $50K USD streamed in G$ via GoodDollar's native Superfluid capabilities on Celo. To qualify, an applicant must ship a **live G$ integration before or at the start of the season** that delivers real, measurable value to the GoodDollar ecosystem over the 12-week cycle.

OnPoint currently has strong Celo presence (ERC-8004 agent ID 9177, MiniPay adapter, multi-chain wallet across Celo/Base/ETH/Polygon) but **zero GoodDollar integration**. Verified by repo-wide grep across `gooddollar`, `G$`, `ubi`, `claim`, `goodprotocol`. The existing tip, subscription, and onboarding surfaces already run on Celo mainnet — the integration shape is well-defined.

Three concrete questions drive this decision:

1. **Which existing surfaces should accept G$?** Tip jar (every post-session tip), curator subscriptions (premium tier upgrades), and onboarding UBI claim (first-time curators) all map cleanly to existing primitives.
2. **Where do addresses, ABIs, and Superfluid helpers live?** A single new package is the right shape. Three parallel integrations of G$ would scatter the contract knowledge across `apps/web`, `apps/api`, and the agent-core.
3. **How does G$ co-exist with cUSD without forking the codebase?** G$ is a SuperToken on Celo — same 18 decimals as cUSD, same ERC-20 surface, same `transfer(address,uint256)` ABI. The only meaningful differences are (a) the contract address, (b) G$ is non-fungible-with-USD-priced at ~$0.0001, and (c) Superfluid's `CFAv1Forwarder` is the natural write path for streaming use cases.

## Decision

### D1. Single new package: `@repo/gooddollar`

One package owns addresses, ABIs, claim helpers, streaming helpers, and cached balance reads. Mirrors the shape of `@repo/etherfuse` and `@repo/agent-core`. Subpath exports per module so consumers pull only what they need.

**Rationale (ENHANCEMENT FIRST, DRY, PREVENT BLOAT):** three parallel implementations of the same G$ knowledge (one per integration) would scatter the contract addresses across `apps/web/lib/services`, `apps/api/routes`, and `packages/agent-core`. Single package means one place to update if GoodDollar migrates to a new contract address or V2 protocol. Per ADR 0008 D2 ("the bridge is the canonical TinyFish surface"), the rule generalises: each external integration has one canonical owner in the monorepo.

### D2. G$ is a first-class `TokenSymbol`, not a special case

Add `GOOD_DOLLAR` to `TOKEN_ADDRESSES` in `packages/agent-core/src/chains.ts`. Add helpers `getGTokenAddress(chain)` and `isSuperfluidNativeToken(symbol, chain)` (returns true only for `GOOD_DOLLAR.celo`). The existing `getTokenAddress(symbol, chain)` and `supportsCUSD(chain)` patterns are the template.

**Rationale (CONSOLIDATION, DRY):** the existing `TipModal.tsx:32` has a hardcoded `const CUSD_ADDRESS = "0x765DE8164458C172EE097029dfb482Ff182ad001"`. The existing `agent-tip-agent.js:166` does `agentCore.ERC20?.getCUSDAddress?.(chain)` to resolve the same value. Two duplicate hardcodings collapse to one read from `chains.ts`. The pattern is the same as what cUSD and USDT already do.

### D3. `"ubi_claim"` is a first-class `ActionType`

Add `"ubi_claim"` to `ActionType` in `packages/agent-core/src/agent-controls.ts`. Add a `DEFAULT_LIMITS.ubi_claim` entry. The app-layer cap is `perActionLimit: parseEther("1")` and `dailyLimit: parseEther("1")` — GoodDollar's `ClaimFacet` enforces its own rate limit on-chain, so the cap is for audit-trail honesty (we record the action in the spend-policy log with a defensible ceiling).

**Rationale (CLEAN, MODULAR):** UBI claim is conceptually distinct from tip, purchase, and mint. It has different semantics (rate-limited by the protocol, not by user policy), different audit semantics (no recipient, no approval flow), and different UI semantics (collapsed CTA in onboard, not a "send payment" sheet). Mixing it into the existing `"tip"` action type would conflate three different user intents.

### D4. `"G$"` joins the spend-policy allowlist

One line in `apps/web/lib/services/spend-policy.ts:152` — add `"G$"` to `allowedTokens`. No other change. The daily-cap math stays in USD-equivalent because spend-policy already operates in human-readable numbers.

**Rationale (ENHANCEMENT FIRST, PREVENT BLOAT):** extending the existing allowlist is one line. The alternative — a separate `spend-policy-g$-variant.ts` file — would force every consumer that checks policy to know which variant to query. The single allowlist is the canonical place.

### D5. Superfluid flow creation lives in `packages/gooddollar/streaming.ts`

Use raw viem writes to `CFAv1Forwarder.createFlow()`, `updateFlow()`, `deleteFlow()`. Do not pull in `@superfluid-finance/sdk-core` unless a specific helper requires it.

**Rationale (PREVENT BLOAT):** the SDK is ~80KB and brings its own ethers v5 dependency. Raw viem works because CFAv1Forwarder's ABI is small and well-documented. If a future helper genuinely needs the SDK (e.g. Superfluid subgraph queries for batch flow history), we add it then. Per ADR 0008 D2 ("the bridge is the canonical TinyFish surface") and the project's general posture of "smallest viable dep surface."

### D6. G$ price volatility is a known-and-managed risk for subscriptions

Streaming subs lock the G$ flow rate at stream creation. We snapshot the G$/USD price via `getGUSDPrice()` (CoinGecko, 5-min TTL), compute `flowRate = tierPriceUsd / gPriceUsd / secondsPerMonth`, write the stream, and accept drift over the 30-day period.

**Rationale (CLEAN):** the alternative — auto-rebalancing the stream daily to maintain a USD-equivalent — adds complexity (price oracle reliability, edge cases around thin liquidity) without proportional user value for a $9.99/mo subscription. Document the drift on the pricing page. If a curator cancels and restarts, they get the fresh rate.

### D7. Claim hook is composable, not a new page

`GClaimCTA` is an ~80-line component reused in both `AddFundsButton.tsx` (above the Etherfuse fiat tiles) and `apps/web/app/curator/onboard/page.tsx` (between the brand-color section and the submit button). It takes `onClaimed` as a callback and owns no success UX.

**Rationale (MODULAR, ORGANIZED):** a "gooddollar" page or route group would imply G$ is a separate product. It is not — it is one payment and one claim rail inside the existing product. Reuse the same component in both surfaces keeps the UI identical and reduces drift.

### D8. Verification surface: a KPI dashboard using existing `Metrics`

`Metrics.countAction(actionType, status)` already exists in `packages/agent-core/src/metrics.ts`. Add three new action types: `"tip_g$"`, `"claim"`, `"stream_g$"`. Surface counts on the existing `AgentStatus` panel as stat tiles.

**Rationale (DRY, PREVENT BLOAT):** the metrics infrastructure is already wired to Redis-backed counters with Prometheus export. Adding new action types is a one-line registration per action. No new dashboard framework, no new export pipeline.

## Out of Scope

- GoodDollar mini-app or standalone dapp.
- G$ as a payment rail for actual product checkout. G$ is ~$0.0001 with high volatility — wrong medium for commerce.
- GoodDollar V2 (V4) protocol migration work.
- GoodDollar Reserve, Savings (sG$), or DAO governance integration.
- GoodDollar face-verification backend — we surface the contract revert and link to GoodDollar's verification flow.
- Adding a GoodDollar SDK dependency. Raw viem writes keep the dep surface small.

## Consequences

**Positive:**

- Three live G$ integrations on Celo mainnet for GoodBuilders S4 eligibility.
- Single canonical owner for G$ contract knowledge, addresses, and helpers.
- Existing patterns (token allowlist, action types, subpath exports, metric action types) extended rather than forked — aligns with ENHANCEMENT FIRST.
- No new top-level packages at the app level. No new env-var prefixes.

**Negative / risks:**

- Three integrations to ship in 2–4 weeks. Tight timeline; mitigated by the small scope per PR (10 PRs total, mostly < 200 lines each).
- G$ price volatility on subscription flows. Mitigated by D6's flow-rate snapshot + drift disclosure.
- GoodDollar's `ClaimFacet` requires face-verified identities — some curators won't be eligible. Mitigated by surfacing the revert reason and linking to GoodDollar's verification flow.
- `"superfluid"` enum becomes `"superfluid-cUSD"` for back-compat. Migration handled inside `subscription-service.upgradeSubscription`'s default branch — no caller-facing breakage.

## Implementation plan

Full plan and execution order live in `docs/hackathons/goodbuilders-season-4.md`. Summary:

1. E1–E3 cross-cutting enablers (1 PR, 1 day)
2. `@repo/gooddollar` skeleton (1 PR, 1 day)
3. `claim.ts` + test (1 PR, 1 day)
4. **I3: G$ claim onboarding** (1 PR, 1 day)
5. `streaming.ts` + test (1 PR, 2 days)
6. **I2: G$ streaming subs** (1 PR, 2 days)
7. `balance.ts` (1 PR, 0.5 day)
8. **I1: G$ tip jar** (1 PR, 1 day)
9. KPI dashboard (1 PR, 1 day)
10. S4 application write-up (1 day)

Total: ~10 PRs, ~11 dev days.
