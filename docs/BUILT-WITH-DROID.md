# Built with Droid

OnPoint was developed with [Factory Droid](https://factory.ai/product/droid), an autonomous software engineering agent. This doc records what Droid shipped here, derived from git co-author credits (`Co-authored-by: factory-droid[bot]`).

## Summary

| | |
| --- | --- |
| **Co-authored commits** | 58 (May–Aug 2026) |
| **First** | 2026-05-26 — ERC-8004 agent registration |
| **Last** | 2026-08-03 — Prava/Linq iMessage handoff |
| **Scope** | `apps/api`, `apps/web`, `apps/bridge`, `packages/*` |

### Adoption curve (Droid commits/month)

| May | Jun | Jul | Aug |
| --- | --- | --- | --- |
| 13 | 20 | 9 | 16 |

## What Droid built

### Agent commerce rail

- ERC-8004 registration and on-chain agent identity
- x402 facilitator integration (Celo gasless USDC path)
- Tiered try-on pricing ($0.03 digital / $0.05 physical)
- ERC-8021 attribution tags on every 402 response
- [`AGENTS.md`](../AGENTS.md) and `llms.txt` for external agent onboarding
- ADR 0018 — x402-first monetization model

Key commits: `b041fae`, `cfac9b0`, `f144c8a`, `cf29a80`, `1136f06`

### Human try-on UX

- Live stylist camera flow — browser-specific error recovery, session teardown, start-screen polish
- Provider outcome analytics on the try-on engine
- Storefront try-on deep-links and unified `ProductResult` type

Key commits: `8012e3f`, `4e9b465`, `9ec801c`, `de7257e`, `f69a9a8`

### Prava / Linq checkout prototype

Sandbox-validated permissioned checkout — **not deployed to production**.

- UCP discovery → binding quote → Prava scoped-credential session
- Linq iMessage App card and signed webhook handler
- `@prava-sdk/cli` buy-flow alignment and evidence-boundary hardening

Key commits: `bb9d1d8`, `e8d1c67`, `1ee4d36`, `ba16db7` (+ 6 follow-ups)

See [ADR 0017](./adr/0017-prava-agent-checkout.md) and [HACKATHONS.md](./HACKATHONS.md).

### Agent web bridge

- TinyFish async streaming and anti-bot hardening
- Bright Data SERP API as Tier 2.5 search provider
- Browser profile wiring, SSE contract, kill switch (ADR 0008 review)
- Bridge PM2 deploy entry + health check on Hetzner

Key commits: `7cdf749`, `4adc956`, `473c239`, `1c25e96`

### Product UI

- Mobile-first bottom nav, polaroid gallery, scroll-driven history
- Honesty-first landing redesign and pre-launch UX sweep
- Pricing and developer pages with agent commerce showcase
- Homepage decomposition, navigation unification, mobile legibility fixes

Key commits: `c27784a`, `1e46a71`, `79b929a`, `ff421a4`, `7b3a9bc`

### Other

- GoodDollar Wave 1 skeleton (ADR, enablers) — `be73ded`
- Redis hardening + memory fallback — `a80e6c0`
- Hetzner graceful fallback + worker restoration docs — `a20f383`
- Polaroid share buttons + R2 token auth — `c1a6b2e`

## Not Droid (post Aug 3, other tools)

These shipped after the last Droid co-author commit and have no `factory-droid[bot]` credit:

| Feature | Commit(s) |
| --- | --- |
| [YouCam VTO](./YOUCAM-VTO.md) (live in production) | `23a8db5`, `94876d9` |
| Trusted-offer contract + stock-race refunds | `3dfca30`, `a259fa3` |
| OKX A2MCP facade (XLayer USD₮0) | `688db75` |
| Agent looks + share-card collages | `7bb5e74` and series |
| Qwen Cloud autopilot + MCP server | `73e8cb2`, `2d5a329` |

## Verify locally

```bash
# Count Droid co-authored commits
git log --all --format='%B' | rg -c 'factory-droid\[bot\]'

# List them
git log --all --format='%h %ad %s' --date=short | while read h d _; do
  git log -1 --format='%B' "$h" | rg -q 'factory-droid\[bot\]' && echo "$d $h"
done
```
