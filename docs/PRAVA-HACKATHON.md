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
| **Tagline** | Your iMessage stylist: discover live fashion products, try them on, and prepare a tightly scoped Prava checkout. |
| **GitHub** | https://github.com/thisyearnofear/onpoint |
| **Demo** | https://beonpoint.netlify.app |
| **API** | https://api.onpoint.famile.xyz |
| **Prava integration** | `prava` CLI (UCP discovery) + REST `POST /v1/sessions` (payment rail) |
| **Linq** | iMessage App card (sandbox: linqapp.com/hackathon) |
| **Existing product** | Live storefront + agent APIs + IDM-VTON try-on + cUSD/x402 + USD₮0 OKX facade |

## The Product (one paragraph)

An AI stylist agent on iMessage. A user texts a style intent ("outfit me for a
rooftop brunch, $120 budget"); OnPoint discovers live UCP fashion products,
runs IDM-VTON try-on, and creates a real Prava sandbox session containing the
selected merchant, item, and requested amount. The user continues on Prava's
hosted card surface. Current sandbox testing is blocked before WebAuthn and
credential issuance by `DEVICE_BINDING_FAILED: 409`; no Prava credential or
merchant order has completed. The production CLI checkout path is implemented
but remains unvalidated pending access.

### The original insight

The product insight is **fit verification before agent checkout**: combine live
merchant discovery with OnPoint's existing try-on engine, then request the
narrowest possible payment permission. The shipped v1 prepares one merchant
session. Multi-merchant sequencing is target architecture, not shipped behavior.

## Tracks & Rewards

| Track | Reward | Decision |
|-------|--------|----------|
| **Prava finalists** | $10k Prava credits | **Enter.** Prava is central: real UCP discovery + real sandbox session creation; credential issuance currently provider-blocked. |
| **Visa Intelligent Commerce** | $5k cash | **Enter.** The UI exposes the requested merchant, amount, required passkey, and expected scoped credential model without claiming issuance. |
| **Linq iMessage Agent** | $1k cash + $5k Linq credits | **Enter.** Live iMessage send and signed inbound webhooks are validated; status-card mutation is implemented but not observed after a completed Prava lifecycle. |
| **Localhost startup-ready** | $5k Anthropic credits | **Enter.** OnPoint is an existing live product; this new workflow is a credible continuation if the payment-provider blocker is resolved. |
| ~~OpenAI~~ | $10k | **Skip.** No OpenAI in the stack; bolting it on = explicitly deprecated ("partner technology added only to qualify") |
| ~~Senso~~ | $7.5k | **Skip.** Same bolt-on problem |
| ~~NANDA Town~~ | $1k | **Skip.** Adapter/simulation track doesn't fit the product |

## How OnPoint Wins (judging axes)

| Axis | How we score |
|------|-------------|
| **End-to-end functionality** | Live UCP discovery → try-on → real Prava sandbox session → hosted card surface; blocked before WebAuthn with reproducible provider evidence. |
| **Creativity / novelty** | Try-on-before-agent-checkout + explicit requested controls + message-native status card. |
| **User value / market feasibility** | Live fashion products and pre-purchase visualization solve a clear fit-confidence problem. |
| **Prava implementation** | Prava session creation is central to the new workflow, not a payment button added afterward. No completed transaction is claimed. |
| **Track implementation** | Linq send/webhook are live; Visa-style controls are shown as requested/expected until Prava issues a credential. |
| **Product experience** | An intro message plus status card, with approval on Prava's hosted surface. |
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

**Built during the 48h window:** Prava CLI UCP discovery; REST sandbox-session
creation and polling/reporting state machine; Linq intro + iMessage App status
card; signed webhook handling; try-on-to-session orchestration; and explicit
requested-control UI. Prava receipt/ledger integration was not shipped.

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

Linq gives the agent a real iMessage number + **iMessage Apps**. OnPoint sends an
intro message followed by a status card; approval opens Prava's hosted surface.
Live send and signed webhook handling are validated. Updating the card after a
completed Prava lifecycle is implemented but has not been observed end to end.

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
| Prava transport — self-check + sandbox REST + production CLI branches | `apps/api/lib/prava-client.js` | ✅ implemented; only discovery + session creation live-validated |
| Prava state machine and requested-control view | `apps/api/routes/prava-facade.js` | ✅ implemented; completion branches unvalidated |
| REST sandbox lifecycle (session→poll→report) | `prava-facade.js` + `prava-client.js` | ⚠️ session creation validated; blocked before credential issuance |
| Production CLI credential/checkout contract | `apps/api/lib/prava-client.js` | ⚠️ implemented and linked; checkout unvalidated |
| Decoupled IDM-VTON try-on for UCP garment images | `apps/api/lib/prava-tryon.js` | ✅ placeholder + Replicate modes |
| Linq REST client (real `/v3/chats`, Standard Webhooks) | `apps/api/lib/linq-client.js` | ✅ live send + signature verify |
| Linq webhook receiver (envelope parsing, media, reactions) | `apps/api/routes/linq-agent.js` | ✅ live, all events subscribed |
| iMessage App status card | `apps/api/routes/prava-card.js` | ✅ render states implemented; completed mutation unobserved |
| Frontend session/status card | `apps/web/components/Agent/AgentCheckoutCard.tsx` | ✅ REST + explicitly labeled self-check |

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

### Known blocker (ready for Prava support)

- **Sandbox credential issuance fails inside Prava/Visa.** Real sessions are
  accepted and Prava's dashboard renders the merchant, MCC 5691, product,
  currency, and amount correctly. The team-provided card first produced a
  provisioning 403; Prava's documented card failed with
  `DEVICE_BINDING_FAILED: 409` before any passkey prompt in Brave and Safari.
  A later team-recommended card ending 2127 reached the issuer OTP step, then
  failed with `FETCH_AGENTIC_CREDS_ERROR: Visa 400 — Fetching cryptogram failed`
  while the dashboard still logged `Card check skipped — Lookup not configured`.
  The latest evidence record is `ord_01KZ273SD0AYP5MY9G8SAZF06D`. These are
  Prava sandbox session records, not merchant-order confirmations.
- **Honesty boundary:** deterministic self-check validates orchestration only.
  A REST sandbox lifecycle is labeled completed only after Prava issues a test
  credential, an external sandbox checkout is attempted, and Prava accepts its
  real processor outcome via `report-status`; only the production CLI path may
  say a merchant order was placed.

### Remaining before submission

1. **Prava sandbox fix** (on Prava) — device binding 409 resolved. Then re-run
   the sandbox E2E to land a real sandbox `completed` lifecycle.
2. **Production access** — application submitted. The production CLI path is
   implemented and the agent is linked, but a real checkout remains unvalidated.
   Production REST would additionally require an actual merchant checkout before
   `report-status`.
3. **Record the demo video** — self-check spine (`node scripts/prava-demo.mjs`)
   plus the live sandbox REST session as evidence. Use
   [docs/PRAVA-DEMO-SCRIPT.md](./PRAVA-DEMO-SCRIPT.md) variants: A if a real
   order completed, B only if the sandbox lifecycle completed, or C while the
   provider blocker remains.

## Devfolio Submission Content

**Project name:** OnPoint

**Tagline:** Your iMessage stylist: discover live fashion products, try them on,
and prepare a tightly scoped Prava checkout.

**One-paragraph description:**

OnPoint is an AI stylist agent on iMessage. It discovers live UCP fashion
products, runs virtual try-on, and creates a real Prava sandbox session with the
selected merchant, product, and requested amount. The user continues on Prava's
hosted card surface. Current sandbox testing is reproducibly blocked before
WebAuthn by `DEVICE_BINDING_FAILED: 409`, so we do not claim credential issuance,
a completed sandbox lifecycle, or a merchant order.

**How Prava is used:**

Prava is central, not a bolt-on. Discovery uses `prava shop search/product`.
REST sandbox mode uses the discovered listed price as the session amount; it
does not obtain a binding merchant quote or charge a merchant. The intended
remainder is hosted card entry → passkey → `payment-result` credential →
external test outcome → `report-status`. The current provider error occurs
before passkey and credential issuance. The production CLI checkout branch is
implemented and linked but unvalidated pending access.

**How Linq is used:**

The Linq experience sends an intro message plus an `imessage_app` status card.
Approval happens on Prava's hosted surface. Live send and signed Standard
Webhooks handling are validated. The 👍 reaction handler and card update are
implemented, but confirmation mutation has not been observed because no Prava
credential lifecycle has completed.

**Try-on-before-agent-checkout (original insight):**

OnPoint combines its existing try-on engine with live UCP product discovery so
fit can be checked before payment permission is requested. The shipped v1
prepares one merchant session. Multi-merchant sequencing is documented future
work, not shipped behavior.

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

- The deterministic self-check walkthrough exercises orchestration shape and
  labels itself fixture-only; it is not transaction proof.
- Real Linq sends, signed webhook verification, live UCP discovery, and real
  Prava sandbox-session creation are independently validated.
- The trust-first presentation distinguishes requested amount and merchant,
  expected credential controls, and observed outcome, so the user can see what
  was requested and what actually happened.
- Designing for honesty-by-default: self-check, sandbox lifecycle, and merchant
  order use distinct states and claims.

**Didn't:**

- Prava's hosted sandbox flow currently fails at device binding before WebAuthn
  and credential issuance. Therefore sandbox currently proves session creation
  and provider failure evidence—not credential or transaction completion.
- The Prava CLI is production-only — there is no CLI sandbox — so live
  merchant checkout depends on temporary hackathon production access, which is
  human-reviewed. We sequenced sandbox-excellence first, then requested
  production access with that evidence.
- Multi-merchant sequencing (one look → several merchant-scoped orders) is
  designed but not shipped; v1 prepares one merchant session per look.

**Learned:**

- Scoped, single-use credentials change the product, not just the plumbing:
  once the user approves a ceiling and a merchant, the agent can be trusted
  with the boring middle of a purchase. Approval UX is the product.
- Fit verification before payment is the difference between a demo and a
  reason to exist — users forgive a clearly labeled sandbox demo, not a wrong-size order.

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
