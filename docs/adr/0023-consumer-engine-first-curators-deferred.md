# ADR 0023: Consumer Engine First — Curators Deferred

**Status**: Accepted
**Date**: 2026-11-03
**Supersedes (in part)**: ADR 0022 §2 phasing and channel priority. The Runway engine, guardrails and measurement events in ADR 0022 stand.
**Related**: ADR 0002 (curator primitive), ADR 0019 (share attribution), ADR 0022 (Runway)

## Context

STRATEGY.md was written around supply: Phase 1 targets curators, SKUs and third-party agent usage, and the product loop starts with "curator publishes supply". The live directory shows one agent-purchasable curator. Recruiting merchants into a product with no audience gives them nothing to sell into, and every curator onboarded now costs operational effort (photos, stock truth, payouts) without demand to justify it.

Meanwhile the web app already has consumer primitives that do not depend on curators: Runway (themed fit check with AI judges, score paddles, result card), polaroids, looks and collages, the outfit planner, persona stylists, and the free web try-on.

## Decision

1. **The web app is the product for now.** The current goal is a place that produces great, repeatable experiences and earns high retention from social-native users (Instagram, X, TikTok). Mobile web first. iMessage stays live as a secondary channel; WhatsApp (ADR 0022 Phase D) waits for curators.
2. **Curators are deferred, not removed.** Storefronts, agent commerce, payment rails, payouts and the related docs stay implemented and documented. No new curator onboarding, merchant tooling or supply targets until the activation gate in [STRATEGY.md](../STRATEGY.md#phase-0--consumer-engine-and-retention-current) is met.
3. **Runway is the front door.** The homepage, navigation and share output lead with it. The other primitives connect through Runway rather than sitting beside it.
4. **"The fix" works without curators.** It draws from OnPoint-owned sources (house catalog, digital garments, looks). When nothing fits, it falls back to a styling tip with no product. It must never show an empty or broken product slot.
5. **Retention is the main metric.** Definitions live in [ops/retention.md](../ops/retention.md). Supply metrics (curators, SKUs, agent orders) are not reported as progress during this phase.

## Consequences

- STRATEGY.md §7 gains a Phase 0, and the old Phase 1 supply targets are marked deferred.
- Ops docs written for the curator pilot (phase-1 audit, onboarding scorecard, weekly pilot report) are kept and marked dormant.
- Runway funnel events do not yet carry a stable player identifier, so cohort retention cannot be measured until that is added (see ops/retention.md).
- The agent-facing API (AGENTS.md) is unchanged. External agents can still use it. It is simply not where product effort goes.
- Risk: the consumer engine becomes a novelty with no commerce path. Mitigation: the gate is explicit, and "the fix" keeps the path into products open from day one.
