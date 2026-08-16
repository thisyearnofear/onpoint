# Merchant Onboarding Scorecard

> Operational checklist for activating a curator into the Phase 1 agent-commerce pilot.
> This is a working scorecard, not a public merchant-facing promise.
>
> Related: [Phase 1 Audit](../PHASE1_AUDIT.md) · [Agent Commerce Guide](./agent-commerce.md) · [Curator Payout Wallets](./curator-payout-wallets.md) · [Strategy](../STRATEGY.md)

## Purpose

The scorecard answers one practical question:

> **Can this merchant expose at least one truthful, executable physical offer to an external agent without creating a predictable failure?**

It separates three things that are easy to conflate:

1. **Supply readiness** — the catalog is complete, fresh, stocked, priced, and payable.
2. **Activation readiness** — the merchant is visible and can receive a payout.
3. **Demand proof** — an independent agent actually tries on, buys, and receives an item.

Audit values such as `readinessRate`, `averageCompleteness`, and `fieldCoverage` describe all physical listings returned by the audited storefront unless a separate filtered cohort is recorded. They prove catalog-contract readiness, not that photos represent the actual item or that fulfillment will succeed. Merchant confirmation and observed outcomes remain required.

A merchant can be supply-ready before demand exists. Do not mark demand as proven because a merchant passed this scorecard.

## How to use it

1. Run the directory gate and listing-level audit:

   ```bash
   node scripts/agent-commerce-ready.mjs
   node scripts/trusted-offer-audit.mjs
   ```

2. Find the curator in the audit's `curators[]` output.
3. Copy the relevant values into the scorecard below.
4. Resolve hard blockers before inviting external agents.
5. Re-run the audit after each catalog or wallet change.
6. Record the date and operator so the scorecard remains an auditable snapshot.

The audit uses the public directory/storefront contracts and does not write to production. For local or staging validation, pass the directory URL as the script argument.

## Status gates

### Blocked

Use **Blocked** when any of these are true:

- The storefront fetch failed or the directory record is malformed.
- `physicalListings = 0`.
- `readyListings = 0`.
- `blockerCounts.missing_trusted_offer > 0`.
- `fieldCoverage.payout.coverage < 100` for the listings intended for pilot traffic.
- The merchant has not confirmed the payout destination and fulfillment contact.

**Action:** do not route external purchase traffic. Assign an owner and one next action.

### Fixing

Use **Fixing** when the merchant has usable supply but still has a repairable gap:

- `readyListings > 0`, but `agentPurchasable` is false; or
- `readinessRate < 100%`; or
- stale/unknown freshness or missing media, size/stock, price, or payout fields remain; or
- the merchant has a wallet but no fresh executable offer.

**Action:** keep the storefront available for human/WhatsApp workflows, but do not include the failing listings in an agent pilot cohort until the blockers are cleared.

### Ready

Use **Ready** when all of the following hold:

- `agentPurchasable = true` in the directory output;
- `physicalListings >= 1` and `readyListings >= 1`;
- the storefront fetch succeeded;
- the intended pilot listings have fresh inventory and no hard blockers;
- the payout wallet and fulfillment contact are confirmed.

**Action:** the merchant may enter the controlled external-agent pilot. Start with a small number of listings and verify the first transaction manually.

### Proven

**Proven is not a scorecard status.** Upgrade the merchant only after observed outcomes support it:

- an independent agent generated a measurable try-on or order;
- the order was fulfilled or its failure was truthfully reconciled;
- payout, receipt, and customer outcome are recorded;
- the result is included in the weekly report's demand and execution sections.

## Scorecard template

Copy this block once per merchant and keep the completed version in the pilot workspace or weekly report. Do not put private wallet keys, customer phone numbers, or payment secrets in the scorecard.

```markdown
## Merchant scorecard — [CURATOR NAME] (`[slug]`)

- **Owner:** [operator]
- **Merchant contact / channel:** [WhatsApp or agreed channel; avoid unnecessary PII]
- **Scorecard date (UTC):** [YYYY-MM-DD]
- **First onboarded:** [YYYY-MM-DD]
- **Status:** [Blocked | Fixing | Ready]
- **Evidence state:** [Implemented | Deployed | Live-validated | Repeatedly proven]

### Audit snapshot

| Field                                           |         Value | Gate / interpretation                                      |
| ----------------------------------------------- | ------------: | ---------------------------------------------------------- |
| Directory `agentPurchasable`                    |  [true/false] | Must be `true` for agent physical checkout                 |
| Directory `agentCommerceEnabled`                |  [true/false] | Wallet/config signal; not sufficient by itself             |
| Physical listings                               |      [number] | Must be at least 1                                         |
| Ready listings (strict audit proxy)             |      [number] | Must be at least 1                                         |
| Readiness rate (audit-wide unless cohort noted) | [percentage]% | 100% is the quality target for the intended pilot set      |
| Average completeness                            |         [0–1] | Track weekly; improve rather than claim a universal cutoff |
| Fresh listings                                  |      [number] | Freshness comes from `last_verified_at`                    |
| Stale listings                                  |      [number] | Remove from pilot traffic until reverified                 |
| Unknown freshness                               |      [number] | Treat as not executable                                    |
| Payout field coverage                           | [percentage]% | Must be 100% for intended pilot listings                   |
| Size/stock field coverage                       | [percentage]% | Must be 100% for intended pilot listings                   |
| Price field coverage                            | [percentage]% | Must be 100% for intended pilot listings                   |
| Media field coverage                            | [percentage]% | Must be 100% for intended pilot listings                   |
| Missing trusted-offer contracts                 |      [number] | Must be 0                                                  |
| Storefront fetch failures                       |      [number] | Must be 0                                                  |

### Merchant confirmation

- [ ] Product identity and title are correct.
- [ ] Product media represents the actual item, or is explicitly labeled as a concept/preview.
- [ ] Available sizes and integer stock counts are correct.
- [ ] Price and currency are confirmed.
- [ ] Inventory was explicitly verified on [date/time].
- [ ] Payout wallet destination was confirmed through the approved wallet flow.
- [ ] Fulfillment owner and expected handoff process are known.
- [ ] Merchant understands that agent orders are real purchase attempts, not demos.

### Blockers and next action

| Priority | Blocker                      | Owner  | Next action       | Due    | Resolved date |
| -------- | ---------------------------- | ------ | ----------------- | ------ | ------------- |
| P0       | [e.g. missing payout wallet] | [name] | [specific action] | [date] | [date/—]      |
| P1       | [e.g. stale inventory]       | [name] | [specific action] | [date] | [date/—]      |
| P2       | [e.g. missing media]         | [name] | [specific action] | [date] | [date/—]      |

### Outcome evidence (leave blank until observed)

- **External agent try-ons:** [count / date range]
- **External agent orders:** [count / date range]
- **Fulfilled orders:** [count / date range]
- **Failed / refunded / manual-review orders:** [count + reason]
- **First successful fulfillment:** [date / receipt reference]
- **Payout proof:** [Celoscan link or internal reference; no secrets]
- **Notes:** [what was learned]
```

## Operator decision rules

| Situation                                                  | Decision                                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet exists but `agentPurchasable = false`               | Do not describe the merchant as agent-ready. Inspect `trustedOffer` blockers and freshness.                                                  |
| One listing is ready and another is stale                  | Permit only the ready listing; repair or pause the stale listing.                                                                            |
| Digital listings are healthy but physical listings are not | Count digital capability separately. This is try-on readiness, not purchase readiness.                                                       |
| Stock changed through an order                             | Re-run verification; the order path updates `last_verified_at`, but a human/merchant confirmation may still be needed for the next snapshot. |
| Missing or malformed `trustedOffer`                        | Treat as an API/data-contract blocker, not as a merchant quality score of zero.                                                              |
| Merchant asks for traffic before readiness                 | Start with human/WhatsApp discovery or a controlled dry run; do not send paid agent purchase traffic.                                        |

## Pilot onboarding economics

Track the work required to reach Ready. The schlep is only strategic if it becomes faster or produces reusable data.

- Minutes from first contact to first valid storefront audit.
- Minutes from first audit to payout confirmation.
- Number of catalog corrections required.
- Number of re-verifications in the first 14 days.
- Whether the merchant remains fresh without manual chasing.
- Time from Ready to first external agent event.

Report medians and outliers weekly. Do not hide manual interventions inside a single “onboarded” count.
