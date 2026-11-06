# HACKATHON.md — NEAR HACKATHON (Nov 1–14, 2026)

> Project: **OnPoint — Agentic Fashion Commerce**
> Track: **Agent Economy** (secondary: **Real-World Money**)
> Repo: https://github.com/thisyearnofear/onpoint
> Live: https://onpoint.trustfall.xyz

## 1. Event essentials
- Build window: **Nov 1 00:00 UTC → Nov 14 23:59 UTC, 2026**.
- Judging: Nov 16–18; results by Nov 18 23:59 UTC.
- Submission requires: public repo + public demo post on X (video/screenshots), plus form with project name, description (20–2000 chars), team lead/email/size, preferred track, NEAR account address for payout, repo link, demo link.
- One submission per team; cannot be edited after sending.
- README must make it easy for judges to run the prototype with “do X, see Y” steps.

## 2. Why OnPoint is a strong NEAR candidate
OnPoint already turns live fashion inventory into **fit-aware, machine-readable, locally payable offers** for both humans and agents. It has:
- `/.well-known/agent.json` manifest
- x402 paid try-on and checkout
- ERC-8004 agent identity on Celo
- MCP tools for third-party agents
- Curator storefronts and payouts

The NEAR story is direct: **an AI agent pays for a service (try-on/checkout) and value moves across chains to the curator.**

## 3. NEAR tools we will use (name these in README)
- **NEAR Intents** — let the agent pay in one asset and settle the curator in another.
- **1-Click Swap SDK** — convert buyer/agent funds to the curator’s preferred asset.
- **Chain Signatures** — allow the agent to authorize/control value across chains without holding a root key.
- **Sub-accounts + function-call keys** — scoped agent identity and spend permissions (“agent never holds the key”).
- **NEAR AI Cloud** — optional: fit/try-on inference or agent decisioning.
- **Named accounts** — human-readable agent/curator identities.

## 4. Minimum viable win (2 weeks)
Scope to **one curator, one item, one agent flow**.

**Zero-curator fallback:** the platform-operated `onpoint-store` storefront guarantees demo inventory regardless of curator onboarding — a house catalog whose NEAR payouts land on `store.onpoint.testnet`. Real curators are a bonus, not a blocker.

Current state (implemented): NEAR payment rail on `POST /api/agent/try-on` and `POST /api/curator/{slug}/order` — `nearAccountId` + `nearTxHash` proof, trustless JSON-RPC verification (`apps/api/lib/near-payments.js`), direct-to-curator settlement. Reproduce locally: `cd scripts/near-spike && npm i && node provision.mjs && node agent-demo.mjs` (narrated end-to-end run, ~2 min). Spike databases live in `scripts/near-spike`'s own env — never repoint `apps/api/.env`'s `NEON_DATABASE_URL` at a demo project (the 2026-11-03 incident: the near-demo DB went stale against prod migrations and every artifact route 500'd locally).

1. Agent discovers item via manifest/API.
2. Agent requests paid try-on.
3. Agent pays on NEAR (or via NEAR Intent from another asset).
4. Agent receives try-on result + on-chain receipt.
5. Agent completes checkout.
6. Curator receives NEAR/stablecoin payout + receipt.

Out of scope for the hackathon: ChatGPT plugin directory approval, multi-curator scale, full M-Pesa production rollout.

## 5. Integration plan

### Week 1 — NEAR payment rail
- Add NEAR account/config for agent treasury and curator payout.
- Implement NEAR payment challenge/response alongside existing x402 flow.
- Record on-chain receipt reference in order/try-on records.
- Add 1-Click Swap path for asset conversion.
- Keep Celo/x402 path working as fallback.

### Week 2 — demo + submission
- Polish one end-to-end agent purchase.
- Add “do X, see Y” README steps.
- Record 60–90s X demo video.
- Publish repo + X post.
- Submit form.

## 6. Demo script (do X, see Y)
1. Open `/.well-known/agent.json` → see payable try-on/checkout offer.
2. Agent calls `try_on` → sees payment challenge.
3. Agent pays on NEAR → sees transaction receipt + try-on result.
4. Agent calls `buy_item` → sees order confirmation.
5. Curator dashboard/wallet → sees NEAR payout + receipt.

## 7. Risks and fallbacks
- **Risk:** NEAR payment integration slips.
  **Fallback:** keep x402/Celo checkout working and present NEAR as the primary showcased rail with a recorded successful NEAR transaction.
- **Risk:** scope creep into plugin packaging.
  **Fallback:** plugin stays optional; core is NEAR checkout.
- **Risk:** cross-chain swap complexity.
  **Fallback:** demo agent pays directly in NEAR first; add swap as enhancement.

## 8. Submission checklist
- [ ] Repo public by Nov 14 23:59 UTC
- [ ] X demo post with video/screenshots and “built for NEAR HACKATHON”
- [ ] README has setup + “do X, see Y” steps
- [ ] HACKATHON.md present
- [ ] NEAR account address for prize payout
- [ ] Form submitted once, details double-checked

## 9. Related docs
- Agent commerce guide: `docs/guides/agent-commerce.md`
- Architecture: `docs/ARCHITECTURE.md`
- Strategy: `docs/STRATEGY.md`
- NEAR integration details: `docs/NEAR_HACKATHON.md`
