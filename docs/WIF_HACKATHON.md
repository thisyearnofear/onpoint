# WIF HACKATHON — OnPoint × Robinhood Chain ("The World Is Flat")

Status: `planning` (2026-11-12). Submission window closes **today** (~9h at
writing). This doc complements `HACKATHON.md` (NEAR) — the same product, one
more rail.

## Event essentials

- **Site:** https://worldisflat.fun/build — "build what should exist on
  Robinhood Chain". Prize pool **10,000 USDG**.
- **Deadline:** submissions close Nov 12; judges pick top-10 Nov 12–14;
  **community $wif burn-vote decides the winner Nov 14–16**. The final is a
  mobilization contest, not a demo contest — plan for the vote window, not
  just the submission.
- **Requirements:** project must use `$wif` onchain on Robinhood Chain; stay
  live and working until judging ends; visible repo + demo video + **real
  transactions**; a flywheel that brings usage back to `$wif`; existing work
  allowed if it puts `$wif` to work in a real way.
- **Team max: 4.** ⚠️ Five devs were mentioned for this push — resolve the
  4-person roster before submitting the form.
- Robinhood Chain: EVM L2. **Verify before wiring:** chainId, public RPC,
  `$wif` token contract address, and how to get spendable `$wif` (faucet or
  transfer) into the agent ops wallet — pull all of these from official
  docs, not from memory.

## Thesis

One executable fashion offer, four ways to pay:
`paymentRails: ["celo_cusd", "near", "paypal", "wif"]`.

Every other entry in the field asks voters to **stake** `$wif` to play —
betting pools, convince-the-AI clones, persistent worlds. OnPoint is the only
submission where `$wif` is **money**: an agent spends it on a real-world good,
the curator gets paid in it, the receipt is public. The pitch line:

> *"Everyone else wants you to lock up $wif. Ours is the only entry where
> $wif is money."*

Flywheel: every try-on/order is a `$wif` movement; `/.well-known/agent.json`
means any third-party agent can discover and pay — machine customers, not
one-off human installs. Curator settlement in `$wif` makes it two-sided.

## Architecture — the `wif` rail

Repeat the proven pattern: a 402 quote advertises the rail; the agent pays
onchain and re-POSTs the tx hash; the server verifies trustlessly over
JSON-RPC. Mirror `apps/api/lib/near-payments.js` — **dependency-free
JSON-RPC verification**, no new SDK:

1. Agent calls `POST /api/agent/try-on` or `POST /api/curator/{slug}/order`.
2. HTTP 402 carries `quote.paymentRails: [..., "wif"]` and
   `quote.wif = { chainId, token, payTo, amountWif, instructions }`.
3. Agent ERC-20 `transfer`s `amountWif` of `$wif` to `payTo`.
4. Agent re-POSTs `{ wifTxHash, quoteId }`.
5. Server verifies via `eth_getTransactionReceipt` + `eth_getTransactionByHash`:
   status success, `to` == `$wif` contract, `Transfer` log `from → payTo` with
   `value >= quoted amount`, quote binding (item/size/quoteId via metadata or
   existing `dataSuffix` attribution pattern).
6. Proof recorded as `paymentMethod: "wif"`, `paymentAsset: "WIF"`,
   `chain: "robinhood"`; `tx_hash` column doubles as the replay guard (same
   as NEAR/PayPal rails).

**Payouts:** if the curator sets `commerce.wifPayoutAddress`, settle direct
(payment tx = payout tx, like the NEAR rail); otherwise record
`payout.status: "pending_reconciliation"` (like PayPal). Platform fallback
payout address via env.

**Config:** `WIF_RPC_URL`, `WIF_CHAIN_ID`, `WIF_TOKEN_ADDRESS`,
`WIF_USD_PRICE`, `WIF_PAYOUT_ADDRESS` (see `apps/api/.env.example` pattern).
Rail advertised only when configured — same rule as PayPal.

**Supply:** `onpoint-store` house catalog is the guaranteed demo inventory —
zero-curator fallback, same as the NEAR submission.

**Manifest:** add the `wif` rail to `/.well-known/agent.json` payment
capabilities so third-party agents can discover it.

**Not doing:** ERC-8004 re-registration on RHC, new contracts, bridges. The
rail is pure API + one ERC-20 transfer. Identity stays on Celo for now.

## Demo plan (the video + the vote window)

Video — recut `winfactory/entries/onpoint-near-hack` (~75s film already in
production): swap the "three-rail quote" beat for four rails. Structure:

- **Cold-open on the punchline:** agent fires the purchase, `$wif` tx lands,
  item exists — then "here's how a machine did that, and why nobody was at
  the controls." Do not open with stats.
- Keep the mirror-cut (person taps through checkout vs agent firing the same
  purchase programmatically).
- **The flat-earth gag:** have the agent buy flat-earth merch (or a globe) in
  `$wif`. *"Our agent bought flat-earth merch with $wif. The irony settles
  onchain."* Tailored to the community's own joke — that's what travels.

Vote window (Nov 14–16) — the conversion plays, per
[`docs/plans/2026-11-12-shareable-commerce-engine.md`](plans/2026-11-12-shareable-commerce-engine.md):

- **"Make the agent buy it" channel** — during the vote window, let the
  community request purchases from a bounded menu; the agent buys in `$wif`,
  tx posted per request. Every participant gets a personal artifact
  (their item + their tx). Generates **real txs during the vote window
  itself**, which is what judges score. Needs: request queue, per-purchase
  tx feed, rate limits + spend cap on the ops wallet.
- **One-frame meme:** freeze the block explorer on the tx — "card receipt
  left, onchain receipt right; curator paid in 4 seconds, Stripe takes
  7 days."
- **Voter pitch:** "every vote for us is $wif burned forever — and every
  $wif our agent spends proves why it should be spent, not hoarded."

## Sequencing vs NEAR (deadline Nov 14)

WIF closes first, NEAR second — do them in that order:

- Today: `wif` rail + RHC plumbing + e2e tx + WIF submission + video recut.
- Tomorrow–Nov 14: NEAR submission ships. The `$wif` rail *strengthens* the
  NEAR story ("agent pays on whatever rail settles") — it's compounding work,
  not competing work.

## Scope honesty

- This is a **hackathon-scoped exception to ADR 0023**: it exercises the
  built-but-deferred agent rails for a demo; it does not un-defer the
  consumer-first strategy. The shareable-commerce plan is the long-term home
  for the consumer mechanics.
- Win odds honest assessment: judges' top-10 is winnable on merit (category
  fit + verifiable txs); the burn-vote final tracks existing distribution,
  which we don't have. The vote-window plays convert what attention we can
  generate; they don't manufacture reach.

## Checklist

- [ ] Confirm `WIF_CHAIN_ID`, `WIF_RPC_URL`, `WIF_TOKEN_ADDRESS` from
      official RHC docs
- [ ] Fund the agent ops wallet with spendable `$wif`
- [ ] `apps/api/lib/wif-payments.js` + wire into try-on and order 402s
- [ ] `quote.wif` advertised; receipt emits `paymentMethod: "wif"`
- [ ] e2e: `$wif`-paid try-on → render + polaroid; `$wif`-paid order →
      receipt on `onpoint-store`
- [ ] Receipts publicly readable (`GET /api/receipts/{id}` — judges can
      self-verify)
- [ ] Manifest updated; README "do X, see Y" block for judges
- [ ] Demo video recut (four rails + flat-earth gag); submission form
      (4-person roster)
- [ ] Site stays live through Nov 16 — no deploys that risk the rail
