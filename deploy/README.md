# OnPoint Deployment Guide — Hetzner VPS

> **Progress:** Phase 0 (Deploy Pipeline) — ✅ Complete 2026-05-26
> See [ADR 0001](../docs/adr/0001-backend-first-autonomy.md) for architecture rationale.

## Overview

OnPoint API runs on a shared Hetzner VPS (38 GB disk). We **build locally, rsync**
only what's needed — no `git pull` on the server, no pnpm on the server.

**Architecture:**
- **Frontend:** Vercel (Next.js app) — presentation + identity
- **Backend API:** Hetzner VPS via PM2 (Express on port 48751)
- **Bridge:** Python FastAPI on port 48752 (Browser-Use / Purch)
- **Cache:** Redis on localhost:6379 (shared instance)
- **Future worker:** `onpoint-worker` (Phase 1)
- **Future signer:** `onpoint-signer` on 127.0.0.1:48753 (Phase 4)

**Deploy strategy (ADR 0001):**
- `pnpm` builds the workspace packages locally → isolated `npm install --omit=dev` bundle → `rsync` → symlink flip → `pm2 reload`
- Secrets live at `/opt/onpoint/shared/api/.env`, symlinked into each release
- No secrets ever travel over rsync or git

---

## Prerequisites

| Tool      | Version   | Notes                                                                                   |
|-----------|-----------|-----------------------------------------------------------------------------------------|
| Node.js   | >=20.19.0 | Use nvm (`nvm use`)                                                                     |
| pnpm      | 10.10.0+  | Corepack (`corepack enable`). Requires `node-linker=hoisted` in `.npmrc` (set already). |
| SSH       | any       | `~/.ssh/config` with snel-bot                                                           |

---

## First-Time Server Setup

### Step 1: Ensure shared environment exists

```bash
ssh snel-bot
mkdir -p /opt/onpoint/shared/api

# Populate with production secrets
# Use the setup-secrets script for secure hidden-input prompting
# Or copy manually:
cat > /opt/onpoint/shared/api/.env << 'EOF'
NODE_ENV=production
PORT=48751
REDIS_URL=redis://localhost:6379
BRIDGE_URL=http://localhost:48752
VENICE_API_KEY=your-key-here
SERVICE_API_KEY=your-key-here
AGENT_WALLET_ADDRESS=0x...
PREMIUM_USERS=
VERCEL_DOMAIN=https://onpoint.vercel.app
EOF

chmod 600 /opt/onpoint/shared/api/.env
```

### Step 2: Ensure PM2 is installed and running

```bash
npm install -g pm2

cd /opt/onpoint
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # survives reboot (already done)
```

### Step 3: Verify

```bash
curl http://localhost:48751/health
# {"status":"healthy","redis":"connected","version":"2.1.0",...}
```

---

## Routine Deployment

**Always run from your local machine:**

```bash
# Basic deploy
./scripts/deploy-api.sh

# Preview (dry run)
./scripts/deploy-api.sh --dry-run

# Via npm script
pnpm deploy:api
```

The script does:

```
 1. Build workspace deps       —— @repo/agent-core, @onpoint/shared-types, @repo/blockchain-client, @repo/db, @repo/storage, @repo/messaging-bridge, @repo/etherfuse
 2. Size check                 —— fail >450 MB, warn >350 MB
 3. rsync --delete             —— to /opt/onpoint/releases/api/<timestamp>/
 4. .env symlink               —— shared/api/.env → releases/api/…/.env
 5. Symlink flip               —— apps/api → releases/api/<timestamp>/
 6. pm2 reload                 —— zero-downtime reload
 7. Health check               —— curl /health, retry up to 6× (18s)
 8. Auto-rollback on failure   —— flips back, reloads, verifies
 9. Start/reload worker        —— pm2 startOrGracefulReload --only onpoint-worker
10. Start/reload agent-server  —— pm2 startOrGracefulReload --only onpoint-agent-server
11. Prune inactive releases    —— keep last 2, preserve active target
12. Disk summary               —— show usage
```

### Note: `node-linker=hoisted`

The project uses `node-linker=hoisted` (set in `.npmrc`) for a flat `node_modules` structure.
This avoids the per-project `.pnpm` virtual store symlink issues. The deploy script
handles this automatically — it runs `tsup` with explicit paths since pnpm's filtered
lifecycle scripts don't resolve binaries in hoisted mode. New contributors should
ensure `.npmrc` has this setting before running `pnpm install`.

### Deploy output example

```
🚀 Deploying @onpoint/api — release 20260526-130237
📦 Building production bundle...
📏 Checking build size: 87MB (limit: 200MB, warn: 100MB)
📁 Preparing remote release directory...
📤 Syncing build to remote...
🔗 Creating .env symlink: shared/api/.env → releases/api/20260526-130237/.env
🔗 Flipping symlink: apps/api → releases/api/20260526-130237/
🔄 Reloading PM2 process: onpoint-api
🏥 Running health check...
   ✅ Health check passed (attempt 1/6)
🧹 Pruning old releases (keeping 3)
   Removed: 20260524-091200
💾 Remote disk status
   Used: 25G / 38G (69%)

✅ Deploy complete! Release: 20260526-130237
```

---

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-api.sh` | Full deploy pipeline (build workspace packages → deploy → health check → prune inactive releases) |
| `scripts/rollback-api.sh` | List releases, pick one, flip symlink, auto-revert on failure |
| `scripts/setup-secrets.sh` | Hidden-input prompt for API keys, writes to server via SSH pipe |

### Rollback

```bash
# Interactive (pick from list)
./scripts/rollback-api.sh

# List releases only
./scripts/rollback-api.sh --list
```

### Setup secrets

```bash
./scripts/setup-secrets.sh
```

Prompts for each key with hidden terminal input. Nothing stored locally —
values go directly to the server over SSH. See below for required keys.

---

## GitHub Actions Auto-Deploy

A workflow file exists at `.github/workflows/deploy-api.yml`. To enable:

1. Generate a deploy SSH key:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/onpoint-deploy
   ssh-copy-id -i ~/.ssh/onpoint-deploy.pub deploy@snel-bot
   ```

2. Configure these secrets in GitHub:
   - `DEPLOY_SSH_KEY` — contents of `~/.ssh/onpoint-deploy` (private key)
   - `DEPLOY_SSH_HOST` — hostname/IP of snel-bot
   - `DEPLOY_SSH_KNOWN_HOSTS` — output of `ssh-keyscan <host>`

3. Manual deploys still work via `pnpm deploy:api` or `./scripts/deploy-api.sh`

When enabled, pushes to `master` that touch `apps/api/`, `packages/`, or
`scripts/deploy-api.sh` will auto-deploy.

---

## Server Cleanup (One-Time)

Ran at setup to reclaim ~1 GB:

| Action                              | Reclaimed |
|-------------------------------------|-----------|
| `rm -rf /opt/onpoint-agent-bridge`  | ~35 MB    |
| `sudo journalctl --vacuum-time=7d`  | ~637 MB   |
| `pm2 flush`                         | varies    |
| `sudo apt-get clean`                | minor     |
| **Total**                           | **~1 GB** |

Consider adding a weekly cron:

```bash
0 3 * * 0 sudo journalctl --vacuum-time=7d && sudo apt-get clean -y
```

---

## Disk Budget

| Threshold  | Action                  |
|------------|-------------------------|
| >100 MB    | Warning in deploy log   |
| >200 MB    | Deploy fails            |
| >20% grow  | Alert (future GH Action)|

We keep the last **2 releases**. At ~87 MB each that's ~174 MB budgeted for
release history. Old releases are pruned automatically on each deploy.

---

## Security

- **`.env*` files are excluded from rsync** — secrets never leave the server
- **`shared/api/.env`** is the single source of truth for secrets
- **`setup-secrets.sh`** writes secrets directly over SSH — never stored locally
- **No git pull on deploy** — builds are deterministic from local lockfile
- **No pnpm on the server** — the deploy bundle is self-contained
- **`pm2 save + startup`** ensures process lineup survives reboot
- **`chmod 600`** on shared `.env` restricts access to the deploy user

---

## Troubleshooting

### PM2 won't start

```bash
ssh snel-bot
cd /opt/onpoint
pm2 logs onpoint-api --err --lines 50
```

### Symlink broken

```bash
ssh snel-bot
ls -la /opt/onpoint/apps/api   # check where it points
readlink /opt/onpoint/apps/api # resolve target
```

### Rollback needed

```bash
./scripts/rollback-api.sh
```

Or manually:
```bash
ssh snel-bot
cd /opt/onpoint
ls -1t releases/api/ | head -5
ln -sfn /opt/onpoint/releases/api/<previous-ts> /opt/onpoint/apps/api
pm2 reload onpoint-api
```
