# OnPoint Docs

One canonical doc per concern. [STRATEGY.md](./STRATEGY.md) owns positioning, phases, and metrics — other docs defer to it rather than restating them.

## Start here

| Audience            | Read first                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| New developer       | [README](../README.md) → [GETTING_STARTED.md](./GETTING_STARTED.md)     |
| External agent/dev  | [AGENTS.md](../AGENTS.md) → [guides/agent-commerce.md](./guides/agent-commerce.md) |
| Product/strategy    | [STRATEGY.md §7 Phase 0](./STRATEGY.md#phase-0--consumer-engine-and-retention-current) → [ADR 0023](./adr/0023-consumer-engine-first-curators-deferred.md) → [ops/retention.md](./ops/retention.md) |

## Canonical docs

| Doc                                        | Owns                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| [STRATEGY.md](./STRATEGY.md)               | Thesis, positioning, phases, metrics, expansion gates, kill list |
| [ARCHITECTURE.md](./ARCHITECTURE.md)       | System shape, layers, data flow                                 |
| [FEATURES.md](./FEATURES.md)               | Feature behavior and implementation references                  |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup, env vars, deployment overview                      |
| [deploy/README.md](../deploy/README.md)    | API deploy pipeline, CI, process topology, troubleshooting      |
| [AGENTS.md](../AGENTS.md)                  | Agent-facing API reference (single source for endpoints)        |

## ChatGPT plugin packaging

- [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md) — shared Oct 2026 shipping rules
- [CHATGPT_PLUGIN_CONNECT.md](./CHATGPT_PLUGIN_CONNECT.md) — connect `https://mcp.onpoint.famile.xyz` in ChatGPT
- [CHATGPT_PLUGIN_EVAL.md](./CHATGPT_PLUGIN_EVAL.md) — intent eval prompts
- [CHATGPT_PLUGIN_STARTER_PROMPTS.md](./CHATGPT_PLUGIN_STARTER_PROMPTS.md) — directory Example Prompts
- Scoreboard (usage → monetisation) — section in [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md#usage--monetisation-scoreboard-plugin-lane)

## guides/ — external how-tos

For people building against OnPoint.

- [agent-commerce.md](./guides/agent-commerce.md) — discover → try-on → order → earnings
- [referral-tracking.md](./guides/referral-tracking.md) — 2.5% referral commissions

## ops/ — internal runbooks

Not for external consumers.

- [retention.md](./ops/retention.md) — Phase 0 retention and engagement definitions, instrumentation gaps
- [deployment.md](./ops/deployment.md) — deploy runbook: API auto-deploy + manual DB migrations, web (Fly `onpoint`), MCP (`onpoint-mcp`), known gaps
- *Dormant until curators are activated (ADR 0023):* [phase1-audit.md](./ops/phase1-audit.md), [merchant-onboarding-scorecard.md](./ops/merchant-onboarding-scorecard.md), [weekly-pilot-report.md](./ops/weekly-pilot-report.md)
- [curator-payout-wallets.md](./ops/curator-payout-wallets.md) — custodial/Magic/MiniPay payouts
- [curator-imagery.md](./ops/curator-imagery.md) — listing photo seeding
- [whatsapp-setup.md](./ops/whatsapp-setup.md) — Meta Business API setup
- [mpesa-setup.md](./ops/mpesa-setup.md) — Daraja STK push: config, sandbox test, go-live, known weaknesses
- [growth-loop.md](./ops/growth-loop.md) — look-share attribution, funnel and K-factor definitions
- [invite-flow-teardown.md](./ops/invite-flow-teardown.md) — share-flow teardown procedure and fix backlog
- [../deploy/README.md](../deploy/README.md) — API deploy pipeline, CI secrets, rollback, troubleshooting
- [youcam-vto.md](./ops/youcam-vto.md) — paid try-on provider config
- [minipay.md](./ops/minipay.md), [auth.md](./ops/auth.md) — integration notes (auth.md also covers admin console access)
- `hetzner.md`, `monitoring.md` *(local-only, gitignored — server ops details)*

## hackathon/

- [../HACKATHON.md](../HACKATHON.md) — NEAR HACKATHON submission details
- [NEAR_HACKATHON.md](./NEAR_HACKATHON.md) — NEAR integration plan and demo steps

## adr/ — decision records

Historical technical decisions. Immutable — new decisions get new ADRs. Current product phase is owned by STRATEGY.md and FEATURES.md; these records explain why.

- [0028](./adr/0028-navigation-consolidation-places-not-flows.md) — nav is three places and one footer; purchase, styling and saved renders become actions on an artifact (supersedes 0022 §4a and 0023 §3, navigation clauses only)
- [0027](./adr/0027-frontend-design-system-consolidation.md) — one design system, honest metrics, non-async root layout; renumbered 2026-11-06 from a second file committed under 0024
- [0026](./adr/0026-couple-styling-loop.md) — couple styling loop on existing rails
- [0025](./adr/0025-shared-fitting-room-and-gift-a-look.md) — shared fitting room and Gift-a-look
- [0024](./adr/0024-consumer-wardrobe-studio-and-interaction-reuse.md) — wardrobe-studio homepage; supersedes only ADR 0015's consumer-UI exclusion
- [0023](./adr/0023-consumer-engine-first-curators-deferred.md) — consumer web first; curators deferred, not removed
- [0022](./adr/0022-runway-game-hosted-messaging.md) — Runway engine, guardrails, and measurement; web phasing superseded by 0023
- [0019](./adr/0019-share-attribution-on-funnel-events.md) — share ids on funnel events
- [0010](./adr/0010-agent-storefront-checkout.md), [0011](./adr/0011-erc8004-registration-and-digital-curators.md), [0002](./adr/0002-curator-primitive.md) — agent checkout, digital curators, and the curator primitive

Older ADRs (0001–0009, 0012–0018, 0020–0021) stay in [adr/](./adr/) and are linked from the docs that still depend on them.

There is no ADR 0007. No file with that number has ever existed in this repo's history, so the gap in the sequence is a numbering gap, not a missing record — do not "fill" it.

## research/

Market research inputs. Verify sources before external citation.

- [messaging-game-formats.md](./research/messaging-game-formats.md) — consumer game formats, Linq/Photon channel facts (evidence for ADR 0022)

## Rules

1. One doc owns each topic — link, don't copy.
2. No dated snapshots, promo deadlines, or hackathon claims in permanent docs.
3. Status words follow the STRATEGY legend: implemented / deployed / live-validated / repeatedly proven.

## paypal-hackathon/

- [PAYPAL_HACKATHON.md](./PAYPAL_HACKATHON.md) — PayPal integration plan and demo steps
