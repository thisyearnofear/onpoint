# Curator Payout Wallets

Ops guide for curator payout addresses — custodial bootstrap, Magic embedded wallets, and migration.

## Model (single source of truth)

| Field | Where | Purpose |
|-------|-------|---------|
| `commerce.walletAddress` | Neon | Public Celo payout address (agents + splits) |
| `commerce.payoutWalletStatus` | Neon | `unset` · `platform_custodial` · `curator_owned` |
| `commerce.payoutWalletProvider` | Neon | `magic` · `minipay` · `manual` · `platform_custodial` |
| Private keys | API host file only | `CURATOR_PAYOUT_KEYS_PATH` — custodial bootstrap only |

Client module: `apps/web/lib/services/curator-payout-wallet.ts`  
Magic helper: `apps/web/lib/services/magic-wallet.ts`  
API lib: `apps/api/lib/curator-payout-wallets.js`

## Curator self-serve (recommended order)

1. **Magic** — email / Google (`NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`) → `curator_owned` + `provider: magic`
2. **MiniPay** — in-app connect → `provider: minipay`
3. **Custodial quick start** — ops / “OnPoint holds funds” → `platform_custodial`
4. **Paste address** → `provider: manual`

Surfaces: `/curator/onboard`, `/curator/wallet?slug=…`, shared `CuratorPayoutWalletPanel`.

## Magic setup

1. Create app at [dashboard.magic.link](https://dashboard.magic.link)
2. Enable **Celo mainnet**; add `https://forno.celo.org` to Content Security Policy (connect-src)
3. **Web (Netlify / local):** `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_…` in `apps/web/.env.local` or Netlify env
4. **API (Hetzner only):** `MAGIC_SECRET_KEY=sk_live_…` in `/opt/onpoint/shared/api/.env` — never in web or git

Curator onboard uses **Embedded Wallet** (`magic-sdk` + `connectWithUI`) — only the publishable key is required for that flow.

**Magic Express identity provider** (`POST tee.express.magiclabs.com/v1/identity/provider`) is optional — only if you wire **your own** JWT issuer (e.g. Auth0) into Magic TEE. Skip it for email/Google Magic login.

After setting Netlify env, trigger a redeploy so `NEXT_PUBLIC_*` is baked into the build.

## Server setup (custodial bootstrap)

```bash
CURATOR_PAYOUT_KEYS_PATH=/opt/onpoint/shared/api/curator-payout-keys.json  # chmod 600
```

## Bootstrap stocked humans (ops)

```bash
SERVICE_API_KEY=... node scripts/bootstrap-curator-payout-wallets.mjs
node scripts/agent-commerce-ready.mjs   # target ≥ 5 agent-purchasable
```

**Custodial rules:** no 0xSplit while `platform_custodial`. After migrate → **Setup 0xSplit**.

## API

| Endpoint | Auth |
|----------|------|
| `GET /api/curator/:slug/wallet/status` | Public |
| `POST /api/curator/:slug/wallet/provision` | WhatsApp match |
| `POST /api/curator/:slug/wallet/migrate` | WhatsApp match + `{ newWalletAddress, provider? }` |
| `POST /api/admin/curators/provision-custodial-batch` | Service key |
| `POST /api/admin/curators/:slug/migrate-payout-wallet` | Service key |

## UXmaxx

Enter **Magic Labs bonus** or **General Track** with the story already in prod: invisible curator wallets on Celo, agents pay via x402. Skip Particle/Arbitrum as primary until cross-chain agent demand exists.

Related: [agent-commerce.md](./agent-commerce.md) · [PHASE1_AUDIT.md](../PHASE1_AUDIT.md)
