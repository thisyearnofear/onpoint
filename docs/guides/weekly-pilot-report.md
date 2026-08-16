# Weekly Pilot Report

> Internal weekly reporting template for the Phase 1 fashion-wedge pilot.
> Copy this file's template into the pilot workspace once per week; do not overwrite prior snapshots.
>
> Related: [Strategy](../STRATEGY.md) · [Phase 1 Audit](../PHASE1_AUDIT.md) · [Merchant Onboarding Scorecard](./merchant-onboarding-scorecard.md) · [Agent Commerce Guide](./agent-commerce.md)

## Reporting rules

1. **Use UTC dates** and name the exact reporting window.
2. **Run the supply audit once per week** and preserve its JSON output alongside the report:

   ```bash
   node scripts/agent-commerce-ready.mjs > agent-commerce-ready.json
   node scripts/trusted-offer-audit.mjs > trusted-offer-audit.json
   ```

3. **Separate supply from demand.** A ready listing is not an agent transaction; a try-on is not a fulfilled order.
4. **Count external demand separately.** Exclude the platform's own wallet, internal demos, scripts, and fixture-only runs from third-party demand proof.
5. **Report failures truthfully.** Distinguish failed payment, stock race, payout delay, fulfillment failure, refund, manual review, and unknown outcome.
6. **Every metric needs a source and an owner.** If a number is unavailable, write `unknown` and add a collection action; do not substitute zero.
7. **Do not publish secrets or unnecessary PII.** Use curator slugs, aggregate counts, receipt references, and redacted transaction links.

## Phase 1 targets

These are operating targets from the canonical strategy, not claims of current attainment:

| Metric                                           |                       Target | Evidence source                                                                                         |
| ------------------------------------------------ | ---------------------------: | ------------------------------------------------------------------------------------------------------- |
| Agent-commerce-enabled curators                  |                          ≥ 5 | Directory gate / audit JSON                                                                             |
| Ready physical listings (strict readiness proxy) |                         ≥ 50 | `trusted-offer-audit.mjs` → `supply.readyListings`; compare with the broader live-SKU target separately |
| Third-party agent try-ons                        |                  ≥ 20 / week | Prometheus/logs; exclude own-agent loops                                                                |
| Paid-to-fulfilled agent order success            |                        ≥ 85% | Order + fulfillment reconciliation                                                                      |
| Curator onboarding to first sale within 7 days   |                        ≥ 40% | Onboarding log + order outcomes                                                                         |
| Human storefront try-on → purchase               |                        ≥ 15% | Funnel analytics                                                                                        |
| Digital try-on → physical storefront visit       |                        ≥ 20% | Try-on / referral or storefront analytics                                                               |
| Catalog freshness / completeness                 | Improve weekly from baseline | Audit JSON                                                                                              |

A target with no reliable source is **not yet measurable**. Add instrumentation before making a strategic claim.

### Metric definitions

- **Ready physical listings:** the audit's strict proxy: a physical listing with `trustedOffer.readiness = true`. It is narrower than “live physical SKU with size/stock truth” because it also requires identity, media, price, payout, freshness, and other contract checks. Report both when the broader SKU count is available.
- **Network readiness rate:** `readyListings / physicalListings audited × 100`. The audit covers all physical listings returned by the audited storefronts, not only the selected pilot cohort. If the cohort differs, report a separate cohort denominator.
- **Paid → fulfilled success:** `fulfilled agent orders / paid agent orders` for orders whose outcome is known within the reporting window. Keep pending, refunded, cancelled, manual-review, and unknown outcomes in separate categories; do not silently exclude them.
- **First sale within 7 days:** merchants with a first confirmed and fulfilled sale within seven calendar days of their Ready timestamp / merchants entering the Ready cohort seven or more days ago. Newer merchants remain pending, not failures.
- **Human try-on → purchase:** completed human try-ons that lead to a confirmed purchase in the defined attribution window / completed human try-ons. Use `unknown` until the event source and attribution window are agreed.
- **Digital → physical visit rate:** digital try-on sessions that produce a physical storefront visit in the defined attribution window / digital try-on sessions. Use `unknown` until the visit event is instrumented and deduplicated.

The audit demonstrates catalog-contract readiness; it does not prove that product media represents the physical item or that fulfillment will succeed. Those require merchant confirmation and observed outcomes.

## Status vocabulary

- **Green:** target met for this week, or the supply gate is satisfied with no material blocker.
- **Yellow:** measurable but below target, deteriorating, or dependent on manual work.
- **Red:** unknown, broken, materially unsafe, or blocked by a P0/P1 issue.
- **N/A:** intentionally not in scope for this week's cohort; explain why.

## Weekly report template

```markdown
# OnPoint Phase 1 Pilot Report — Week of [YYYY-MM-DD]

- **Reporting window (UTC):** [start] → [end]
- **Prepared by:** [name]
- **Reviewed by:** [name]
- **Cohort:** [merchant slugs / number of merchants]
- **Evidence state:** [Implemented | Deployed | Live-validated | Repeatedly proven]
- **Decision this week:** [expand carefully | hold | repair supply | stop/kill experiment]

## 1. Executive readout

**One-sentence truth:** [What changed, without marketing language.]  
**Biggest improvement:** [metric + delta]  
**Biggest risk:** [metric/blocker + owner]  
**Next week's bet:** [one falsifiable action]  
**Stop condition:** [what result would cause us to stop or narrow the pilot]

## 2. Supply readiness

Source: `trusted-offer-audit.json` and `agent-commerce-ready.json` generated for this window.

| Metric                                 | This week | Last week |  Delta |   Target / gate | Status  |
| -------------------------------------- | --------: | --------: | -----: | --------------: | ------- |
| Directory agent-purchasable curators   |       [ ] |       [ ] |    [ ] |             ≥ 5 | [G/Y/R] |
| Physical listings audited              |       [ ] |       [ ] |    [ ] |          report | [G/Y/R] |
| Ready physical listings (strict proxy) |       [ ] |       [ ] |    [ ] |            ≥ 50 | [G/Y/R] |
| Network readiness rate                 |      [ ]% |      [ ]% | [ ] pp |         improve | [G/Y/R] |
| Average completeness                   |       [ ] |       [ ] |    [ ] |         improve | [G/Y/R] |
| Fresh listings                         |       [ ] |       [ ] |    [ ] |        maximize | [G/Y/R] |
| Stale listings                         |       [ ] |       [ ] |    [ ] |        minimize | [G/Y/R] |
| Unknown freshness                      |       [ ] |       [ ] |    [ ] | 0 for pilot set | [G/Y/R] |
| Storefront audit failures              |       [ ] |       [ ] |    [ ] |               0 | [G/Y/R] |
| Missing trusted-offer contracts        |       [ ] |       [ ] |    [ ] |               0 | [G/Y/R] |

### Field coverage

Coverage below is for all physical listings in the audit unless a separate pilot-cohort denominator is recorded. Do not use network-wide coverage to silently certify a smaller intended cohort.

| Field        | This week | Last week |  Delta |             Pilot gate |
| ------------ | --------: | --------: | -----: | ---------------------: |
| Identity     |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |
| Media        |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |
| Size / stock |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |
| Price        |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |
| Payout       |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |
| Freshness    |      [ ]% |      [ ]% | [ ] pp | 100% intended listings |

### Top blockers

| Rank | Blocker | Count | Change | Affected merchants | Owner | Due |
| ---: | ------- | ----: | -----: | ------------------ | ----- | --- |
|    1 | [ ]     |   [ ] |    [ ] | [slugs]            | [ ]   | [ ] |
|    2 | [ ]     |   [ ] |    [ ] | [slugs]            | [ ]   | [ ] |
|    3 | [ ]     |   [ ] |    [ ] | [slugs]            | [ ]   | [ ] |

## 3. Merchant onboarding

Source: completed [Merchant Onboarding Scorecards](./merchant-onboarding-scorecard.md) and operator log.

| Metric                                | This week | Last week |      Target | Status  |
| ------------------------------------- | --------: | --------: | ----------: | ------- |
| Merchants contacted                   |       [ ] |       [ ] | cohort plan | [G/Y/R] |
| Merchants started                     |       [ ] |       [ ] | cohort plan | [G/Y/R] |
| Merchants Ready                       |       [ ] |       [ ] | ≥ 5 network | [G/Y/R] |
| Median time to first valid audit      |   [ ] min |   [ ] min |     improve | [G/Y/R] |
| Median time to payout confirmation    |   [ ] min |   [ ] min |     improve | [G/Y/R] |
| Median catalog corrections            |       [ ] |       [ ] |     improve | [G/Y/R] |
| Merchants needing re-verification     |       [ ] |       [ ] |    minimize | [G/Y/R] |
| Merchants reaching first sale ≤7 days |      [ ]% |      [ ]% |       ≥ 40% | [G/Y/R] |

### Merchant movement

| Merchant | Prior status | Current status | Main blocker / win | Next action | Owner |
| -------- | ------------ | -------------- | ------------------ | ----------- | ----- |
| `[slug]` | [ ]          | [ ]            | [ ]                | [ ]         | [ ]   |
| `[slug]` | [ ]          | [ ]            | [ ]                | [ ]         | [ ]   |

## 4. External agent demand

Source: Prometheus, structured API logs, and/or funnel analytics. Exclude internal demos and the platform wallet. Mark referral or storefront-visit metrics `unknown` until their event source and attribution window are defined.

| Metric                              | This week | Last week | Delta |       Target | Status  |
| ----------------------------------- | --------: | --------: | ----: | -----------: | ------- |
| Third-party try-on attempts         |       [ ] |       [ ] |   [ ] | report / ≥20 | [G/Y/R] |
| Third-party try-on successes        |       [ ] |       [ ] |   [ ] |       report | [G/Y/R] |
| Third-party physical order attempts |       [ ] |       [ ] |   [ ] |       report | [G/Y/R] |
| Third-party confirmed orders        |       [ ] |       [ ] |   [ ] |       report | [G/Y/R] |
| Unique external agents              |       [ ] |       [ ] |   [ ] |      improve | [G/Y/R] |
| Referral-driven visits              |       [ ] |       [ ] |   [ ] |      improve | [G/Y/R] |
| Referral-driven purchases           |       [ ] |       [ ] |   [ ] |      improve | [G/Y/R] |

**Demand interpretation:** [Is this independent usage, a partner test, an internal loop, or unknown?]

## 5. Execution outcomes

| Metric                     | This week | Last week |             Target | Status  |
| -------------------------- | --------: | --------: | -----------------: | ------- |
| Paid agent orders          |       [ ] |       [ ] |             report | [G/Y/R] |
| Fulfilled agent orders     |       [ ] |       [ ] |                  — | [G/Y/R] |
| Paid → fulfilled success\* |      [ ]% |      [ ]% |              ≥ 85% | [G/Y/R] |
| Stock-race cancellations   |       [ ] |       [ ] |                  0 | [G/Y/R] |
| Refunds issued             |       [ ] |       [ ] |      reconcile all | [G/Y/R] |
| Manual-review payments     |       [ ] |       [ ] |           minimize | [G/Y/R] |
| Payouts pending / delayed  |       [ ] |       [ ] |      reconcile all | [G/Y/R] |
| Unknown outcome orders     |       [ ] |       [ ] |                  0 | [G/Y/R] |
| Median time to fulfillment |       [ ] |       [ ] | establish baseline | [G/Y/R] |

**Failure truth:** [List each non-success category and what happens next.]

## 6. Human and digital funnel

| Metric                               | This week | Last week | Target | Status  |
| ------------------------------------ | --------: | --------: | -----: | ------- |
| Human storefront try-ons             |       [ ] |       [ ] | report | [G/Y/R] |
| Human try-on → purchase\*            |      [ ]% |      [ ]% |  ≥ 15% | [G/Y/R] |
| Digital try-ons                      |       [ ] |       [ ] | report | [G/Y/R] |
| Digital → physical storefront visits |       [ ] |       [ ] | report | [G/Y/R] |
| Digital → physical visit rate\*      |      [ ]% |      [ ]% |  ≥ 20% | [G/Y/R] |

\* See the metric definitions above. If the denominator, attribution window, or outcome is not yet reliable, enter `unknown`, not zero.

## 7. Economics and schlep

| Metric                                   | This week | Last week | Delta | Interpretation |
| ---------------------------------------- | --------: | --------: | ----: | -------------- |
| Try-on revenue                           |  [ ] cUSD |  [ ] cUSD |   [ ] | [ ]            |
| Try-on provider cost                     |   [ ] USD |   [ ] USD |   [ ] | [ ]            |
| Agent order GMV                          |  [ ] cUSD |  [ ] cUSD |   [ ] | [ ]            |
| Refund / failure cost                    |   [ ] USD |   [ ] USD |   [ ] | [ ]            |
| Onboarding operator hours                |       [ ] |       [ ] |   [ ] | [ ]            |
| Catalog maintenance hours                |       [ ] |       [ ] |   [ ] | [ ]            |
| Median operator minutes / Ready merchant |       [ ] |       [ ] |   [ ] | [ ]            |
| Manual interventions / order             |       [ ] |       [ ] |   [ ] | [ ]            |

**Schlep verdict:** [Compounding asset | improving but manual | services risk | stop this work]

## 8. Decisions and next actions

### Decisions made

1. [Decision + evidence]
2. [Decision + evidence]

### Action register

| Priority | Action | Owner | Due | Success measure | Status |
| -------- | ------ | ----- | --- | --------------- | ------ |
| P0       | [ ]    | [ ]   | [ ] | [ ]             | [ ]    |
| P1       | [ ]    | [ ]   | [ ] | [ ]             | [ ]    |
| P2       | [ ]    | [ ]   | [ ] | [ ]             | [ ]    |

### Evidence and links

- Audit JSON: `[path or artifact URL]`
- Directory snapshot: `[path or artifact URL]`
- Funnel report: `[path or endpoint/query]`
- Prometheus/log query: `[query or dashboard URL]`
- Order/fulfillment reconciliation: `[path or reference]`
- Merchant scorecards: `[folder or links]`
```

## Weekly operating cadence

- **Monday:** choose the merchant cohort and confirm owners.
- **During the week:** record onboarding work, catalog changes, external agent calls, order states, fulfillment, payouts, and failures as they happen.
- **Friday:** run both audits, export the relevant analytics windows, reconcile order outcomes, and fill the report.
- **Review:** decide whether to expand, hold, repair, or stop. Keep one falsifiable bet for the next week.
- **Archive:** preserve the report and raw JSON snapshot; never replace historical reports with current values.
