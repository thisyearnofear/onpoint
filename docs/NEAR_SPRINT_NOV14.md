# Sprint: Grand-prize shape — Nov 14

Bar from the critique: *"agents settle through Intents or actually bargain."*
Constraints: full scope, testnet only (no mainnet funding). NEAR Intents has no
public testnet deployment — we deploy the canonical verifier ourselves.

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

### Acceptance

- [ ] Multi-round bargain converges; refusal reachable; quoteToken verifies;
      tampered token → 401/409.
- [ ] No-offer order flow byte-identical to today.
- [ ] Tests: convergence, refusal, token forgery, expiry, back-compat.

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

### Acceptance

- [ ] Real `execute_intents` tx on testnet moves USDC.e ledger balance
      agent→store; nearblocks link in the demo + receipt.
- [ ] `agent-demo.mjs` gains `RAIL=intents` (or makes intents the NEAR
      settlement leg inside the narrated run — pick one, wire cleanly).
- [ ] Docs updated: "deployed the canonical verifier to testnet because the
      upstream deployment is mainnet-only" — honest, not overclaimed.

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

## Honest framing to keep in docs

- Verifier is OUR testnet deployment of the canonical contract (upstream is
  mainnet-only); USDC.e is a testnet mock.
- Seller agent is a policy function + optional LLM reasoning, not a third
  party. Say it plainly.
- FCAK can't sign NEP-413 (protocol rule) — layered key model: FAK = intent
  identity, FCAK = bounded on-chain budget.
