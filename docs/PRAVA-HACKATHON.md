# Agentic Commerce Hackathon (Prava)

> **OnPoint** submission to the [Agentic Commerce Hackathon](https://docs.prava.space)
> on Prava / Devfolio. Build window: **Aug 1–2, 2026**. Hard deadline:
> **Aug 2, 7:00 PM PT / Aug 3, 7:30 AM IST**. Results by Aug 8.
> Competing in 4 tracks. See ADR [0017](./adr/0017-prava-agent-checkout.md).

## Submission Summary

| Field | Value |
|-------|-------|
| **Status** | Building (hackathon window) |
| **Project name** | OnPoint |
| **Tagline** | Your iMessage stylist: an agent that dresses you, tries it on you, and buys it for you — across real fashion brands, with a card it can only spend the way you approved. |
| **GitHub** | https://github.com/thisyearnofear/onpoint |
| **Demo** | https://beonpoint.netlify.app |
| **API** | https://api.onpoint.famile.xyz |
| **Prava integration** | `prava` CLI (UCP discovery) + REST `POST /v1/sessions` (payment rail) |
| **Linq** | iMessage App card (sandbox: linqapp.com/hackathon) |
| **Existing product** | Live storefront + agent APIs + IDM-VTON try-on + cUSD/x402 + USD₮0 OKX facade |

## The Product (one paragraph)

An AI stylist agent on iMessage. A user texts a style intent ("outfit me for a
rooftop brunch, $120 budget"); OnPoint composes a look from **real UCP fashion
brands** (SKIMS, Alo Yoga, Everlane, Glossier…), runs **IDM-VTON try-on** to
render the actual garments on the user's photo, then the agent **completes
real purchases across merchants** via Prava — each merchant paid with a
separate, merchant-locked, amount-scoped one-time card credential the user
approved with a passkey. The whole flow lives in one **mutating Linq iMessage
App card**: look board → try-on → quote+trust → confirmed orders.

### The original insight

The agent doesn't buy one item — it **fulfills a style intent across multiple
merchants**, issuing a separate scoped Prava credential per brand. One look →
several real orders → one coherent outcome, surfaced in a single iMessage
bubble. No competitor can replicate this (they lack OnPoint's try-on + looks).

## Tracks & Rewards

| Track | Reward | Decision |
|-------|--------|----------|
| **Prava finalists** | $10k Prava credits | **Enter.** Prava IS the checkout (central, not a bolt-on) — real order at a real merchant |
| **Visa Intelligent Commerce** | $5k cash | **Enter.** Scoped one-time credential + amount limits + passkey + layered guardrails = Visa IC verbatim ("credentials, controls, transaction protections"). Visa judges on panel. |
| **Linq iMessage Agent** | $1k cash + $5k Linq credits | **Enter.** The iMessage App card is the entire interface; messaging primitives as UI (👍 tapback = approval, mutating bubble = state machine). Linq staff engineer on panel. |
| **Localhost startup-ready** | $5k Anthropic credits | **Enter.** Live product + real users + distribution; OnPoint continues after the event |
| ~~OpenAI~~ | $10k | **Skip.** No OpenAI in the stack; bolting it on = explicitly deprecated ("partner technology added only to qualify") |
| ~~Senso~~ | $7.5k | **Skip.** Same bolt-on problem |
| ~~NANDA Town~~ | $1k | **Skip.** Adapter/simulation track doesn't fit the product |

## How OnPoint Wins (judging axes)

| Axis | How we score |
|------|-------------|
| **End-to-end functionality** | Real completed order at a real Shopify fashion merchant (`ord_…`) — not a sandbox session that stops at "credential issued." |
| **Creativity / novelty** | Try-on-before-agent-buys + per-merchant scoped credential + message-native mutating card. |
| **User value / market feasibility** | Real fashion brands, real try-on, real purchases — a product people would use. |
| **Prava implementation** | Prava IS the checkout: UCP discover → quote → scoped-card checkout → confirmed order. Central, reliable, meaningful. |
| **Track implementation** | Linq card = the interface; Visa IC = the credential/guardrail model. |
| **Product experience** | One coherent mutating iMessage bubble, no long explanation. |
| **What happens next** | OnPoint is already a live product; this adds a card-rail agent checkout it continues with. |

## Timeline

| Milestone | Date |
|-----------|------|
| Pre-kickoff: dashboard, sandbox walkthrough, prod-access request, Linq sandbox, skills install | Jul 31 |
| Kickoff / build window opens | Jul 31, 7 PM PT / Aug 1, 7:30 AM IST |
| Build day 1 (thin spine: text → quote → checkout → real order) | Aug 1 |
| Build day 2 (try-on + trust UI + stretch + demo video + submission) | Aug 2 |
| **Hard deadline** | **Aug 2, 7:00 PM PT / Aug 3, 7:30 AM IST (2:00 AM UTC Aug 3)** |
| Results | by Aug 8 |

## Pre-Kickoff Checklist (do before kickoff)

- [ ] Request temporary production access via Prava Discord/support — **gating risk**; lead with live product + fashion-merchant fit + real-card willingness + complete transaction flow.
- [ ] Register `dashboard.prava.space`, get `pk_test_*`/`sk_test_*`, allowlist domain.
- [ ] Run the REST walkthrough cURL end-to-end in sandbox using the
  **team-issued sandbox card from the Prava kickoff email** (30 tx/day limit;
  never commit or record it — sandbox OTP `456789`) to feel passkey → token →
  report-status.
- [ ] Sign up Linq sandbox (`linqapp.com/hackathon`, "Hackathon" dropdown), read iMessage Apps + Payments docs.
- [ ] Install Prava skills: `npx skills add Prava-Payments/prava-skills --skill prava-shopping --global --full-depth`.
- [ ] Link the Prava agent (one-time owner passkey) so `prava shop` works.
- [ ] Join Prava Discord (required).

## Build Sequence

### Day 1 — thin spine first

1. MCP client to Prava (discover → quote → checkout).
2. Linq iMessage App card skeleton (mutating states).
3. **Spine end-to-end**: user text → `prava shop search` → `quote` for one Alo item → card renders quote → `prava shop checkout` with real scoped card → `ord_abc` → card flips to confirmed. **Land the real order before anything else.**

### Day 2 — layer + ship

4. OnPoint styling (look composition) + IDM-VTON try-on into the card.
5. Trust UI: spend ceiling, per-merchant scoping, passkey approval.
6. Stretch: 2nd merchant (multi-merchant scoped checkout) + 👍-tapback voting.
7. Fallback: SDK/API sandbox session route (for live judge demo safety).
8. Record demo video (real order). Write Devfolio submission. Submit before the last hour.

## Disclosure (pre-existing vs built-in-window)

**Pre-existing (disclosed):** OnPoint storefront + agent APIs, IDM-VTON try-on
engine, cUSD/x402 checkout, USD₮0 OKX A2MCP facade, attribution ledger, looks,
curators, MCP server.

**Built during the 48h window:** Prava MCP integration as the agent checkout rail;
UCP discover→quote→checkout orchestration; the mutating Linq iMessage App card;
spend-transparency trust UI; Prava-order → receipt/ledger integration.

## Top Risks & Mitigations

1. **Production access not approved** → SDK/API sandbox session becomes headline
   (weaker but defensible as "sandbox/test flow"). Request access immediately.
2. **Live Shopify checkout changes mid-demo** → recorded video uses the real
   order; live judge demo uses the sandbox fallback.
3. **UCP image → OnPoint try-on compatibility** → validate day 1; fall back to
   free-tier "similar style" render or skip try-on for that item.
4. **Scope creep** → guard the single-order spine ruthlessly; layers only land
   if the spine is green by Saturday noon.

## Linq integration (iMessage Agent track)

Linq gives the agent a real iMessage number + **iMessage Apps** — interactive,
in-place-updatable cards rendered inside the blue bubble. Our mutating card
(look → try-on → quote+trust → confirmed order) lives entirely in one bubble.

**Best practices baked into the integration** (see
[Linq best practices](https://docs.linqapp.com/getting-started/best-practices/)):
- **Opt-out compliance (highest priority):** scan every inbound `message.received`
  webhook for STOP/UNSUBSCRIBE/OPTOUT/CANCEL/END/QUIT + clear "stop messaging me"
  intent → immediately halt all outbound. Treat `health_status: OPTED_OUT` as
  terminal until Linq clears it (don't track opt-in keywords ourselves).
- **Send with `to`, no `from`:** `POST /v3/messages` with `to` only; Linq
  load-balances across the pool, reuses the recipient's healthy line, and
  fails over off flagged lines. Do NOT call `GET /v3/available_number` per send.
- **Inbound-first onboarding:** let the recipient message first; share the
  contact card only after ≥1 outbound message, re-share ~once/day.
- **Engagement cadence:** aim for 3+ replies early and ~1:2 inbound:outbound;
  slow then stop when a recipient stops replying.
- **Health/reputation gating:** check chat `health_status` + line reputation
  before sending; slow/pause on AT_RISK/CRITICAL; handle
  `phone_number.status_updated`. Don't migrate users off an AT_RISK line.
- **Volume:** <~7,000 msgs/day/line; don't open ~50+ brand-new convos per line
  per 24h; ramp daily volume gradually.

**Agent-setup audit.** Linq publishes a read-only audit prompt
("Review your setup with an agent") to check the integration against the
guidelines above. We run it against `apps/api/lib/linq-client.js` +
`apps/api/routes/linq-agent.js` before go-live. Linq docs index:
`https://docs.linqapp.com/llms.txt`.

## Build Status (as of Aug 2, 2026)

### Built + deployed (live on api.onpoint.famile.xyz)

| Component | File | Status |
|-----------|------|--------|
| Prava transport — self-check + sandbox-REST + live CLI modes | `apps/api/lib/prava-client.js` | ✅ all three modes |
| Prava order state machine (trust fields, spend ceiling) | `apps/api/routes/prava-facade.js` | ✅ search→order→try-on→poll→checkout |
| REST sandbox payment rail (session→poll→report) | `prava-facade.js` + `prava-client.js` | ✅ active on production |
| Live-CLI credential contract (token/cryptogram from poll) | `apps/api/lib/prava-client.js` | ✅ aligned to real CLI |
| Decoupled IDM-VTON try-on for UCP garment images | `apps/api/lib/prava-tryon.js` | ✅ placeholder + Replicate modes |
| Linq REST client (real `/v3/chats`, Standard Webhooks) | `apps/api/lib/linq-client.js` | ✅ live send + signature verify |
| Linq webhook receiver (envelope parsing, media, reactions) | `apps/api/routes/linq-agent.js` | ✅ live, all events subscribed |
| Mutating iMessage App card (try-on + trust + confirmed) | `apps/api/routes/prava-card.js` | ✅ all states render |
| Frontend agent checkout card (poll-driven auto-checkout) | `apps/web/components/Agent/AgentCheckoutCard.tsx` | ✅ REST + self-check |

### Live-validated on production

- **Deployed**: all `/prava` and `/linq` routes live (rsync + atomic symlink
  deploy, release `20260802-*`). Not git-pull on server.
- **Prava sandbox-REST active**: `GET /prava/health` → `mode: "sandbox-rest"`,
  `restMode: true`. Real sandbox sessions create against
  `sandbox.api.prava.space` (e.g. order `op_dd1889ae…` → hosted payment URL
  `sandbox.collect.prava.space?session=ses_01KZ…`).
- **Prava CLI agent linked**: `OnPoint Stylist`
  (`aa_01KYZ4G7D34207F74VJSDKBEMM`), status active. `PRAVA_AGENT_LINKED=1`,
  CLI installed at `/opt/onpoint/tools/npm-global/bin/prava` (deploy-owned,
  no sudo).
- **Linq webhook live + verified**: subscription at
  `https://api.onpoint.famile.xyz/linq/webhook?version=2026-02-03`, line
  `+14243945528`, all events, `whsec_` secret set. Forged/unsigned webhooks
  rejected (401); valid signed events accepted (200) and fire the full
  inbound flow.
- **Live UCP discovery**: real Shopify merchants (Alo Yoga, Beyond Yoga,
  Blakely, Elite Eleven) returned with real product IDs + CDN images.

### Known blocker (escalated to Prava)

- **Sandbox device binding returns 409 before WebAuthn.** Real sessions are
  accepted and Prava's dashboard renders the merchant, MCC 5691, product,
  currency, and amount correctly. The team-provided card first produced a
  provisioning 403; Prava's documented card and a second card supplied by the
  team progressed further but failed with `DEVICE_BINDING_FAILED: 409` before
  any passkey prompt. Reproduced in Brave and Safari, with fresh-card and
  saved-card paths. Evidence orders include `ord_01KZ23CV1DW03DXAZY8FKR548S`
  and `ord_01KZ24K86N8JS5K8C5PVQC8KH2`. The issue is escalated to Prava.
- **Honesty boundary:** deterministic self-check validates orchestration only.
  A REST sandbox lifecycle is labeled completed only after Prava issues a test
  credential and accepts `report-status`; only the production CLI path may say
  a merchant order was placed.

### Remaining before submission

1. **Prava sandbox fix** (on Prava) — device binding 409 resolved. Then re-run
   the sandbox E2E to land a real sandbox `completed` lifecycle.
2. **Production access** — application submitted (Dashboard → API Key →
   Production → Hackathon). If approved, set `sk_live_*` (or rely on linked
   CLI agent) to run a real-card order. One env-var flip; architecture already
   handles all three modes.
3. **Record the demo video** — self-check spine (`node scripts/prava-demo.mjs`)
   plus the live sandbox REST session as evidence. Use
   [docs/PRAVA-DEMO-SCRIPT.md](./PRAVA-DEMO-SCRIPT.md) variants: A if a real
   order completed, B (sandbox, no "real order" claims) otherwise.

## Devfolio Submission Content

**Project name:** OnPoint

**Tagline:** Your iMessage stylist: an agent that discovers real fashion brands,
tries them on you, and buys them — with a card it can only spend the way you approved.

**One-paragraph description:**

OnPoint is an AI stylist agent that lives on iMessage. A user texts a style
intent ("outfit me for a rooftop brunch, $120 budget"); the agent composes a
look from real UCP fashion brands (Alo Yoga, Everlane, Glossier…), runs
IDM-VTON virtual try-on to render the actual garments on the user's photo,
then completes a purchase at the merchant via Prava — paid with a
merchant-locked, amount-scoped, one-time card credential the user approved
with a passkey. The entire flow lives in one mutating Linq iMessage App card:
look board → try-on render → quote+trust → confirmed order.

**How Prava is used:**

Prava IS the checkout, not a bolt-on. The agent walks the full Prava buy-flow
as a CLI + REST hybrid. Discovery runs through the `prava` CLI against
production UCP: `shop_search` (discover UCP fashion merchants) → `shop_product`
(resolve variants + binding price). The payment rail runs through Prava's REST
API in sandbox: `POST /v1/sessions` (open a hosted card-entry session, charges
nothing) → the owner enters their card + approves with a passkey → poll
`payment-result` for a single-use tokenized credential → `report-status`
(APPROVED) → confirmed order. (With temporary production access, the same rail
runs through the CLI's `sessions create/poll` + `shop checkout` against a real
card.) Each credential is single-use, merchant-locked, and amount-scoped —
surfaced to the user as trust fields (spend ceiling, merchant scope, guardrails)
before they approve.

**How Linq is used:**

The entire interface is a Linq iMessage App card. The agent sends a text intro
then an `imessage_app` card bubble that mutates in place via
`POST /v3/messages/{id}/update`: try-on render + quote+trust → (user approves
passkey) → 👍 tapback (`reaction.added`, `reaction_type: "like"`) triggers
checkout → card flips to "✓ Order placed — Prava {order_id}". The webhook
receiver parses the real Standard Webhooks envelope, extracts inbound media
(person photos for try-on), and routes reactions to approval.

**Try-on-before-agent-buys (original insight):**

No other agent in this hackathon does this. OnPoint's existing IDM-VTON
engine renders the actual UCP garment image on the user's actual photo
*before* the agent buys — the accurate pre-purchase check, surfaced in the
iMessage card. That's the moat: fit verification + looks composition +
scoped-credential checkout. (v1 completes one merchant per look; sequencing
multiple merchant-scoped credentials from one look is the documented
next step, not shipped behavior.)

**Demo:**

```bash
# Self-contained, runs anywhere (self-check mode, no creds needed):
node scripts/prava-demo.mjs

# With a real iMessage delivery (needs LINQ_API_KEY in env):
LINQ_DEMO_TO=+1... node scripts/prava-demo.mjs --live

# Webhook receiver smoke test (proves the inbound-first flow):
node scripts/prava-webhook-smoke.mjs
```

**Links:**
- GitHub: https://github.com/thisyearnofear/onpoint
- Live app: https://beonpoint.netlify.app
- API: https://api.onpoint.famile.xyz
- ADR: [docs/adr/0017-prava-agent-checkout.md](./adr/0017-prava-agent-checkout.md)
- Demo video script (two variants): [docs/PRAVA-DEMO-SCRIPT.md](./PRAVA-DEMO-SCRIPT.md)

## What worked, what didn't, what we learned (submission section draft)

**Worked:**

- The self-check spine: the full seven-step agent checkout (discover → try-on
  → quote → authorize → approve → checkout → mutating card) runs with 15/15
  assertions from one script, so judges can verify the flow without our
  credentials.
- The Linq iMessage App card as the entire UI. Treating messaging primitives
  as state (👍 tapback = approval, bubble mutation = order state machine)
  meant building no web checkout at all for this flow.
- The trust-first presentation. Spend ceiling, merchant scope, and guardrail
  states are rendered everywhere the credential is mentioned — this made the
  "what can the agent do / what may it spend / what happened" questions
  answerable at a glance.
- Designing for honesty-by-default: the facade refuses to claim a live order
  when Prava CLI status is undetermined (selfCheck safe mode), and the
  homepage feed says "Ready," not "Live," until a real order lands.

**Didn't:**

- Prava sandbox test cards are non-standard PANs; a test PSP (e.g. Stripe test
  mode) declines them, so a "full sandbox charge" is not the demo path —
  sandbox proves session → credential → report-status, and the real merchant
  charge is a production path.
- The Prava CLI is production-only — there is no CLI sandbox — so live
  merchant checkout depends on temporary hackathon production access, which is
  human-reviewed. We sequenced sandbox-excellence first, then requested
  production access with that evidence.
- Multi-merchant sequencing (one look → several merchant-scoped orders) is
  designed but not shipped; v1 completes one merchant per look.

**Learned:**

- Scoped, single-use credentials change the product, not just the plumbing:
  once the user approves a ceiling and a merchant, the agent can be trusted
  with the boring middle of a purchase. Approval UX is the product.
- Fit verification before payment is the difference between a demo and a
  reason to exist — users forgive a simulated sandbox, not a wrong-size order.

## Links

| Resource | URL |
|----------|-----|
| Hackathon docs | https://docs.prava.space |
| Prava dashboard | https://dashboard.prava.space |
| Prava MCP | `https://mcp.pay.prava.space/mcp` |
| Prava skills repo | https://github.com/Prava-Payments/prava-skills |
| Linq hackathon | https://linqapp.com/hackathon |
| Devfolio | (hackathon dashboard) |
| ADR 0017 | [docs/adr/0017-prava-agent-checkout.md](./adr/0017-prava-agent-checkout.md) |
| Strategy | [docs/STRATEGY.md](./STRATEGY.md) |
