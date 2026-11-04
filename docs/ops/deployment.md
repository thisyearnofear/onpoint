# Deployment Runbook — API, Web, MCP

> Snapshot verified 2026-11-03. Status words follow the STRATEGY legend.
> Companion docs: [../../deploy/README.md](../../deploy/README.md) (API pipeline details), [GETTING_STARTED.md](../GETTING_STARTED.md).

## API (Hetzner)

- **Auto-deploys** via `.github/workflows/deploy-api.yml` on every push to `master` that touches `apps/api/**`, `packages/**`, `pnpm-lock.yaml`, the workflow, or `scripts/deploy-api.sh`. It SSHes to the Hetzner box and runs `scripts/deploy-api.sh` (local build → rsync → symlink flip → `pm2 reload`).
- `deploy-api.sh` runs `scripts/check-db-migrations.mjs` — a **verification** step that fails on hash drift for the reconciled migrations (it currently pins hashes for 0008–0010 only). It does **not** apply migrations.

### DB migrations are manual — apply before deploying code

Migrations are never applied by the deploy pipeline. Rule: **apply the migration to prod before pushing code that selects new columns** (or after pushing only additive reads that tolerate the column's absence).

```bash
NEON_DATABASE_URL=<prod url from .env.local — never commit> \
DB_MIGRATIONS_DIR=packages/db/drizzle \
npx tsx packages/db/src/migrate.ts
```

`DB_MIGRATIONS_DIR` is required — the runner defaults to `./drizzle` relative to cwd, which is the wrong folder when run from the repo root.

**Incident record (2026-11-03):** migration `0011_listing_attributes` (nullable jsonb `listings.attributes`) was pushed before being applied, causing HTTP 500 on storefront/looks/outfit responses that selected the column. Resolved by applying it the same day; the prod migration ledger now ends at 0011.

## Web (Fly.io, app `onpoint`)

- Next.js standalone on Fly app **`onpoint`** — `onpoint.fly.dev`, served at `onpoint.trustfall.xyz`, 2 machines in `fra`.
- **No automated web deploy exists.** Manual command:

  ```bash
  ~/.fly/bin/flyctl deploy -c fly.web.toml -a onpoint --remote-only
  ```

  `-a onpoint` is required: `fly.web.toml` says `app = "onpoint-web"` but the live app is `onpoint`.
- `NEXT_PUBLIC_*` values are inlined at build time via `fly.web.toml [build.args]`, not fly secrets.
- Web was stale from 2026-10-16 until redeployed 2026-11-03 (release v12); that release took `/runway` and `/runway/play` live for the first time.
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
