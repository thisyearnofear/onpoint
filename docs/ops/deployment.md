# Deployment Runbook — API, Web, MCP

> Snapshot verified 2026-11-03. Status words follow the STRATEGY legend.
> Companion docs: [../../deploy/README.md](../../deploy/README.md) (API pipeline details), [GETTING_STARTED.md](../GETTING_STARTED.md).

## API (Hetzner)

- **Auto-deploys** via `.github/workflows/deploy-api.yml` on every push to `master` that touches `apps/api/**`, `packages/**`, `pnpm-lock.yaml`, the workflow, or `scripts/deploy-api.sh`. It SSHes to the Hetzner box and runs `scripts/deploy-api.sh` (local build → rsync → symlink flip → `pm2 reload`).
- `deploy-api.sh` runs `scripts/check-db-migrations.mjs` — a **verification** step that fails on hash drift for the reconciled migrations (it currently pins hashes for 0008–0010 only). It does **not** apply migrations.
- **Native modules:** the bundle's `node_modules` is installed on the operator's laptop, so npm skips sharp's Linux optional deps and the release dies at startup with `Could not load the "sharp" module using the linux-x64 runtime`. Step 5.65 of `deploy-api.sh` fixes this on the server: it reads the `@img/*-linux-x64` versions sharp declares, `npm pack`s them into the staged release and `require`s sharp before preflight. If a future dependency ships prebuilt natives the same way, extend that step rather than patching a release directory by hand — a hand-patched release looks healthy and silently disappears from the next build.
- **Read the script's own exit status.** `./scripts/deploy-api.sh > log; echo $?` reports the exit code of `echo`, not the deploy, and a failed release then gets logged as a success. Use `&& echo OK || echo FAILED`, and confirm the release it names: `ssh snel-bot readlink /opt/onpoint/apps/api`.

- **Incident record (2026-11-12): receipts were never persisted.** `@repo/agent-core` stores receipts and the tip/treasury ledgers through Upstash REST helpers; the box sets `REDIS_URL` but no `UPSTASH_REDIS_REST_*`, so those helpers were silent no-ops and the ledgers lived in process memory. Every `pm2 reload` — every deploy — erased all receipts, and `/receipt/{id}` links 404'd afterwards. `apps/api/server.js` now installs the box Redis as the store via `apps/api/lib/persistent-state-redis.js` (look for `[PersistentState] agent-core state is stored in Redis` in the API log after a deploy). The many other `redis*` helpers in agent-core still need Upstash and remain no-ops on the box.
- **Deploying a hotfix without shipping the whole branch:** `git worktree add --detach /tmp/x <commit prod runs>`, cherry-pick the fix, `git checkout <branch> -- scripts/deploy-api.sh`, `pnpm install --frozen-lockfile`, then run the deploy script from the worktree. There is no `REVISION` file in a release, so identify what prod runs by the release timestamp against `git log -- apps/api packages`.
- **Rate limits (2026-11-12):** `/api/agent/try-on` has its own tier (`agentTryOn`, 30/min and 300/day per IP). Limits are keyed on the first `X-Forwarded-For` entry, so any web proxy in front of the API must forward the visitor's address (`fly-client-ip`) or all visitors share one allowance. To clear one address: `redis-cli -u "$REDIS_URL" del agent-tryon-daily:<ip>:<day bucket>`.

### DB migrations are manual — apply before deploying code

Migrations are never applied by the deploy pipeline. Rule: **apply the migration to prod before pushing code that selects new columns** (or after pushing only additive reads that tolerate the column's absence).

```bash
NEON_DATABASE_URL=<prod url — never commit> \
DB_MIGRATIONS_DIR=packages/db/drizzle \
npx tsx packages/db/src/migrate.ts
```

`DB_MIGRATIONS_DIR` is required — the runner defaults to `./drizzle` relative to cwd, which is the wrong folder when run from the repo root.

**The API's runtime env lives on the box, not in the repo.** The pm2 process (`onpoint-agent-server`, cwd `/opt/onpoint`) loads `NEON_DATABASE_URL` from `/opt/onpoint/apps/api/.env` (and `/opt/onpoint/.env`), which points at a **different Neon database** than the repo's local `.env`/`.env.local`. Always apply migrations against the box env:

```bash
ssh snel-bot 'NEON=$(grep "^NEON_DATABASE_URL" /opt/onpoint/apps/api/.env | cut -d= -f2- | tr -d "\""); \
psql "$NEON" -f -' < packages/db/migrations/<file>.sql
```

**Incident record (2026-11-05):** the gift-claim migration applied cleanly against the *local* `.env` DB, but the API's orders table (on the box DB) lacked `claim_token` — every `/api/gift/*` lookup 500'd until the same `ALTER TABLE` ran against `/opt/onpoint` env. Same class of bug as 0011; the fix is the box-env rule above.

**Incident record (2026-11-03):** migration `0011_listing_attributes` (nullable jsonb `listings.attributes`) was pushed before being applied, causing HTTP 500 on storefront/looks/outfit responses that selected the column. Resolved by applying it the same day; the prod migration ledger now ends at 0011.

## Web (Fly.io, app `onpoint`)

- Next.js standalone on Fly app **`onpoint`** — `onpoint.fly.dev`, served at `onpoint.trustfall.xyz`, 2 machines in `fra`.
- **No automated web deploy exists.** Manual command:

  ```bash
  ~/.fly/bin/flyctl deploy -c fly.web.toml -a onpoint --remote-only
  ```

  `-a onpoint` is required: `fly.web.toml` says `app = "onpoint-web"` but the live app is `onpoint`.
- `NEXT_PUBLIC_*` values are inlined at build time and must be declared in **three** places, or they are silently dropped:
  1. `fly.web.toml [build.args]` — supplies the value.
  2. the `ARG` whitelist in the `builder` stage of [../../Dockerfile](../../Dockerfile) — an arg not listed here never reaches `next build`.
  3. `ARG` + `ENV` in the `runner` stage — needed when a **server component** reads `process.env` at request time rather than relying on build-time inlining.
- **Incident record (2026-11-12):** `/p/{paymentId}` 404'd on every polaroid. `apps/web/app/p/[id]/page.tsx` reads `NEXT_PUBLIC_R2_PUBLIC_URL` in a server component; the value was in `fly.web.toml` but missing from the Dockerfile `ARG` list, so `loadPolaroid()` returned null and the page called `notFound()`. Symptom: paying for a try-on produced a valid `imageUrl` and a dead share link. When touching `/p`, verify with a real `paymentId`: `curl -o /dev/null -w '%{http_code}' https://onpoint.trustfall.xyz/p/<id>`.
- The API builds human-facing links (`polaroid.webUrl`, receipt URLs) from `WEB_BASE_URL` on the box, defaulting to `https://onpoint.trustfall.xyz`. **Incident record (2026-11-12):** it was pinned to `https://beonpoint.netlify.app`, a decommissioned host that 404s at the apex — so agents were republishing dead links while the Fly app served the same path fine. Set it explicitly on `snel-bot:/opt/onpoint/shared/api/.env` and re-check with a 402 response after any hosting move.
- Web was stale from 2026-10-16 until redeployed 2026-11-03 (release v12); that release took `/runway` and `/runway/play` live for the first time. It went stale again for 9 days (105 `apps/web` commits, incl. `/pay` as a checkout and the Otari metering UI) before the 2026-11-12 redeploy. **Rule: before any demo, judged submission or press moment, run `git log --since=<last deploy date> --oneline -- apps/web | wc -l` — a live API plus a stale web bundle demos as a broken product.**
- A remote build once hung ~18 min in "Collecting page data" (root cause unconfirmed). As mitigation, all server-side API fetches in `apps/web/app` now carry `AbortSignal.timeout(5000)`; the build is also sensitive to the `.npmrc` hoisting config (`shamefully-hoist`, `node-linker=hoisted`) — without it the pruned install fails to resolve transitive deps (`lru-cache`, `bls-eth-wasm`).

### Release validation checklist (wardrobe studio release)

After `flyctl deploy` completes and before calling the release done:

- `flyctl status -a onpoint` and `flyctl machines list -a onpoint` — machines healthy/started.
- `curl -I https://onpoint.trustfall.xyz/` returns HTTP 200; SSR HTML contains `id="style-studio"` and the model image (hero visible without hydration).
- Browser, direct production URL:
  - Rack garment 01 → 02 swaps the model image and `aria-pressed`; Undo restores; pin + select another piece → two-pane compare; Save piece → reload → Saved tab shows it.
  - Viewports 1440 / 390 / 360, light and dark: no horizontal overflow; on mobile first viewport shows rack + full model together.
  - "Get a verdict" links to `/runway/play?sample=<id>`; "Use my photo" links to `/lab?tab=try-on`. No paid try-on or judging execution is required for validation — inspect links, don't complete them.

## MCP (Fly.io, app `onpoint-mcp`)

- Fly app `onpoint-mcp` (fra, 2 machines, `fly.mcp.toml`; secret `DASHSCOPE_API_KEY`), deployed 2026-11-03 at `mcp.onpoint.famile.xyz`, certificate issued.
- Cloudflare DNS records must stay **DNS-only (grey cloud)**, not proxied:
  - `A` → `66.241.124.139`
  - `AAAA` → `2a09:8280:1::1e3:73c5:0`
- Streamable-HTTP MCP at `POST /`: send `initialize` first, then pass the `Mcp-Session-Id` header on subsequent calls. See [../CHATGPT_PLUGIN_CONNECT.md](../CHATGPT_PLUGIN_CONNECT.md).

## Known gaps (2026-11-03)

- **39 apps/web vitest failures** — all `ReferenceError: React is not defined` in `button.test.tsx`, `LiveStylistView.gate.test.tsx`, `AutoDismissTimer.test.tsx`, `CaptureProgressRing.test.tsx`. Pre-existing test-harness (JSX runtime) issue; production build unaffected.
- `next.config.js` has an invalid experimental key `appNewScrollHandler` — Next warns and ignores it.

### PayPal seller payout (2026-11-12)

`PAYPAL_SELLER_PAYOUT_EMAIL` in the shared API env enables the second leg of the
PayPal money loop: after a capture, the API pays the seller share over
`/v1/payments/payouts` (id derived from the PayPal order id — replay-safe).
Unset or a failed call leaves `payout.status: pending_reconciliation`; the sale
never fails on payout. Set it to the sandbox "seller" personal account email
for the hackathon demo, then `pm2 reload onpoint-api --update-env`.
