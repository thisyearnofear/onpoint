# Run Your Own Merchant

> How a seller settles OnPoint agent orders with **only their own key** — a
> merchant's agent process (`scripts/near-spike/seller-agent.mjs`) watches the
> pending-intent mailbox, executes signed intents addressed to its account, and
> collects the proceeds. The platform never holds the payee's key; the buyer
> never sees it either. This is the "a merchant could deploy tomorrow" claim as
> a runnable runbook.
>
> Status: `live-validated` on testnet against the production API. The demo
> tokens are mocks — see caveats at the bottom.

## What you need

| Piece | What | Why |
| --- | --- | --- |
| A NEAR account | e.g. `yourshop.testnet` (mainnet: `yourshop.near`) | your custody — funds land on the verifier ledger under this id, then withdraw to this wallet |
| A private key for it | `ed25519:…` full-access | signs `execute_intents` submissions and `ft_withdraw` intents; lives only in your process |
| `seller-agent.mjs` | this repo, `scripts/near-spike/` | ~150 lines, plain fetch + `near-api-js` — auditable |
| A storefront row | `commerce.nearAccountId = <your account>` | makes your curator the payee on 402 quotes |
| Node 20+ | `npm i` in `scripts/near-spike` | `near-api-js` is the only real dependency |

You do **not** need the repo's `near-credentials.testnet.json`, any platform
key, or any OnPoint secret. `SELLER_KEY` covers standalone operation.

## Setup (testnet — ~10 minutes)

```bash
# 1. Create + fund your account (testnet faucet or NEAR CLI)
near account create-account fund-later use-auto-generation \
  autogenerate-new-keypair save-to-keychain \
  network-config testnet create

# 2. Register storage on the settlement FT so the wallet can RECEIVE
#    withdrawals. One-time, ~0.00125 NEAR.
near tokens usdc.fakes.testnet storage_deposit \
  '{"account_id":"yourshop.testnet"}' --deposit 0.00125 \
  network-config testnet sign-as yourshop.testnet send

# 3. Point your curator at the account (DB update on the platform side —
#    ask the operator, or set it on your own curator):
#    curators.commerce.nearAccountId = "yourshop.testnet"

# 4. Run your agent. On first boot it calls add_public_key(1 yocto) on the
#    verifier — your pubkey must be in the verifier's registry before your
#    ft_withdraw signatures verify. The agent does it for you.
cd scripts/near-spike && npm i
SELLER=yourshop.testnet SELLER_KEY=ed25519:YOUR_KEY \
  API_URL=https://api.onpoint.famile.xyz node seller-agent.mjs
```

## What your agent then does, unattended

```
buyer signs a NEP-413 intent: {transfer: yourshop ← X USDC.e}
        │  POST {signedIntent} → 202 {pendingId}
        ▼
/api/pending-intents  (the mailbox — keyless by design)
        │  your agent polls every ~3s: GET ?payee=yourshop.testnet
        ▼
acceptance check — its OWN policy, not the mailbox's word:
  receiver_id == yourshop? deadline unexpired? has a transfer intent?
        │  yes
        ▼
execute_intents on the verifier (anyone may submit — the intent can only
ever pay its own receiver_id, so submission ≠ authority)
        │  ledger: buyer −X, yourshop +X — atomic
        ▼
replay the stored redeem body + intentsTxHash → order/try-on confirms
        │  200/201
        ▼
sign + execute ft_withdraw → the X USDC.e lands in YOUR wallet
        │  POST /complete → buyer's poll resolves: settled + orderId + receipt
```

Every hop is a linkable testnet tx: the buyer's deposit, your
`execute_intents`, your `ft_withdraw`.

## The custody boundary (what makes this sovereign)

- **Your key never leaves your process.** The API holds a mailbox, not a
  keyring. A leaked API secret can show pending intents — it cannot spend
  anything; only your key executes.
- **A published intent is safe by construction.** The worst a third party can
  do is execute it for you — funds can only reach your `receiver_id`.
- **You decide fulfillment.** `acceptanceCheck` in `seller-agent.mjs` is
  deliberately independent of the API's validation — fork it, tighten it,
  add price/AML checks of your own.
- **You collect on your own signature.** `ft_withdraw` is your intent, your
  key, your wallet — the platform can't freeze your ledger balance.

## Optional: bounded-budget rail

The escrow forwarder (`escrow.onpoint.testnet`) is a separate demo rail: an
agent pays via a function-call key scoped to `pay`, capped per call, to
allow-listed payees. To be added to that allow-list the **contract owner**
(`onpoint.testnet`) calls `add_payee(<your account>)` — ask the operator.
The intents rail needs no allow-list.

## Negotiation (when sovereign seller pricing lands)

The same process will answer `GET /api/pending-negotiations?payee=…` — your
agent quotes/counters/refuses and signs accepted prices with your key
(`NEAR_QUOTE_SIGNING_KEYS` on the platform side is only the *hosted*
fallback — an account like yours has no hosted key, so the platform
physically cannot sign for you). Until then, your listings negotiate
against the platform's policy stub or post fixed prices.

## Caveats (say them out loud)

- `usdc.fakes.testnet` is a **testnet mock** — not real USDC.
- `intents.onpoint.testnet` is OnPoint's own deployment of the **canonical
  unmodified** defuse wasm (`v0.4.2`, sha256-pinned in
  `intents-verifier/`); upstream `intents.near` is mainnet-only. On mainnet
  the same code path runs against the canonical verifier + real USDC.
- The mailbox + negotiation sessions are **in-memory, single-process** —
  pending items die on API restart (a buyer's signed intent is not lost:
  they re-publish). Postgres persistence is a tracked follow-up.
- `ft_withdraw` costs gas — your account needs a little NEAR for it.
