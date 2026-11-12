# PayPal AI Hackathon — Submission Hardening Plan

> Deadline: **12 Nov 2026 20:00 UTC**. Working doc for the final push.
> Source of truth for the integration itself: `docs/PAYPAL_HACKATHON.md`.
>
> **State (2026-11-12 ~17:00 UTC): submitted, final video live.** Devpost entry
> https://devpost.com/software/onpoint-b3dory with unlisted demo video
> https://youtu.be/AXaBYTOj7kY (92s improved cut, embedded on the public
> project page). Everything remains editable until the deadline.
>
> Frame: the engineering is real, but the submission currently risks losing on
> legibility — PayPal reads as rail 3-of-3 on a crypto-native product, and the
> two items that decide the outcome (video + Devpost form) are still open.
> This plan is ordered by what most affects the judging criteria, not by effort.

## P0 — Blocking the submission entirely

### 1. Record and upload the <3 min demo video — DONE (improved cut live)

The single most likely reason to lose outright. Judges are not required to
watch past 3:00.

**Narrative (one arc, PayPal-first):**
1. Human asks an agent for a fit recommendation → agent calls `POST /api/agent/try-on` → HTTP 402.
2. The 402 quote advertises `paymentRails`; the human chooses **PayPal**.
3. Human approves at `quote.paypal.approveUrl` (paypal.com sandbox, new tab).
4. Back on `/pay`, the polaroid develops — render, fit read, capture id.
5. End on the **public receipt** (`/receipt/{receiptId}`) + the `/p/{id}` polaroid page.

**Must NOT appear in the video:**
- The three Nia images carrying Venice watermarks.
- Club-named designs (crests/sponsor marks — trademark violation risk).
- cUSD/NEAR/OKX flows. One spoken line max: "the same offer also settles on
  crypto rails" — crypto is context, not content.
- Raw curl/JSON walls. Use `/pay` — it exists precisely so this isn't a
  curl-only demo.

**Script beats (verbal, ~15 words each):** the ask, the 402, the approval,
the render, the receipt. Mention `captureId` and `custom_id` binding once —
that's the depth signal.

- [x] Rehearse the flow once against prod; confirm `/pay` + `/p/` + receipt resolve
- [x] Record, edit to ≤2:50, upload to YouTube (public, no licensed music) — `onpoint-paypal-demo-v2.mp4`, 82s, unlisted placeholder
- [ ] Watch once as a judge would — does the PayPal approval read clearly?
- [x] Swap in the improved cut — `OnPoint Pay Demo.mp4`, 92s, `youtu.be/AXaBYTOj7kY`, embedded on the public project page

### 2. Submit the Devpost form — DONE

- [x] **Description**: lead with PayPal+AI, not the platform. Suggested spine:
      - Problem: AI agents can recommend a purchase but can't spend a human's
        money *with consent*. OnPoint is the consent path — agent proposes,
        human approves with PayPal, server verifies and captures.
      - What it does: one executable fashion offer payable via PayPal
        (Orders v2, `custom_id` binding, idempotent capture via
        `PayPal-Request-Id`, replay-guarded capture id as the proof).
      - AI: vision fit read + garment attributes (Otari gateway, per-call
        metered cost), AI try-on render (YouCam cloth-v4 → Replicate →
        Gemini → Venice fallback chain).
      - Live evidence links (below).
- [x] **Tools**: name Otari (OpenAI-compatible gateway), YouCam/Replicate/
      Gemini/Venice, and the PayPal Orders REST API + how each is used.
- [x] **Demo URL**: `https://onpoint.trustfall.xyz/pay`
- [x] **Repo link**: https://github.com/thisyearnofear/onpoint (MIT LICENSE present)
- [x] **Video link**: https://youtu.be/AXaBYTOj7kY
- [x] Answer "meaningful progress during the hackathon" with the commit trail
      already documented in `docs/PAYPAL_HACKATHON.md` (`4a1bce8` Nov 3 rail,
      `908ecfe` Nov 6 /pay, `954afdc` Nov 11 metered-AI receipts, sandbox
      secrets + live captures Nov 12)

## P1 — Judging-criteria fixes achievable in hours

### 3. Give judges a verifiable path without sandbox credentials

A judge can't complete the PayPal approval themselves (needs *your* sandbox
buyer account). Mitigate with evidence, not access:

- [x] In the Devpost description AND a `HACKATHON` section of README, link:
      - `https://onpoint.trustfall.xyz/receipt/receipt_mwdjib6r_ba423717`
      - `https://onpoint.trustfall.xyz/p/a2c86aef-0deb-47f3-8ca2-91412c853bea`
      - `GET https://api.onpoint.famile.xyz/api/receipts/{receiptId}` (raw JSON,
        shows `chain: 'paypal'`, `paymentMethod: 'paypal'`, capture id)
      - `node scripts/near-spike/agent-demo.mjs` with `RAIL=paypal` as the
        runnable reproducer (flag clearly it needs sandbox creds, so judges
        know the limitation is stated, not hidden)
- [x] Optionally ship a pre-approved sandbox buyer account? **No** — don't
      post credentials publicly. The receipt readback is the verification path.

### 4. Reframe approval-relay as the thesis

This is the strongest available narrative move — it converts the biggest
structural weakness (human must approve) into the pitch:

- [x] Description + video line: **"Agents propose, humans approve."** The
      missing primitive in agentic commerce isn't payment — it's consent.
      PayPal Checkout is the consent surface; `captureId` is the receipt.
- [ ] Update `docs/PAYPAL_HACKATHON.md` §Thesis to lead with this framing.
- [ ] Note explicitly that this is by *design*: unlike the crypto rails
      (agent pays autonomously), the PayPal rail keeps a human in the loop —
      and that's the property PayPal users actually want.

### 5. Check the unchecked boxes in `docs/PAYPAL_HACKATHON.md`

- [x] "Add `paypal` result to the demo video" → covered by item 1
- [x] "YouTube upload" → item 1
- [x] "Devpost form" → item 2
- [x] Verify README/HACKATHON.md entry points match what Devpost links to

## P2 — Known weaknesses to accept and de-risk (do NOT build)

Do not start new engineering in this window. These are judged-down items you
absorb rather than fix:

- **PayPal is rail 3-of-3.** Can't restructure the product now. Mitigate
  through narrative only — PayPal is the *only rail shown*.
- **No PayPal Agent Toolkit / agentic-checkout primitives.** Don't bolt on
  now; if asked in judging, the answer is the consent model is the feature.
- **Payout `pending_reconciliation`.** State it plainly in the description as
  v1 scope (PayPal Payouts is next). Honesty reads better than omission.
- **Sandbox only.** Say "sandbox" once; don't over-apologize — the rules
  explicitly require sandbox.
- **Rule-based planner ("no LLM")**. Don't claim more AI than exists; the
  metered `aiCost` per call is actually a differentiator — surface it.
- **Thin catalogue.** Demo with one strong listing (the recorded Nia run);
  don't panorama the storefront.

## P3 — Polish if time remains

- [ ] README quick-start section titled "PayPal AI Hackathon — what to click"
      (30-second judge path: /pay → approve → receipt)
- [ ] Ensure `docs/PAYPAL_HACKATHON.md` checklist reflects final state
- [ ] Screenshot of the result screen + receipt for the Devpost gallery
- [ ] Commit any pending working-tree changes (currently dirty: `HACKATHON.md`,
      `apps/web/app/pay/page.tsx`, `WaitDeck.tsx`, `pay/deck.ts`) — either
      finish and commit or stash, so the public repo is coherent
- [ ] Final smoke test: fresh browser → `/pay` → full flow → receipt resolves

## Explicitly out of scope

- PayPal Payouts, Agent Toolkit/MCP, live-env credentials, USDC facilitator
  checkout, any new rails or features. The remaining hours are for
  packaging what exists, not building more.
