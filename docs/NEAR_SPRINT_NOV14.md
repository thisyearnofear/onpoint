# Sprint: Grand-prize shape — Nov 14

Bar from the critique: *"a merchant the platform does not key-hold
refuses a price and withdraws the proceeds."* That decomposes into
three workstreams: I (sovereign refusal + signature), G (an account we
don't control, run by a machine we don't run), H (the withdrawal).
Constraints: full scope, testnet only. NEAR Intents has no public
testnet deployment — we deploy the canonical verifier ourselves.

Assignments: dev 1 → I (seller-sovereign negotiation) · dev 2 → G
(external payee + Postgres) · dev 3 → H (collect leg + docs) · Devin →
F (token_diff, gated) + integration/deploys/e2e.

## A — Real bargaining (dev 1)

Turn `resolveOrderOffer` into a negotiation **session** protocol. Today it is a
one-shot floor check; the critique reads it as "a posted floor."

### Endpoint

`POST /api/curator/{slug}/negotiate`
```json
{"listingId":"0cc69356","offerUsd":17,"context":{"hired":["mo"]}}
→ 200 {"sessionId":"neg_…","round":1,"status":"countered","price":18.40,
       "reasoning":"…","floor":17.31,"expiresAt":"…"}

POST /api/curator/{slug}/negotiate/{sessionId}  {"offerUsd":17.75}
→ 200 {"round":2,"status":"accepted","price":17.75,"quoteToken":"…"}
   | {"round":2,"status":"rejected","reasoning":"walk-away: 3 rounds, movement < $0.30"}
   | {"round":3,"status":"countered","price":18.10,…}
```

`POST /order` accepts `quoteToken` (preferred) and still accepts `offerUsd`
(back-compat). An accepted session yields the 402 quote bound to the agreed
price — replace the `-o<cents>` quoteId encoding with a **signed token**: seller
signs `{listingId,size,qty,priceCents,sessionId,exp}` with
`curator.onpoint.testnet`'s ed25519 key (NEP-413 or plain detached signature);
the route verifies it before minting the 402. This makes the agreed price
cryptographically bound to the *seller's* decision, not to a client-supplied id.

### Seller policy (must be a decision function, not a constant)

- Inputs: cost floor (`priceFloorPct`), margin target, round count, movement
  between rounds, bundle context (buyer hired a service → bundle discount),
  stock level.
- Reachable outcomes: `accepted`, `countered`, `rejected` (walk-away) —
  refusals must actually happen in the demo (e.g. offer $12 → refuse).
- Optional reasoning via Venice (already in the render chain) with a
  rule-based fallback if the provider is slow — keep total round latency <3s.

### Hire = negotiated service

Reuse the same endpoint for the try-on service: buyer negotiates the stylist
fee (mo can refuse if below its render cost), then the existing try-on payment
settles it. `commerce.nearAccountId` already routes the payout.

### Acceptance — VERIFIED (Nov 14 demo run)

- [x] Multi-round bargain converges; refusal reachable; quoteToken verifies;
      tampered token → 401/409. Demo: $8 offer → `rejected` ("below my
      cost"), reopened at $14 → countered $16.79 → accepted in 3 rounds
      (bundle-discounted floor — buyer had just paid the stylist).
- [x] No-offer order flow byte-identical to today.
- [x] Tests: convergence, refusal, token forgery, expiry, back-compat
      (508 green in `apps/api`).
- Fix discovered during the demo: `redeemedAt` was set at token
      *verification*, burning the token on the quote-issuing POST. Now only
      consumed when a payment proof accompanies the token.

## B — Intents on our own testnet verifier (dev 2)

Upstream verifier `intents.near` is mainnet-only; `intents.testnet` has no
code. Deploy the real contract ourselves.

### Steps

1. `onpoint.testnet` creates `intents.onpoint.testnet`; deploy the release
   wasm from https://github.com/near/intents/releases (defuse verifier).
   Init per the contract's ACL/roles model (docs in the repo + docs.near-intents.org).
2. Agent deposits mock `usdc.fakes.testnet` into the verifier ledger:
   `ft_transfer_call` → `intents.onpoint.testnet` (NEP-141 → NEP-245 ledger
   credit; token id `nep141:usdc.fakes.testnet`).
3. Agent **signs a NEP-413 intent**: `{intent:"transfer", receiver_id:
   "store.onpoint.testnet", token:"nep141:usdc.fakes.testnet", amount:"…"}`
   wrapped in the MultiPayload format — use `@defuse-protocol/intents-sdk`
   or `near-intents` SDK pointed at our verifier id; signing needs the
   agent's **full-access key** (FCAK can't sign NEP-413 — that's fine, the
   scoped key keeps its job on the escrow rail; document the layered model).
4. **Seller executes**: `store.onpoint.testnet` (or the API on its behalf)
   calls `execute_intents` on the verifier with the signed payload → atomic
   ledger transfer. Seller-as-fulfiller = agent-to-agent settlement through
   Intents with no solver needed.
5. API: new rail `"near-intents"` in the 402 quote. Verification =
   `execute_intents` tx success + `mt_balance_of` delta on the verifier
   (before/after views), same trustless-RPC pattern as `near-payments.js`.
6. Optional closer: store withdraws to its own account (`mt_withdraw` intent)
   — shows the full loop; skip if time is short, ledger balance is already
   provable.

### Acceptance — VERIFIED on testnet (Nov 14)

- [x] Real `execute_intents` tx moves USDC.e agent→seller on the verifier
      ledger. Deploy `EofkVESL8mmi8yGPVkBPYTh1EFsm6fgb2E31qeWC2XPx`, init
      `kH7mBcqi7mjcJrYSfSt8n6J2Teea9SL4SLZCKmdSxpu`. Demo settlements:
      stylist fee `DUHjbJgT7i4uW9c6yTifUdfkDPDWnQqX6htF9XGz1kLF` (0.03 →
      curator), order `Jz5pqd1P6tvFwG87QP7MwMZcAPPWZFNbhsEc45AxP8m`
      (16.79 → store), deposit `3NEZ2mLqRJZVpgKx8Q5Ckt1N25XS8q6254A1H9gG2Abr`,
      store `ft_withdraw` `5HBXNGmVSQFxnvxEMit4gnNvuTVApiJRVrwxVqiuMXkU`
      (the "collect your earnings" leg — optional closer, done).
- [x] `agent-demo.mjs` defaults to `RAIL=intents`: refusal → multi-round
      bargaining → signed quote tokens → both payees execute the buyer's
      signed intents → ledger deltas read back from RPC.
- [x] API rail `near_intents` live in the 402 quote (`quote.intents`) +
      `intentsTxHash` verification in `lib/near-intents.js` (9 unit tests).
- [x] Docs updated — honest testnet framing everywhere.

Discovered constraints worth keeping in docs:

- The verifier keeps its **own** pubkey registry — NEAR access keys are NOT
  visible to it. Each intent signer must `add_public_key` (1 yocto) once;
  the demo's `ensureVerifierKey` handles it.
- `intents.onpoint.testnet`'s creation key was lost during the first deploy
  (account created, script crashed before persisting it). Root called `new`
  to init (super_admin) — the contract works fine, but the account can never
  sign txs/upgrade the wasm. Acceptable for the demo; on mainnet the deploy
  script must persist the key first.
- `ft_withdraw.token` takes the FT contract id, not the `nep141:` ledger id.

## C — Contract v2: managed policy (DONE, verified on-chain)

`escrow.onpoint.testnet` forwarder now has owner-managed state:
`init` (one-time, self-call only), `add_payee`, `remove_payee`,
`set_agent`, `set_max_per_tx`, `set_owner` (owner-gated),
`get_state` (public view), `pay` reads storage. Deploy tx
`CtkMBdZyXGfgx1Yud7R9FPpLoCCVanBqjD9pWn3sseqG`, init
`B1ccp3DLHYyDjHkXNbpG8ukXHursvshr4RrGLnYxhDrz`. Verified: add→pay→
remove→reject cycle, cap retune, and a bonus finding — the FCAK can't
call admin methods at all (key-layer rejection before contract logic).

## D — Assembly (after A+B land)

Re-cut narrated demo: bargain with a visible refusal → hire stylist →
settle via signed intent → receipts. Update HACKATHON/NEAR_HACKATHON docs.

## E — Seller-agent split (DONE — prod-verified 2026-11-14, release 20261113-172904)

Kills "the demo holds the keys that accept and execute." The verifier
accepts `execute_intents` from ANYONE — a signed intent can only pay its
named receiver_id, so publishing it is safe. That lets us split custody:

- Buyer POSTs `{quoteToken, signedIntent}` → API validates the payload
  structurally (verifying_contract, deadline, transfer → payee ≥ quote;
  the payload's `signer_id` is the authoritative buyer) → stores `pending`
  → **202** `{pendingId}`.
- `scripts/near-spike/seller-agent.mjs` — separate process holding ONLY
  the seller key — polls `GET /api/pending-intents?payee=…`, executes
  `execute_intents`, replays `{…redeem.body, nearAccountId: buyer,
  intentsTxHash}` to the stored `redeem.path` through the normal verify
  path, then `POST /api/pending-intents/:id/complete`.
- Buyer polls `GET /api/pending-intents/:id` → settled + orderId + receipt.

API stays keyless (mailbox + verifier). Two processes, disjoint keys —
"a merchant could run without this demo's keys" becomes literal:
merchant = `seller-agent.mjs` + one NEAR account.

Prod e2e: stylist `AT4AyJmY…sfa7`, merchant `GF5sdPPm…5smg` → order
`fc5c0ce3` 201 `near_intents`, receipt `receipt_mwf97uqr_b7a80444`.
Bugs the e2e flushed out: mailbox redeem stored `req.protocol` (http →
301 → GET → 401 on the service-key catch-all; now stores the relative
path); `/api/curator` mount order — `curator-wallet`'s json1k ran before
the storefront's json10kb and 413'd order bodies (storefront now first —
body-parser is idempotent); `/api/pending-intents` was json1k while
`complete` carries the redeem response (now json10kb, result.body ≤8KB).

## I — Seller-sovereign negotiation (dev 1) · ~1 dev-day · PRIORITY 1

The deepest remaining hole: **the price "yes" is still the platform.**
`NEAR_QUOTE_SIGNING_KEYS` on the server signs quoteTokens *as*
`curator.onpoint.testnet` and `store.onpoint.testnet`. Settlement is
sovereign (E) but pricing is impersonation — and an external merchant
can't be onboarded for negotiation at all, because their key can't go
in `NEAR_QUOTE_SIGNING_KEYS`. Fix: the seller's decision AND signature
move into `seller-agent.mjs`.

### Sovereignty test

A payee is sovereign when its seller-agent is alive: presence via
`POST /api/seller-presence {payee}` heartbeat (every ~15s, unsigned —
presence isn't security-sensitive). Fresh (<45s) → sovereign path.
Stale → hosted path (current API policy + `NEAR_QUOTE_SIGNING_KEYS`).
External merchants have no hosted key, so ONLY the sovereign path
exists for them — the platform physically cannot sign. That's the
claim, made mechanically.

### Negotiation mailbox (mirrors intent-mailbox.js)

`lib/negotiation-mailbox.js` — pending items `{id, sessionId, payee,
round, offer, expiresAt}`; lifecycle pending → answered | expired.

```
POST /api/curator/{slug}/negotiate        → 202 {sessionId, status:"pending_seller", sellerMode:"sovereign"}
POST /api/curator/{slug}/negotiate/{sid}  → 202 {status:"pending_seller", round}   (each buyer offer enqueues)
GET  /api/pending-negotiations?payee=…    → seller-agent's work queue
POST /api/pending-negotiations/{id}/respond
      {decision:"counter"|"refuse"|"accept", price?, reasoning?, quoteToken?}
GET  /api/negotiations/{sessionId}        → buyer's poll: full session state
POST /api/seller-presence {payee}         → heartbeat
```

Session rows keep full history (relay every round); pending items carry
`round` so stale/duplicate seller responses are ignored.

### Response integrity

Mailbox responses are unauthenticated but **non-binding** — refuse and
counter are just relayed text; the only commitment is the quoteToken.
On `accept`, the API verifies: ed25519 signature over the token payload
AND `has_public_key(payee, publicKey)` in the verifier's key registry
AND `signer.accountId === session.payee`. The same registry that
authorizes intent-signing authorizes quote-signing — one sovereignty
claim. Disclose the unsigned counter/refuse path plainly (rate-limited,
worst case is noise, never a binding artifact).

### seller-agent.mjs gains a policy

- Polls BOTH queues per payee (`pending-intents`, `pending-negotiations`)
  + heartbeat loop.
- `seller-policy.json` next to creds: `{payee: {floorPct, marginPct,
  bundleRule, reasoningTone}}` — or an LLM hook behind the same
  interface. Dev 1's `agent-negotiation.js` policy moves processes;
  the API keeps it only as the hosted fallback.
- On accept, signs the existing quoteToken shape `{v,scope,curatorSlug,
  listingId,size,qty,agreedCusd,sessionId,payee,iat,exp}` with the
  payee's key — `intents-lib.mjs` gains `signQuoteToken` (plain ed25519
  over `canonicalPayload()`'s fixed-key-order JSON, base58 — NOT
  NEP-413). Extract `canonicalPayload`/`base58Encode` from
  `lib/agent-negotiation.js` (lines ~276-307) into a tiny shared module
  both sides import — byte-exact canonicalization is the whole game.
  Redemption format unchanged: `/order` and `/agent/try-on` only swap
  how the signature is verified.

### API changes

- `routes/agent-negotiate.js`: presence check → sovereign (enqueue) vs
  hosted (current policy). Response gains `sellerMode`.
- quoteToken validation: if `signer.accountId` has a hosted key, verify
  there; else verify against the verifier registry.
- `intent-mailbox` pattern reused — same in-memory store, same TTL
  discipline; dev 2's Postgres work covers both mailboxes.

### Demo changes

`agent-demo.mjs` `negotiate()` handles `202 pending_seller` — poll
`GET /api/negotiations/{sid}` per round (seller-agent responds in ~2s;
60s round timeout). Buyer's narration unchanged; seller's lines now
read "the SELLER's agent answered" — true, not narrated.

### Acceptance

- Hosted: everything as today (regression).
- Sovereign: run seller-agent → full session through the mailbox →
  token verifies via registry (not config) → redeem 201.
- Proof for the video: kill the seller-agent mid-session → session
  stays `pending_seller` then falls to hosted with `sellerMode` flipping
  — a judge can SEE custody. (Or for the external merchant: no
  fallback at all — the offer just waits for a process that can sign.)

## F — Atomic cross-asset settlement (Devin) · ~1 dev-day · PRIORITY 3

`token_diff` intents inside the verifier — the primitive that actually
differentiates Intents from a transfer, and our testnet-max answer to
"value should come in as one asset and land as another":

- Buyer holds only wNEAR (`wrap.testnet`: `near_deposit` to wrap, then
  `ft_transfer_call` to the verifier ledger — same deposit path as
  USDC.e, token id `nep141:wrap.testnet`).
- Merchant-as-solver: buyer signs `{give wNEAR, want USDC.e}`; merchant
  signs the complementary diff (supplies USDC.e liquidity, receives the
  wNEAR at its quoted spread) — plus the buyer's transfer intent paying
  the kit price. **One atomic `execute_intents` bundle, ≤3 signed
  payloads.** Net: buyer −wNEAR, merchant +wNEAR — the kit settles as
  the asset the buyer held, quoted by the seller.
- Frame honestly: on mainnet the solver network provides liquidity;
  on testnet the merchant quotes its own spread — which is literally
  what small merchants do when solvers don't list their pair.
- Extend `verifyIntentsSettlement` to accept diff bundles (atomicity +
  the diff pair nets correctly + transfer ≥ quote).
- **GATE — first 2h:** spike the defuse `token_diff` message format
  against `intents.onpoint.testnet` (check `defuse-intents` docs +
  the contract's `execute_intents` expectations for diff bundles). If
  it resists, STOP — ship E+G+H only.
- Checklist: `signTokenDiffIntent` in intents-lib.mjs; wrap+deposit
  script for agent wNEAR; seller-agent gains `signTokenDiff` for its
  counter-diff; one tx showing buyer −wNEAR / merchant +wNEAR deltas.

## G — Independent party + persistence (dev 2) · ~1 dev-day · PRIORITY 2

Two kills in one stream:

1. **A payee outside `onpoint.*`.** Create a personal testnet account
   (`<you>.testnet`), `storage_deposit` on `usdc.fakes.testnet`,
   `add_public_key` on `intents.onpoint.testnet` for its FAK (the quote
   registry), give me the account id — owner tx adds it to the forwarder
   allow-list and a second storefront's `commerce.nearAccountId`. Then
   YOU run `SELLER=<you>.testnet node seller-agent.mjs` on your own
   machine during the recording — and once I lands, your agent answers
   the negotiation AND signs the quote with a key the platform doesn't
   hold. Live on camera: a refusal the platform couldn't have produced.
2. **Postgres persistence** for negotiation sessions + both mailboxes
   (sessions table keyed by id, JSON history, TTL sweep on read —
   mirror `lib/agent-negotiation.js` + `lib/intent-mailbox.js` +
   `lib/negotiation-mailbox.js` interfaces). Kills "in-memory on one
   process"; makes multi-instance safe. Keep in-memory as test/dev path.

## H — The earn leg + run-your-own-merchant docs (dev 3) · ~0.5 dev-day · PRIORITY 4 · DONE (verified 2026-11-14)

- ✅ Seller-agent auto-`ft_withdraw`s after each successful redeem —
  `collect()` in `seller-agent.mjs` signs + executes a withdraw intent
  for the just-earned amount, prints ledger→wallet deltas. Verified in
  the e2e run: stylist collected 0.03 (tx `FZnx6wGYNKN1sKB2Xex2Mqhav2PPm876XFftaosvkZGY`),
  merchant collected 16.79 (tx `zihX9Ny7T6o4QNjH9tWgWKkC4ZxUvJBuEYc2Q9x9f2Z`)
  — each to its own wallet, signed by its own key. Seller-agent also
  registers the payee's verifier key at boot (`add_public_key`) — needed
  by fresh/external accounts — and accepts `SELLER`+`SELLER_KEY` env so a
  merchant runs it with zero repo creds. Demo step-6 now proves "earned"
  as the race-immune ledger+wallet delta.
- ✅ Referral beat — buyer rides `?referral=0x181eD62B…3532` (mo's payout
  wallet) on the kit order → the stylist who drove the sale earns 2.5%.
  Query param, not `X-Referral-Code`: the mailbox replay carries
  `redeem.path` (URL), not headers — the code survives it. **Ledger-only**:
  a `agent_referrals` row, 2.5% `commission_cusd`, `status:'pending'` —
  NOT on-chain, so it stays a narrated beat per spec. Raw address, not a
  `ref_` code: codes only resolve via prior referrals/`agent_looks`
  history (first-run demos get `unknown` → nothing records); a 0x address
  resolves directly. `order.referralCode` now echoes in the 201.
- ✅ `docs/RUN-YOUR-OWN-MERCHANT.md` — the runnable runbook: one NEAR
  account + `SELLER_KEY` + `commerce.nearAccountId`; covers storage_deposit,
  boot-time verifier key registration, the custody boundary, and the
  honest testnet/in-memory caveats.

## D — Final assembly (Devin)

Review the F spike, integrate, prod deploys, recording-ready e2e
(3 terminals / 4 keys), docs honesty pass, PayPal rail intact.

## Recording cut — rail-first, not polaroid-first

The 60s video leads with the rail, not the render: refusal printed in
the buyer terminal → seller terminal (different process, different key,
ideally a different machine) counters → signed token → buyer publishes
the intent → seller executes → nearblocks shows the payee's ledger
balance moving → withdrawal. The try-on render is ~5s of texture.
ChatGPT wins "show me in this" — we don't compete on the picture.

- T1: buyer `agent-demo.mjs` (agent key only)
- T2: `SELLER=curator.onpoint.testnet node seller-agent.mjs`
- T3: `SELLER=store.onpoint.testnet node seller-agent.mjs`
- T4 (if G lands): dev 2's machine, `SELLER=<you>.testnet`

## Drop lines (Nov 14 ~12:00 UTC)

I slips → hosted negotiation stays with an explicit "platform-signed
quote" disclosure line — F+G+H still land. F spike fails → ship I+G+H.
G external account slips → three terminals on our accounts still shows
disjoint custody. H referral slips → keep withdraw (already built).
Postgres slips → in-memory stays a disclosed limitation.

## Honest framing to keep in docs

- Verifier is OUR testnet deployment of the canonical contract (upstream is
  mainnet-only); USDC.e is a testnet mock.
- Two seller modes, disclosed: **sovereign** (a separate process holds the
  payee key — for external merchants the ONLY mode) vs **hosted** (the API
  holds a demo key and signs as the payee — fallback for our own testnet
  accounts). `sellerMode` is in every negotiate response; never blur it.
- Mailbox responses (counter/refuse) are unsigned and non-binding — only
  the quoteToken commits, and it's verified against the payee's registry
  key or hosted key. Noise is possible; forgery of a *binding* artifact
  is not.
- FCAK can't sign NEP-413 (protocol rule) — layered key model: FAK = intent
  identity, FCAK = bounded on-chain budget.
- Presence is unsigned by design (freshness = "is an agent process alive"),
  not an auth claim.

---

# Sprint 2: Close the cross-chain critique — Nov 14 (final day)

Bar from the critique, verbatim:

> "The track's sentence is markets and agents settling across chains
> through NEAR Intents. This is the Defuse contract executing a swap you
> inventoried on testnet." — "meridian-goods.testnet proves the platform
> does not hold the key. It does not prove a merchant." — "The person
> watching the demo sees a ceremony around a product ChatGPT would have
> shown them without the ceremony."

Four holes → four workstreams + one human task. Everything remains
testnet-only.

Assignments: Devin → J (chain-signatures leg, gated) · dev 2 → K (open
solver queue) · dev 3 → L (self-serve onboarding + runbook + digital
listing) · dev 4 → M (Printful sandbox probe, timeboxed) · human task:
recruit one outside operator.

## J — Cross-chain leg via Chain Signatures (Devin) · 2h spike gate

`v2.signer.testnet` (or `v1.signer-prod.testnet` — spike determines which is
live) is PUBLIC MPC infrastructure on testnet, not our deployment.

### Spike (kill if it fails)

1. View `v2.signer.testnet` code + `public_key()`/`derived_public_key` view.
2. Derive the merchant's Sepolia address: `store.onpoint.testnet` + path
   `sepolia-1` → secp256k1 pubkey → EVM address. No private key exists.
3. `sign({path, payload, key_version})` from the merchant account → parse
   the MPC signature from receipts → assemble + broadcast a legacy EVM tx
   to Sepolia via a public RPC.
4. Sepolia faucet funds the SOLVER's EOA (meridian) — solver needs spendable
   sepoliaETH, merchant only needs a derived receive address.

### Build (if spike passes)

- `chain-sig.mjs` lib: `deriveEvmAddress(nearAccount, path)`, `signEvmTx
  (account, path, txFields)` → returns signed raw tx; `broadcastSepolia`
  via `https://ethereum-sepolia-rpc.publicnode.com`.
- **Solver-fronted payout**: after meridian's solver executes the NEAR-side
  bundle, its collection policy fires a second leg — a hot Sepolia EOA
  (faucet-funded) sends `amountUsd / ethUsdRate` sepoliaETH to the
  merchant's DERIVED address. Posted back as `xchainSettle` on the pending
  record: `{chain:"sepolia", txHash, to:derivedAddress, via:"solver-fronted"}`.
  The NEAR leg is atomic; the far-chain leg is solver-fronted — the same
  shape production intent bridges use, disclosed as such.
- Proof the merchant controls the derived address: merchant's agent calls
  MPC `sign` itself once — a Sepolia tx from the derived address moving a
  dust amount (or a signed message `eth_sign`-style) proves the NEAR
  account controls foreign-chain funds with no key material.
- Receipt surfaces both tx hashes: nearblocks + Sepolia explorer.

### Acceptance

- [ ] `mt_balance_of` delta on NEAR + a Sepolia tx to the derived address,
      both linked from the order receipt.
- [ ] Merchant spends/messages FROM the derived address via MPC sign —
      "controls a foreign address, no key anywhere" is demonstrated.
- [ ] Fails honestly: if faucet/RPC/MPC fails in the recording window,
      the queue still settles NEAR-side and `xchainSettle` reads
      `pending` — the run doesn't crash.

## K — Open solver queue (dev 2) · solver ≠ merchant

Today a swap intent lands in the PAYEE's mailbox, so the merchant is the
solver "because we pre-funded it." Split the roles.

- Pending intents carrying `signedSwap` join an **open queue**: visible to
  any registered solver, not filtered to the payee. Transfer intent still
  pays the merchant; the solver only supplies (and receives) the diff legs.
- `solver-agent` mode in `seller-agent.mjs`: `SOLVER=meridian-goods.testnet`
  watches the queue, counter-signs at ITS `minUsdcPerWnear`, executes the
  bundle, collects. The merchant's agent never touches the diff.
- Race semantics: first executed bundle wins; losers see `settled` and skip.
  Best-rate selection is a stretch — race is honest for v1.
- Rate competition: `meridian` policy quotes 6.0, `store`'s solver-side
  policy quotes 5.5 — the demo prints which solver won and why.

### Acceptance

- [ ] Order settles with solver ≠ payee: transfer → store, diff legs ⇄
      meridian, all in one `execute_intents`.
- [ ] Second solver offline → the other still solves (queue degrades to 1).
- [ ] Mailbox record shows `solver:` distinct from `payee:`.

## L — Self-serve merchant onboarding + runbook (dev 3)

"meridian is an account you created" only dies when a stranger can onboard
themselves.

- `POST /api/curator/{slug}/near-account` (service-or-curator-auth —
  cheapest honest auth is fine): sets `commerce.nearAccountId`; the route
  validates the account exists on testnet and is NOT under `onpoint.*`
  for external registrations (hosted key unavailable by construction).
- Auto-provisioning on registration: storage_deposit on USDC.e + the
  verifier `add_public_key` call are done BY THE MERCHANT's agent on first
  boot (seller-agent already knows how — make it idempotent), not by us.
- `docs/RUN_YOUR_OWN_SELLER.md` — one page: create testnet account →
  `SELLER=you.testnet SELLER_KEY=… node seller-agent.mjs` → set
  `nearAccountId` → you are live in the market. Includes the solver-mode
  variant.
- Meridian listing → `inventoryType: 'digital'` stadium poster — delivery
  is a real file, not a fake shipping claim. The kit listing stays but the
  hero purchase in the video should be the digital good.

### Acceptance

- [ ] A fresh testnet account runs the runbook end-to-end with zero DB
      writes by us.
- [ ] Meridian order delivers a downloadable artifact on the receipt.

## M — Printful sandbox probe (dev 4) · 3h timebox, then kill

A NEAR intent that creates a real confirmed POD order in a real
fulfillment system. Free sandbox, real order objects.

- Spike: sandbox API key → create order → `confirm` → webhook/poll status.
- If viable: order redemption triggers a draft→confirmed Printful order;
  receipt links the Printful order id. "The thing purchased actually
  entered a fulfillment pipeline."
- Kill criteria: no sandbox access, shipping-address friction, or >3h.

## Human task — one outside operator (not devs)

No code proves a merchant. Recruit ONE human (friend, another hackathon
team, NEAR TG) to run `SELLER=theiraccount.testnet node seller-agent.mjs`
on THEIR machine before recording — ideally as a second solver (feeds K)
or a third merchant. One external process in the terminal grid is worth
more than another day of code.

## New recording cut

1. Buyer publishes signed intent — *pay 16.24 USDC.e, funding with wNEAR*.
2. Intent lands in the open solver queue — TWO solvers' terminals quote
   different rates; winner's policy line prints.
3. Merchant sovereign-signed the price earlier (refusal beat stays).
4. Solver executes the atomic bundle — merchant paid on NEAR.
5. Collection leg fires — MPC signs, sepoliaETH lands at the merchant's
   DERIVED address. Two explorers side by side: nearblocks + Sepolia.
6. Polaroid for ≤5s of texture.

## Drop lines (final-day reality)

- J spike fails → ship K+L+M, disclose "cross-chain via intents is
  mainnet-only today" as the known gap.
- K slips → merchant-as-solver stays with explicit framing (already true).
- L onboarding slips → keep the runbook + manual wiring, still recruit
  the outside operator.
- M slips → digital-good delivery alone answers "nothing ships."
- No outside operator → record three terminals on our machines and say
  custody is disjoint but all ours — do not imply otherwise.

## Submission mechanics (unchecked — do these)

- [ ] X post draft (rail-first framing, tx links, 60s cut).
- [ ] Submission form — NEAR deadline Nov 14 23:59 UTC.
- [ ] First line of the submission owns the caveat: "testnet mock assets
      on an unmodified Defuse deployment — the rail is real, the money
      isn't."
