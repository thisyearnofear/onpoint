# Agentic Commerce Hackathon (Prava)

> **OnPoint** submission to the [Agentic Commerce Hackathon](https://docs.prava.space)
> on Prava / Devfolio. Build window: **Aug 1–2, 2026**. Hard deadline:
> **Aug 2, 7:00 PM PT / Aug 3, 7:30 AM IST**. Results by Aug 8.
> Competing in 4 tracks. See ADR [0017](./adr/0017-prava-agent-checkout.md).

## Submission Summary

| Field | Value |
|-------|-------|
| **Status** | Submission-ready |
| **Project name** | OnPoint |
| **Tagline** | The fashion agent that earns permission to buy. |
| **GitHub** | https://github.com/thisyearnofear/onpoint |
| **Demo** | https://beonpoint.netlify.app |
| **API** | https://api.onpoint.famile.xyz |
| **Prava integration** | `prava` CLI (UCP discovery) + REST `POST /v1/sessions` (payment rail) |
| **Linq** | iMessage App card (sandbox: linqapp.com/hackathon) |
| **Existing product** | Live storefront + agent APIs + IDM-VTON try-on + cUSD/x402 + USD₮0 OKX facade |

## The Product (one paragraph)

OnPoint turns fashion intent into controlled action. It discovers live UCP
inventory, checks the garment on the shopper, locks item, shipping, and tax into
a binding quote, then asks Prava for the narrowest useful permission: one
merchant and one spending ceiling. A validated Prava sandbox transaction reached
`Creds_Generated`; OnPoint reached `credential_ready` without exposing the
credential. Linq makes intent and status message-native. When the subsequent
merchant outcome became unknowable, OnPoint stopped without retrying or
inventing success. Prava confirmed that `Creds_Generated` is a successful Prava
transaction; no Alo Yoga merchant order or charge is claimed.

### The original insight

The product insight is **fit verification before agent checkout**: combine live
merchant discovery with OnPoint's existing try-on engine, then request the
narrowest possible payment permission. The shipped v1 prepares one merchant
session. Multi-merchant sequencing is target architecture, not shipped behavior.

## Tracks & Rewards

| Track | Reward | Decision |
|-------|--------|----------|
| **Prava finalists** | $10k Prava credits | **Enter.** Prava is central: real UCP discovery + real sandbox session and credential issuance. |
| **Visa Intelligent Commerce** | $5k cash | **Enter.** The UI exposes the requested merchant, amount, hosted verification, and observed scoped-credential readiness. |
| **Linq iMessage Agent** | $1k cash + $5k Linq credits | **Enter.** Live iMessage send and signed inbound webhooks are validated; status-card mutation is implemented but not observed after a completed Prava lifecycle. |
| **Localhost startup-ready** | $5k Anthropic credits | **Enter.** OnPoint is an existing live product; this new workflow is a credible continuation if the payment-provider blocker is resolved. |
| ~~OpenAI~~ | $10k | **Skip.** Existing generic style-assistance usage did not materially drive this new transaction; bolting it on now would violate the spirit of the track. |
| ~~Senso~~ | $7.5k | **Skip.** Same bolt-on problem |
| ~~NANDA Town~~ | $1k | **Skip.** Adapter/simulation track doesn't fit the product |

## How OnPoint Wins (judging axes)

| Axis | How we score |
|------|-------------|
| **End-to-end functionality** | Live UCP discovery → binding quote → fit decision → explicit Prava permission request → hosted verification → successful `Creds_Generated` transaction → truthful merchant-outcome boundary. |
| **Creativity / novelty** | Try-on-before-agent-checkout + explicit requested controls + message-native status card. |
| **User value / market feasibility** | Live fashion products and pre-purchase visualization solve a clear fit-confidence problem. |
| **Prava implementation** | Prava discovery, hosted verification, and credential issuance are central—not a payment button added afterward. A successful Prava sandbox transaction is claimed; no merchant order is claimed. |
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
- **Validated sandbox transport:** the hackathon sandbox pins the assigned line
  through `POST /v3/chats` with `from` + `to`, matching the Linq playground
  contract used in the live validation. A multi-line production rollout will
  move to `POST /v3/messages` with `to` only for Linq-managed load balancing.
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

## Build Status (as of Aug 3, 2026)

### Built + deployed (live on api.onpoint.famile.xyz)

| Component | File | Status |
|-----------|------|--------|
| Prava transport — self-check + sandbox REST + production CLI branches | `apps/api/lib/prava-client.js` | ✅ implemented; discovery, quote, session, and credential issuance live-validated |
| Prava state machine and requested-control view | `apps/api/routes/prava-facade.js` | ✅ implemented; credential-ready and unknown-outcome branches live-validated |
| REST sandbox lifecycle (session→poll→external checkout→report) | `prava-facade.js` + `prava-client.js` | ⚠️ real credential issuance validated; one checkout attempt timed out with unknown outcome, so no status was reported |
| Production CLI credential/checkout contract | `apps/api/lib/prava-client.js` | ⚠️ implemented and linked; checkout unvalidated |
| Decoupled IDM-VTON try-on for UCP garment images | `apps/api/lib/prava-tryon.js` | ✅ placeholder + Replicate modes |
| Linq REST client (real `/v3/chats`, Standard Webhooks) | `apps/api/lib/linq-client.js` | ✅ live send + signature verify |
| Linq webhook receiver (envelope parsing, media, reactions) | `apps/api/routes/linq-agent.js` | ✅ live, all events subscribed; Redis-backed event deduplication |
| Web → Linq same-order handoff | `AgentCheckoutCard.tsx` + `linq-agent.js` | ✅ inbound-first `TRACK op_…` handoff reuses the current order; live end-to-end observation pending |
| iMessage App status card | `apps/api/routes/prava-card.js` | ✅ render states implemented; completed mutation unobserved |
| Prava hosted return | `apps/web/app/prava/return` | ✅ order-aware handoff; no redirect to the unrelated Celo agent dashboard |
| Frontend session/status card | `apps/web/components/Agent/AgentCheckoutCard.tsx` | ✅ Product → Fit → Permission → Outcome; compact UCP/fit/Prava-Visa/Linq evidence rail |
| OpenAI intent compiler | `apps/api/lib/commerce-intent.js` | ⚠️ integrated with truthful direct-query fallback; production key still required before claiming live OpenAI evidence |

### Verification after submission hardening

- **Prava integration tests:** 11/11 passed, including a 64 KB base64 photo
  upload and proof that no session is created without an explicit fit decision.
- **Web typecheck:** passed.
- **Production web build:** passed.
- **Focused commerce regressions:** 18/18 passed.
- **Web tests:** 313/313 passed.
- **Fixture-only Product → Fit → Permission walkthrough:** passed.
- **Linq webhook smoke:** passed, including duplicate-event suppression and
  reaction-driven status refresh. Fixture output remains explicitly non-transactional.

### Live-validated on production

- **Deployed**: all `/prava` and `/linq` routes live (rsync + atomic symlink
  deploy, release `20260803-044459`). Not git-pull on server.
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

### Sandbox evidence and remaining boundary

- **Sandbox credential issuance now succeeds at the binding total.** Earlier cards produced a
  provisioning 403, `DEVICE_BINDING_FAILED: 409`, and
  `FETCH_AGENTIC_CREDS_ERROR: Visa 400`. Prava then supplied a card ending 2119;
  a final run produced `Creds_Generated` on dashboard record
  `ord_01KZ2A6YCE9HJGZ97C8CD5ZT1P` and session
  `ses_01KZ2A6YCE9HJGZ97C8CD5ZT1N`. The binding total was `$117.32`
  (`$108.00` subtotal, free shipping, `$9.32` tax). OnPoint's poll reached
  `credential_ready`; no credential material was exposed by the public API.
  Prava confirmed that `Creds_Generated` counts as a successful Prava sandbox
  transaction. It is not a merchant-order confirmation.
- **One Browser Harness attempt was made, once.** Checkout session
  `checkout_c6257f76587ae40c` returned `checkout payment agent fallback timed
  out after 5000ms`. OnPoint preserved the outcome as unknown, did not retry the
  one-time credential, and did not report a fabricated `APPROVED` or `DECLINED`.
- **Honesty boundary:** deterministic self-check validates orchestration only.
  A REST sandbox lifecycle is labeled completed only after Prava issues a test
  credential, an external sandbox checkout is attempted, and Prava accepts its
  real processor outcome via `report-status`; only the production CLI path may
  say a merchant order was placed.

### Submission handoff

1. **Record and submit the demo** using the existing successful Prava record;
   do not consume another sandbox-card transaction for recording.
2. **Production access** — application submitted. The production CLI path is
   implemented and the agent is linked, but a real checkout remains unvalidated.
   Production REST would additionally require an actual merchant checkout before
   `report-status`.
3. **After submission**, ask Prava to reconcile the unknown Browser Harness
   attempt. Do not block the hackathon recording on it.

## Devfolio Submission Content

**Project name:** OnPoint

**Tagline:** The fashion agent that earns permission to buy.

**One-paragraph description:**

OnPoint turns fashion intent into controlled action. It discovers live UCP
inventory, checks the garment on the shopper, locks item, shipping, and tax into
a binding quote, then asks Prava for the narrowest useful permission: one
merchant and one spending ceiling. A validated Prava sandbox transaction reached
`Creds_Generated`; OnPoint reached `credential_ready` without exposing the
credential. Linq makes intent and status message-native. When the subsequent
merchant outcome became unknowable, OnPoint stopped without retrying or
inventing success. Prava confirmed that `Creds_Generated` is a successful Prava
transaction; no Alo Yoga merchant order or charge is claimed.

**How Prava is used:**

Prava is central, not a bolt-on. Discovery uses `prava shop search/product` and
Browser Harness locks the item, shipping, tax, and final total. REST sandbox
then performs hosted card entry → device verification → `payment-result` →
one-time credential. The card ending 2119 validated credential issuance at the
binding `$117.32` total. The credential stayed server-side. One external
checkout attempt returned an unknown Browser Harness timeout, so OnPoint did
not retry or call `report-status` with an invented outcome.

**How Linq is used:**

The Linq experience sends an intro message plus an `imessage_app` status card.
Approval happens on Prava's hosted surface. Live send and signed Standard
Webhooks handling are validated. A web shopper can now open Messages with an
inbound `TRACK op_…` command, attaching the exact current order rather than
creating a duplicate quote or permission session. The 👍 reaction handler and
card update are implemented, but this new same-order handoff and confirmation
mutation have not yet been observed as one continuous recording. Until then,
live Linq and successful Prava evidence remain independently validated.

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
- Demo video script: [docs/PRAVA-DEMO-SCRIPT.md](./PRAVA-DEMO-SCRIPT.md)

## What worked, what didn't, what we learned (submission section draft)

**Worked:**

- The deterministic self-check walkthrough exercises orchestration shape and
  labels itself fixture-only; it is not transaction proof.
- Real Linq sends, signed webhook verification, live UCP discovery, a binding
  quote, and successful Prava sandbox credential generation are validated.
- The trust-first presentation distinguishes requested amount and merchant,
  expected credential controls, and observed outcome, so the user can see what
  was requested and what actually happened.
- Designing for honesty-by-default: self-check, sandbox lifecycle, and merchant
  order use distinct states and claims.

**Didn't:**

- The single Browser Harness checkout attempt returned an unknown five-second
  automation timeout. Following Prava's unknown-outcome guidance, OnPoint did
  not retry the credential or report an invented processor outcome.
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
