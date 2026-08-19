# OnPoint Strategic Direction

**Last updated:** 2026-08-10
**Status:** Canonical product strategy. Other docs defer here for positioning, phases, metrics, and expansion decisions.
**Current evidence note:** Infrastructure was repaired and verified on 2026-08-10, but no current merchant, demand, fulfillment, or revenue figures are asserted here. Use the Phase 1 audit and weekly pilot report for refreshed evidence.

> **Build as if fashion is the company; architect as if fashion is the first vertical.**

---

## 1. The thesis

### Company-level opportunity

AI agents will not safely execute physical commerce from shallow product feeds. They need specialized execution rails that understand the product, the buyer, the merchant, the quote, and the payment context.

### Product today

**OnPoint is the trusted execution rail for agentic fashion commerce.** It turns live fashion inventory into fit-aware, machine-readable, locally payable offers for both human shoppers and AI agents.

> **Fit before you buy — for people and agents.**

Humans use branded storefronts with AI try-on and WhatsApp/M-Pesa checkout. Agents use the same inventory through structured storefront APIs, paid try-on, permissioned checkout, and verifiable receipts.

### Long-term opportunity

Fashion is the first and hardest proof point for a broader category:

> **Agent-ready execution infrastructure for fit-sensitive physical goods.**

This is not a decision to become a generic commerce API now. The platform abstraction must be earned through real fashion supply, real agent usage, and real transaction outcomes. Expand only when another category pulls the primitives out of the fashion network.

```text
Messy merchant inventory
        ↓
Structured, fresh, agent-readable offer
        ↓
Fit and purchase confidence
        ↓
Permissioned local checkout
        ↓
Fulfillment, payout, receipt, and outcome data
```

---

## 2. What we are—and are not

| We are                                                                           | We are not                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A vertical execution rail for fit-sensitive fashion commerce                     | A generic AI shopping assistant competing with ChatGPT, Google, Amazon, or Shopify |
| A shared human storefront + machine-readable catalog over one inventory          | A virtual try-on novelty disconnected from stock or checkout                       |
| A way to make messy, WhatsApp-era merchant supply agent-executable               | Only a WhatsApp seller CMS                                                         |
| A category specialist that agents call when fit, freshness, and local pay matter | Generic payment infrastructure or an x402 wrapper                                  |
| A fashion wedge that may become a broader execution platform                     | A horizontal “picks and shovels” company before the mine is proven                 |

The product is not the `/lab` agent dashboard. The product is the underlying network: truthful supply, fit evidence, executable offers, settlement, distribution, and outcome data.

### The strategic distinction

- **Wedge:** fashion inventory with fit, stock, and local payment complexity.
- **Proof point:** the end-to-end fashion product demonstrates that agents can move from intent to a safe, successful purchase.
- **Potential platform:** the normalized catalog, freshness, fit, quote, permission, checkout, and outcome primitives can later serve adjacent categories.
- **Current constraint:** the network has to earn this abstraction with supply density and external usage.

---

## 3. Why this market now

The supplied market research points to two related problems. The first is large and established; the second is newer and strategically differentiated.

### 3.1 Fit and size create an expensive failure mode

The research notes cite:

- **Coresight (2023):** 24.4% average online apparel return rate; size/fit represented 53% of stated return reasons.
- **Springer, Journal of Business Economics (2021):** in a sample of 8,393 shoppers, 87.1% of fashion returns were attributed to “item does not fit.”
- **Coresight × Alvanon (May 2026):** sizing/fit was estimated at roughly 70% of returns; the US online apparel/footwear market was estimated at $201.1B in 2025, implying approximately $47.1B at a 23.4% return rate.

The exact estimates vary by methodology. The durable conclusion is simpler: **fit uncertainty is a major, costly failure mode in online fashion.**

### 3.2 Agents penalize incomplete and stale commerce data

This is the more differentiated wedge. The supplied 2026 research notes cite:

- **Coresight × Alvanon:** AI agents rely on structured, machine-readable data and penalize brands with inconsistent or incomplete sizing information.
- **Hexagon/Adobe (2026):** AI-referred retail traffic rose sharply year over year; products with complete schema were cited more often, while missing or invalid fields could disqualify products.
- **DataFeedWatch (March 2026):** high-scoring feeds showed materially higher citation rates; low-quality feeds were effectively invisible.
- **Shopti (July 2026):** missing core fields and stale custom feeds were associated with materially lower AI citation.

These figures are **research inputs, not yet independently verified in this repository**. The supplied notes did not include source URLs. Before external publication, attach the original links, confirm definitions and samples, and avoid presenting vendor-specific multipliers as universal facts.

The strategic implication does not depend on any single multiplier:

> As agents become a meaningful demand channel, catalog completeness, freshness, and executable purchase context become eligibility signals—not merely merchandising hygiene.

### 3.3 What we will not claim

- **Counterfeit/authorship:** real problem, but primarily a luxury resale/authentication wedge and not OnPoint’s current retail model.
- **Ghost listings as a standalone buyer category:** stale stock is real, but the strongest evidence currently supports the broader claim that stale or incomplete data reduces agent trust and discoverability.
- **Returns solved:** OnPoint can improve fit confidence; it does not claim to eliminate returns.

---

## 4. The Thiel and Graham tests

### Creative monopoly

The narrow monopoly to pursue is not “AI fashion” or “agent payments.” It is:

> **The best agent-executable fashion supply graph for inventory where fit, freshness, and local settlement matter.**

The defensible asset is the accumulated network of:

- normalized garment and size data;
- fresh stock and availability history;
- fit evidence and size mappings;
- merchant response and fulfillment reliability;
- local payment and settlement behavior;
- agent requests, failures, and successful purchases;
- return, exchange, and outcome signals.

Protocols and model providers can commoditize payments and inference. They cannot instantly reproduce a trusted, outcome-rich physical supply graph.

### Distribution built into the product

Distribution should be a property of every transaction, not a later marketing function:

- every curator storefront is also an agent endpoint;
- every machine-readable offer can be cited and routed by agents;
- every agent-created look is a shareable distribution object;
- every try-on/share/order carries attribution;
- every successful purchase creates a merchant, agent, and outcome relationship;
- every merchant who improves catalog completeness becomes more discoverable to agents.

The loop is:

```text
Curator publishes supply
  → agent can discover and execute
  → shopper receives fit confidence
  → look/share/referral creates demand
  → purchase creates payout + outcome data
  → better data improves trust and distribution
```

A referral link alone is not a moat. The moat is the transaction and data loop it creates.

### The schlep

The unattractive work is central to the opportunity:

- onboarding small merchants;
- ingesting WhatsApp photos and stock updates;
- normalizing inconsistent sizes and descriptions;
- keeping availability fresh;
- reconciling local payment and fulfillment;
- handling exceptions, substitutions, and uncertain outcomes.

This is a good schlep only if it compounds into proprietary data, higher agent success, merchant retention, or lower operating cost. If it remains bespoke catalog labor without network effects, it is a services business and must be constrained.

---

## 5. The product loop

OnPoint has two clients over one supply graph:

| Client           | Flow                                                                                      | Value                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Human shopper    | Storefront → try-on → fit signal → WhatsApp/M-Pesa → receipt                              | Confidence and local, low-friction purchase                           |
| External agent   | Directory → structured offer → paid try-on → quote/permission → checkout → payout/receipt | Reliable execution rather than a recommendation                       |
| Curator/merchant | Onboard → publish stock → receive human and agent demand → payout/outcomes                | Distribution and execution without rebuilding commerce infrastructure |

The operating primitive is a **trusted executable offer**: a product with enough identity, fit, stock, price, payment, and fulfillment context for an agent to act safely.

---

## 6. Current product and evidence boundary

**Current status:** production beta; the source code contains the core storefront, try-on, agent-commerce, curator, payout, referral, looks, and permissioned-checkout rails.

### Implemented product surfaces

- Branded curator storefronts and machine-readable offers.
- Human AI try-on, fit signals, polaroids, WhatsApp/M-Pesa paths.
- Agent x402 try-on and Celo checkout with attribution and curator payouts.
- Digital-to-physical discovery from digital curator designs.
- Agent-created looks, share cards, referrals, and SDK helpers.
- Agent identity, spending controls, receipts, and operational dashboards.
- Prava/Linq discovery, quote, permission, hosted-return, and message handoff work.

### Evidence levels

| Level                | Meaning                                                         | Current posture                                                          |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Implemented          | Source path exists and has local/unit coverage                  | Broadly true across the core rails                                       |
| Deployed             | Path is available in a deployed environment                     | True for documented production surfaces, subject to deployment freshness |
| Live-validated       | External provider or chain behavior was exercised successfully  | True for selected Celo, UCP, Prava sandbox, Linq, and webhook paths      |
| Repeatedly proven    | Independent agents/merchants use it at meaningful volume        | **Not yet established; this is the current strategic proof gap**         |
| Strategically proven | Supply, demand, economics, retention, and outcomes meet targets | **Not yet proven**                                                       |

The Prava integration is permission-ready and sandbox-validated; it does not claim a completed merchant order. Self-check and fixture paths validate orchestration, not payment or fulfillment.

Historical deployment and test evidence is preserved in [HACKATHONS.md](./HACKATHONS.md) and the Phase 1 audit, but current numbers must be refreshed before being used as present-tense traction claims.

---

## 7. Current phase: prove the wedge

### Phase 1 — Supply Graph Readiness (Q3 2026, current)

**Goal:** enough fit-aware, agent-commerce-enabled inventory that an external agent can discover, try on, buy, and receive a truthful outcome with high success—while humans continue converting through local channels.

Co-primary workstreams:

1. **Supply density:** activate merchants with truthful photos, sizes, stock, freshness, and payout wallets.
2. **Fit rail:** make try-on and size guidance useful, clearly labeled, and tied to the actual SKU.
3. **Agent demand:** measure independent agent calls separately from internal demos and scripts.
4. **Execution reliability:** quote, payment, stock reservation, payout, fulfillment, and receipt states must be truthful.
5. **Embedded distribution:** make storefronts, looks, referrals, and agent citations drive demand without a separate audience-building product.
6. **Schlep economics:** measure onboarding time and catalog-maintenance burden; automate only the work that compounds.

### 90-day proof targets

| Metric                                         | Target                               | Strategic reason                      |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------- |
| Agent-commerce-enabled curators                | ≥ 5                                  | A network, not a single demo          |
| Live physical SKUs with size/stock truth       | ≥ 50                                 | Agents need depth and choice          |
| Third-party agent try-ons                      | ≥ 20/week                            | Demand beyond the own-agent loop      |
| Paid-to-fulfilled agent order success          | ≥ 85%                                | Execution trust                       |
| Curator onboarding to first sale within 7 days | ≥ 40%                                | Supply-side pull                      |
| Human storefront try-on to purchase            | ≥ 15%                                | Fit rail creates value for humans too |
| Digital try-on to physical storefront visit    | ≥ 20%                                | Digital discovery feeds real commerce |
| Catalog freshness / core-field completeness    | Define baseline, then improve weekly | Agent eligibility and trust           |

These are operating targets, not claims of current attainment.

### Phase 2 — Execution Reliability

**Prerequisite:** Phase 1 supply and external usage bar is substantially met.

Focus on stock freshness, reservations, fulfillment states, provider circuit breakers, cost controls, E2E coverage, agent SDK quality, and merchant operations. Do not add generic platform surfaces before the core transaction is reliable.

### Phase 3 — Default fashion rail for agents

**Prerequisite:** sustained third-party usage, dense supply, repeat merchant value, and credible unit economics.

Focus on bulk inventory APIs, freshness webhooks, agent reputation/allowlists, public SDKs, richer fit evidence, and protocol adapters. The objective is to become the category endpoint agents prefer—not to own every layer of payment or inference.

### Phase 4 — Earned expansion

Expand to another fit-sensitive physical category only when all are true:

1. external agents or merchants request it;
2. the same offer/freshness/fit/quote/settlement primitives apply;
3. fashion has meaningful repeat usage and outcome data;
4. onboarding and maintenance economics are understood;
5. the new category has a clear owner and wedge, not just technical reusability.

Potential adjacency examples: beauty shade matching, furniture dimensions/room fit, sports equipment, uniforms/workwear. These are hypotheses, not roadmap commitments.

---

## 8. Business model and moat formation

Near-term revenue can come from:

- paid agent try-on;
- transaction/take-rate economics on agent purchases;
- curator or merchant services only where they improve network supply;
- referral and attribution flows;
- future data/availability services only after agent demand is proven.

Do not lead with generic API monetization. The API becomes valuable because it connects trusted supply to demand and captures outcomes.

The compounding asset is:

```text
More useful supply
  → more agent discovery
  → more transactions
  → more fit/freshness/outcome data
  → better success and merchant ROI
  → more supply and agent demand
```

If this loop does not appear, narrow the product or kill the abstraction.

---

## 9. What we will not build now

- A horizontal AI shopper or generic “agent commerce OS.”
- Generic payment infrastructure that large payment networks can commoditize.
- A user-facing design studio as the primary product.
- A counterfeit/authentication product for luxury resale.
- Multi-chain expansion before the Celo/local-pay wedge works.
- Broad category expansion based only on shared code.
- Merchant tooling that increases catalog labor without improving agent eligibility, sales, or data quality.
- More hackathon-specific surfaces unless they improve the core execution loop.

---

## 10. Decision framework

For every proposed feature, ask:

1. Does it make a fashion offer more **discoverable, fit-aware, fresh, executable, or attributable**?
2. Does it increase agent success, merchant ROI, shopper confidence, or compounding outcome data?
3. Does it build distribution into the transaction rather than require a separate audience?
4. Does it turn a schlep into a repeatable asset, or merely add services labor?
5. Is the claim implemented, deployed, live-validated, repeatedly proven, or still a hypothesis?
6. Is this a fashion wedge improvement, a reusable primitive, or premature horizontalization?
7. What metric would cause us to stop?

If the answer is no or unknown, defer.

---

## 11. Canonical doc map

| Doc                                        | Owns                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| **This file**                              | Thesis, positioning, market rationale, phases, metrics, expansion gates, kill list |
| [PHASE1_AUDIT.md](./PHASE1_AUDIT.md)       | Current implementation/ops audit and evidence refresh checklist                    |
| [ARCHITECTURE.md](./ARCHITECTURE.md)       | System shape, layers, topology, and data flow                                      |
| [FEATURES.md](./FEATURES.md)               | Feature behavior and implementation references                                     |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup and deployment                                                         |
| [AGENTS.md](../AGENTS.md)                  | Agent-facing API and commerce guide                                                |
| [Guides](./guides/)                        | Operational playbooks, including merchant scorecards and weekly pilot reporting    |
| [ADRs](./adr/)                             | Historical technical decisions; do not fork the strategy                           |
| Root [README.md](../README.md)             | Short pitch and entry points; no second roadmap                                    |

**Document owner:** Product Lead
**Next strategy review:** after the next verified Phase 1 production snapshot
