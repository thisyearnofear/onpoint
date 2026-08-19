# Hackathon Archive

OnPoint used several 2026 hackathons as proof points for the fashion execution rail. **All events are closed.**

| Event | When | Status | What shipped |
| --- | --- | --- | --- |
| YouCam Apparel VTO | Aug 2026 | **Live in production** | YouCam cloth-v4 as primary paid try-on provider — see [YOUCAM-VTO.md](./YOUCAM-VTO.md) |
| [Celo Builders — Agentic Payments and DeFAI](https://celobuilders.xyz/hackathons/agentic-payments-defai) | Jul–Aug 2026 | Shipped (pre-event core) | x402 try-on/checkout on Celo, ERC-8021 attribution tags, OKX A2MCP facade |
| Qwen Cloud — Autopilot Agent | Jul 2026 | Shipped (pre-event core) | Qwen Cloud vision/text integration, MCP server, Alibaba OSS mirror |
| Agentic Commerce (Prava × Visa × Linq) | Aug 2026 | Not deployed | Prava UCP session flow, Linq iMessage webhooks — sandbox-validated only |

---

## YouCam (live)

Full doc: [YOUCAM-VTO.md](./YOUCAM-VTO.md)

- **Client:** `apps/api/lib/youcam-vto.js`
- **Smoke test:** `scripts/youcam-tryon-smoke.mjs`
- **Demo video:** https://youtu.be/Y4u5q9jzlPs

## Celo Builders

- **Attribution tag:** `celo_ce9e004195d5` (embedded in every 402 `dataSuffix`)
- **ADRs:** [0012](./adr/0012-x402-facilitator-integration.md), [0016](./adr/0016-okx-a2mcp-facade.md)

## Qwen Cloud

- **Packages:** `packages/qwen-cloud/`, `packages/qwen-mcp/`, `packages/storage/src/oss.ts`
- **Script:** `scripts/qwen-autopilot.mjs`

## Prava / Linq (not deployed)

- **ADR:** [0017-prava-agent-checkout.md](./adr/0017-prava-agent-checkout.md)
- **Routes:** `apps/api/routes/prava-facade.js`, `prava-sandbox.js`, `linq-agent.js`
- **Demo:** `node scripts/prava-demo.mjs` (fixture-only)
- Sandbox reached `Creds_Generated` / `credential_ready`; no merchant order claimed
