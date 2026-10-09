# OnPoint Deployment Guide — Hetzner VPS

> **Progress:** Phase 0 (Deploy Pipeline) — ✅ Complete 2026-05-26
> See [ADR 0001](../docs/adr/0001-backend-first-autonomy.md) for architecture rationale.

## Overview

OnPoint API runs on a shared Hetzner VPS (38 GB disk). We **build locally, rsync**
only what's needed — no `git pull` on the server, no pnpm on the server.

**Architecture:**
- **Frontend:** Fly.io (`fly.web.toml`, Next.js standalone) — presentation + identity. Deployed separately; see [GETTING_STARTED.md](../docs/GETTING_STARTED.md#deployment)
- **Backend API:** Hetzner VPS via PM2 (Express on port 48751)
- **Bridge:** Python FastAPI on port 48752 (Browser-Use / Purch)
- **Cache:** Redis on localhost:6379 (shared instance)
- **Worker:** `onpoint-worker` on 127.0.0.1:48754 (Phase 1) — heartbeat + task batch loop
- **Signer:** `onpoint-signer` on 127.0.0.1:48755 (Phase 4) — sole holder of `AGENT_PRIVATE_KEY`, signs mint/transfer requests from the autonomous executor

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

# Signer (onpoint-signer, port 48755) — sole holder of AGENT_PRIVATE_KEY.
# The executor on onpoint-api calls SIGNER_URL to request signatures
# for autonomous mint/purchase/tip actions; SIGNER_API_KEY must match
# between the two processes.
SIGNER_URL=http://localhost:48755
SIGNER_API_KEY=your-key-here
AGENT_PRIVATE_KEY=0x...
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

**Preferred: let CI deploy.** Pushes to `master` that touch the API deploy automatically (see
[GitHub Actions Auto-Deploy](#github-actions-auto-deploy)). The runner is Linux, so native modules such as
`sharp` are bundled for the server's platform.

**Local deploys are a fallback, and risky from macOS:** `npm install` runs on your machine, so a Mac bundle
ships `darwin-arm64` native binaries (e.g. `@img/sharp-libvips-darwin-arm64`) to a Linux server. Use a Linux
host or container for local deploys.

```bash
# Basic deploy (fallback; Linux only)
./scripts/deploy-api.sh

# Preview (dry run)
./scripts/deploy-api.sh --dry-run

# Via npm script
pnpm deploy:api
```

The script does:

```
 1. Build workspace deps       —— @repo/agent-core, @onpoint/shared-types, @repo/blockchain-client, @repo/db, @repo/storage, @repo/messaging-bridge, @repo/etherfuse
 2. Bundle                     —— copy API source + built dist/, rewrite workspace:* deps, npm install --omit=dev
 3. Size check                 —— fail >550 MB, warn >350 MB (see "Bundle size" below)
 4. rsync --delete             —— to /opt/onpoint/releases/api/<timestamp>/
 5. .env symlink               —— shared/api/.env → releases/api/…/.env
 6. Sync ecosystem config      —— deploy/ecosystem.config.js → /opt/onpoint/deploy/ (overwrites the server copy)
 7. Candidate preflight        —— starts the new release on an isolated port (28756) and polls /health (up to 25 attempts);
                                 a failure aborts BEFORE PM2 or the symlink is touched
 8. Bridge health check        —— the Python bridge must be up before the flip
 9. Symlink flip               —— apps/api → releases/api/<timestamp>/
10. pm2 reload onpoint-api     —— graceful reload
11. Health check               —— curl /health (retries) AND the PM2 instance count must equal `instances`
                                 for onpoint-api in ecosystem.config.js
12. Auto-rollback on failure   —— flips back, reloads, verifies, removes the failed release
13. Start/reload worker, agent-server, signer
14. Prune inactive releases    —— keep last 2, preserve active target
15. Disk summary               —— show usage
```

### Bundle size

The size check exists to protect the server's disk (38 GB, shared with other apps; each release is kept twice). The hard limit is `SIZE_FAIL_MB` in `scripts/deploy-api.sh` (currently 550). A Linux bundle built in
CI was ~519 MB. The biggest contributors are `@opentelemetry` (~90 MB), `viem` (~63 MB), and the messaging
stack `@spectrum-ts` + `@photon-ai` (~75 MB, pulled in by `spectrum-ts` 12 via `@repo/messaging-bridge`). If
the limit is hit again, prefer trimming dependencies before raising it.

### Production process topology

`onpoint-api` runs as **one `fork` process** (this is also what its saved PM2 dump records), not a cluster.
`deploy/ecosystem.config.js` matches that: `instances: 1`, `exec_mode: 'fork'`. `pm2 reload` cannot convert
an existing fork process to cluster, so a cluster config here makes step 11 fail and roll back every release.
To adopt cluster mode deliberately: `pm2 delete onpoint-api`, set `instances: 2` and `exec_mode: 'cluster'`,
start it from the ecosystem file, verify env loading (server.js reads the release `.env`), then `pm2 save`.
Never `pm2 save` while a service is down (see the Oct 2026 incident in `docs/ops/hetzner.md`, local-only).

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
📏 Checking build size: 519MB (limit: 550MB, warn: 350MB)
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

`.github/workflows/deploy-api.yml` deploys on pushes to `master` that touch `apps/api/**`, `packages/**`,
`pnpm-lock.yaml`, the workflow itself, or `scripts/deploy-api.sh`. It can also be run by hand
(**Actions → Deploy API → Run workflow**) with a `dry_run` option.

**Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_HOST` | Server IP or hostname |
| `DEPLOY_SSH_PORT` | SSH port (the production host does **not** use 22) |
| `DEPLOY_SSH_KEY` | Private key of a **dedicated deploy key** (passphrase-less) |
| `DEPLOY_SSH_KNOWN_HOSTS` | `ssh-keyscan -p <port> <host>` output |

The runner has no SSH config, so the workflow writes one that defines a `deploy-target` alias (user `deploy`,
the host and port from the secrets) and sets `ONPOINT_SSH_HOST=deploy-target` for `deploy-api.sh`.

**Deploy key.** Use a key generated only for this purpose, not a personal key. Authorize it on the server by
appending one line to `/home/deploy/.ssh/authorized_keys` (the production line is tagged
`github-actions-deploy@onpoint` and restricted with `no-port-forwarding,no-agent-forwarding,no-X11-forwarding`).
To revoke: delete that line and the `DEPLOY_SSH_KEY` secret. Rotate by generating a new pair and repeating.

**Safe first run / validating pipeline changes:**

1. Commit with `[skip ci]` in the message so the push does not deploy.
2. Run the workflow manually with `dry_run=true` and confirm it passes.
3. Run it again with `dry_run=false` and watch the preflight and health steps.

> A real deploy can fail safely: the preflight aborts before PM2 or the symlink is touched, and a failed
> health check rolls back automatically. Check `ssh snel-bot "readlink /opt/onpoint/apps/api"` afterward.

Note: a **dry run does not build the bundle or run the preflight**, so it cannot catch size or startup
problems. Only a real run exercises those.

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
- **`AGENT_PRIVATE_KEY` lives only in `onpoint-signer`** — `onpoint-api` never holds it; mint/transfer requests are signed remotely via `SIGNER_URL` + `SIGNER_API_KEY`. This isolates the hot key from the public-facing API process.
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

### CI: "This run likely failed because of a workflow file issue"

The workflow YAML is invalid, so no job ran. Validate locally:
`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-api.yml'))"`. A past cause was a
multi-line `cat <<EOF` with unindented secret lines inside a `run: |` block — pass secrets through `env:` and
use `printf` instead.

### CI fails at "Validate secrets"

One of `DEPLOY_SSH_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS` is unset (`gh secret list`). Also set
`DEPLOY_SSH_PORT` if the host does not listen on 22.

### "Build too large"

The bundle exceeded `SIZE_FAIL_MB`. Nothing was uploaded. See [Bundle size](#bundle-size) for what dominates it.
Measure without deploying by running a copy of the script that stops after the size check.

### "Staged API release failed startup preflight"

Nothing live was touched. The output ends with `preflight_status=failed`, `preflight_last_http=<code>`, a
`preflight_diag:` block (socket state and `/health` probes on 127.0.0.1, localhost, and ::1), and the
candidate's log. Read them in this order:

- `[FATAL] OnPoint API failed to listen … EADDRINUSE` — the port was held. The preflight port must be
  **outside the kernel ephemeral range** (`cat /proc/sys/net/ipv4/ip_local_port_range`, 32768–60999 on the
  production host). A port inside it can be occupied by an unrelated outbound connection, which `ss -ltn`
  (listeners only) cannot see. The preflight uses 28756; override with `ONPOINT_PREFLIGHT_PORT`.
- `preflight_last_http=000` with `curl-exit=7` — nothing is listening (check the log for a crash or bind error).
- `preflight_last_http=000` with the process alive — `/health` hangs; check Redis reachability.
- Any `5xx` — an application error; read the candidate's log.

### "API cluster is not fully online" after a passing health check

The PM2 instance count differs from `instances` for `onpoint-api` in `ecosystem.config.js`, and the script
rolled back. Compare `pm2 describe onpoint-api` (exec mode, instances) with the config. See
[Production process topology](#production-process-topology). `pm2 reload` cannot change fork ↔ cluster.

### A service logs "running on port N" but nothing answers

On Express 5, `app.listen`'s callback also runs when binding fails, with the error as its argument. The
entrypoints now exit with `[FATAL] … failed to listen on port N` instead. If you add a new `app.listen`, check
the `err` argument.

### `/health` hangs when Redis is down

ioredis 6 queues commands indefinitely while disconnected. `/health` bounds its `redis.ping()` to 1.5s and
reports `redis: "disconnected"`. Do the same for any new health or readiness check that touches Redis.
