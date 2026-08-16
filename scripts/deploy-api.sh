#!/bin/bash
# scripts/deploy-api.sh
# Build and deploy @onpoint/api with atomic symlink-based releases.
# Run from your LOCAL machine (not on the server).
#
# Usage:
#   ./scripts/deploy-api.sh                  # normal deploy
#   ./scripts/deploy-api.sh --dry-run        # preview without changes
#
# Prerequisites:
#   - pnpm 10.10.0+
#   - SSH access to snel-bot configured in ~/.ssh/config
#   - The server must have PM2 running with deploy/ecosystem.config.js
#
# Architecture:
#   /opt/onpoint/
#   ├── apps/api -> releases/api/20260526-153012   ← symlink (atomic flip)
#   ├── releases/api/
#   │   ├── 20260526-153012/                        ← active release
#   │   ├── 20260525-181530/                        ← rollback target
#   │   └── 20260524-091200/                        ← oldest, next to prune
#   └── shared/api/.env                             ← never rsynced

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SSH_HOST="${ONPOINT_SSH_HOST:-snel-bot}"
REMOTE_BASE="/opt/onpoint"
FILTER="@onpoint/api"
BUILD_DIR="./build/api"
KEEP_RELEASES=2
SIZE_WARN_MB=350
SIZE_FAIL_MB=450
HEALTH_URL="http://localhost:48751/health"
# Allow cold Node/PM2 starts (especially after creating a previously missing process)
# enough time to bind before declaring a release unhealthy.
HEALTH_RETRIES="${ONPOINT_HEALTH_RETRIES:-12}"
HEALTH_DELAY="${ONPOINT_HEALTH_DELAY:-5}"
# Bridge health check (Python web-bridge — see ADR 0008).
# The API proxies external_search → bridge, so the bridge must be up
# for any Tier 3 search to work. deploy-api.sh does not deploy bridge
# code (it reads live from the working tree), but it does verify the
# bridge is healthy before flipping the symlink so we don't ship a
# release that immediately starts failing every external_search.
BRIDGE_HEALTH_URL="http://localhost:48752/health"
BRIDGE_HEALTH_RETRIES=3
BRIDGE_HEALTH_DELAY=2
NPM_CACHE_DIR="/tmp/onpoint-npm-cache"
ISOLATED_DIR="/tmp/onpoint-isolated-build"

API_EXPECTED_INSTANCES=$(node -e "const config = require('./deploy/ecosystem.config.js'); const api = config.apps.find((app) => app.name === 'onpoint-api'); process.stdout.write(String(api?.instances || 1));")
TS=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="releases/api/$TS"
REMOTE_RELEASE="$REMOTE_BASE/$RELEASE_DIR"
REMOTE_CURRENT="$REMOTE_BASE/apps/api"
GROWTH_WARN_RATIO=1.2
GROWTH_FAIL_RATIO=1.5
PREV_SIZE_FILE="/tmp/onpoint-prev-size.txt"
DEPLOY_SUCCEEDED=false
REMOTE_RELEASE_CREATED=false

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ─────────────────────────────────────────────────────────
info()  { echo -e "${GREEN}${BOLD}==>${NC} ${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}${BOLD}==>${NC} ${YELLOW}$1${NC}"; }
fail()  { echo -e "${RED}${BOLD}==>${NC} ${RED}$1${NC}"; exit 1; }
cmd()   { echo -e "  ${BOLD}\$${NC} $1"; }

verify_api_recovery() {
  local health_ok=false
  local cluster_ok=false
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if ssh "$SSH_HOST" "curl -sf ${HEALTH_URL}" &>/dev/null; then
      health_ok=true
      break
    fi
    sleep 1
  done
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    cluster_ok=$(ssh "$SSH_HOST" "pm2 pid onpoint-api 2>/dev/null | tr ',' '\\n' | awk 'NF && \$1 > 0 { count++ } END { print (count == ${API_EXPECTED_INSTANCES} ? \"true\" : \"false\") }'" || echo false)
    [[ "$cluster_ok" == true ]] && break
    sleep 1
  done
  [[ "$health_ok" == true && "$cluster_ok" == true ]]
}

cleanup_failed_release() {
  rm -rf "$BUILD_DIR"

  if [[ "$DRY_RUN" == true || "$DEPLOY_SUCCEEDED" == true || "$REMOTE_RELEASE_CREATED" != true ]]; then
    return
  fi

  warn "🧹 Cleaning up failed release candidate: ${RELEASE_DIR}"
  ssh "$SSH_HOST" "set -e
    current=\$(readlink -f '${REMOTE_CURRENT}' 2>/dev/null || true)
    candidate=\$(readlink -f '${REMOTE_RELEASE}' 2>/dev/null || true)
    if [ -n \"\$candidate\" ] && [ \"\$current\" != \"\$candidate\" ]; then
      rm -rf '${REMOTE_RELEASE}'
      echo '   Removed: ${REMOTE_RELEASE}'
    else
      echo '   Skipped: release is still active or already absent'
    fi
  " || warn "⚠️  Failed to clean up ${REMOTE_RELEASE}; manual cleanup may be needed"
}

trap cleanup_failed_release EXIT

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Step 0: Preflight checks ────────────────────────────────────────
info "🚀 Deploying ${FILTER} — release ${TS}"
[[ "$DRY_RUN" == true ]] && warn "⚙️  DRY RUN — no changes will be made"

if ! command -v pnpm &>/dev/null; then
  fail "pnpm not found — install it first (https://pnpm.io/installation)"
fi

if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo ok" &>/dev/null; then
  fail "Cannot SSH to ${SSH_HOST} — check your SSH config"
fi

# ── Step 1: Build workspace packages (CJS output for Node.js) ───────
# The API depends on workspace packages. These must be built to CJS before deployment.
#
# Note: Uses explicit tsup path instead of `pnpm --filter <pkg> build` because
# `node-linker=hoisted` (set in .npmrc) doesn't create per-package node_modules/.bin
# directories, so pnpm's filtered lifecycle scripts can't find the tsup binary.
info "🔨 Building workspace packages (CJS)..."

ROOT_DIR="$(pwd)"
TSUP="$ROOT_DIR/node_modules/.bin/tsup"

# Package → directory mapping (relative to project root)
# Using indexed arrays for macOS bash 3.x compatibility
pkg_names=("@repo/agent-core" "@onpoint/shared-types" "@repo/blockchain-client" "@repo/db" "@repo/storage" "@repo/messaging-bridge" "@repo/etherfuse")
pkg_dirs=("packages/agent-core" "packages/shared-types" "packages/blockchain-client" "packages/db" "packages/storage" "packages/messaging-bridge" "packages/etherfuse")

if [[ ! -f "$TSUP" ]]; then
  fail "tsup not found at $TSUP — run pnpm install first"
fi

node scripts/check-db-migrations.mjs

if [[ "$DRY_RUN" == false ]]; then
  # Build all workspace packages in parallel
  pids=()
  for i in "${!pkg_names[@]}"; do
    pkg="${pkg_names[$i]}"
    dir="${pkg_dirs[$i]}"
    echo "   Building ${pkg} (${dir})..."
    (cd "$dir" && "$TSUP") &
    pids+=($!)
  done

  # Wait for all builds and check for failures
  failed=false
  for pid in "${pids[@]}"; do
    wait "$pid" || { failed=true; break; }
  done

  if [[ "$failed" == true ]]; then
    # Kill remaining background pids
    for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null; done
    fail "✗ One or more workspace packages failed to build"
  fi

  echo "   All workspace packages built successfully"
  node scripts/check-db-runtime.mjs
fi

# ── Step 2: Create deployment bundle ────────────────────────────────
# We assemble the bundle manually because `pnpm deploy --legacy` in a
# workspace resolves the ENTIRE lockfile (pulling in Next.js, wagmi,
# RainbowKit, etc. — 1 GB+). Instead we:
#   1. Copy apps/api source into a staging dir
#   2. Copy built workspace CJS artifacts into lib/ (outside node_modules)
#   3. Rewrite workspace:* → file:./lib/... references
#   4. npm install --omit=dev (resolves only @onpoint/api's tree)
info "📦 Creating deployment bundle..."

if [[ "$DRY_RUN" == false ]]; then
  rm -rf "$BUILD_DIR"
  mkdir -p "$BUILD_DIR/lib"

  # 1. Copy API source. Exclude local installs and secrets from the bundle.
  rsync -a \
    --exclude 'node_modules' \
    --exclude '.env*' \
    --exclude '*.log' \
    apps/api/ "$BUILD_DIR/"

  # 2. Copy built workspace packages (dist only) into lib/
  # agent-core
  mkdir -p "$BUILD_DIR/lib/agent-core"
  cp packages/agent-core/package.json "$BUILD_DIR/lib/agent-core/"
  cp -R packages/agent-core/dist "$BUILD_DIR/lib/agent-core/"

  # shared-types
  mkdir -p "$BUILD_DIR/lib/shared-types"
  cp packages/shared-types/package.json "$BUILD_DIR/lib/shared-types/"
  cp -R packages/shared-types/dist "$BUILD_DIR/lib/shared-types/"

  # blockchain-client
  mkdir -p "$BUILD_DIR/lib/blockchain-client"
  cp packages/blockchain-client/package.json "$BUILD_DIR/lib/blockchain-client/"
  cp -R packages/blockchain-client/dist "$BUILD_DIR/lib/blockchain-client/"

  # db
  mkdir -p "$BUILD_DIR/lib/db"
  cp packages/db/package.json "$BUILD_DIR/lib/db/"
  cp -R packages/db/dist "$BUILD_DIR/lib/db/"
  cp -R packages/db/drizzle "$BUILD_DIR/lib/db/"

  # storage
  mkdir -p "$BUILD_DIR/lib/storage"
  cp packages/storage/package.json "$BUILD_DIR/lib/storage/"
  cp -R packages/storage/dist "$BUILD_DIR/lib/storage/"

  # ipfs-client (agent-core dependency — TS-only, no build step)
  if [ -d packages/ipfs-client ]; then
    mkdir -p "$BUILD_DIR/lib/ipfs-client"
    cp packages/ipfs-client/package.json "$BUILD_DIR/lib/ipfs-client/"
    cp -R packages/ipfs-client/src "$BUILD_DIR/lib/ipfs-client/"
  fi

  # messaging-bridge (agent-server dependency)
  mkdir -p "$BUILD_DIR/lib/messaging-bridge"
  cp packages/messaging-bridge/package.json "$BUILD_DIR/lib/messaging-bridge/"
  cp -R packages/messaging-bridge/dist "$BUILD_DIR/lib/messaging-bridge/"

  # etherfuse (API dependency for fiat onramp)
  mkdir -p "$BUILD_DIR/lib/etherfuse"
  cp packages/etherfuse/package.json "$BUILD_DIR/lib/etherfuse/"
  cp -R packages/etherfuse/dist "$BUILD_DIR/lib/etherfuse/"

  # 3. Rewrite workspace:* → file:./lib/... in all package.json files
  #    Also copy @repo/ipfs-client if agent-core depends on it
  node -e "
    const fs = require('fs');

    function rewriteDeps(pkgPath, map) {
      if (!fs.existsSync(pkgPath)) return;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      let changed = false;
      for (const depType of ['dependencies', 'peerDependencies']) {
        if (!pkg[depType]) continue;
        for (const [name, ver] of Object.entries(pkg[depType])) {
          if (ver === 'workspace:*' && map[name]) {
            pkg[depType][name] = map[name];
            changed = true;
          }
        }
      }
      if (changed) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      }
    }

    const map = {
      '@repo/agent-core': 'file:./lib/agent-core',
      '@onpoint/shared-types': 'file:./lib/shared-types',
      '@repo/blockchain-client': 'file:./lib/blockchain-client',
      '@repo/ipfs-client': 'file:./lib/ipfs-client',
      '@repo/db': 'file:./lib/db',
      '@repo/storage': 'file:./lib/storage',
      '@repo/messaging-bridge': 'file:./lib/messaging-bridge',
      '@repo/etherfuse': 'file:./lib/etherfuse',
    };

    rewriteDeps('$BUILD_DIR/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/agent-core/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/shared-types/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/blockchain-client/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/ipfs-client/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/db/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/storage/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/messaging-bridge/package.json', map);
    rewriteDeps('$BUILD_DIR/lib/etherfuse/package.json', map);

    // Strip only devDependencies and scripts from lib/ packages
    // Keep dependencies and peerDependencies so npm resolves their
    // transitive deps (e.g., @lighthouse/web3 -> bls-eth-wasm)
    for (const dir of ['agent-core','shared-types','blockchain-client','ipfs-client','db','storage','messaging-bridge','etherfuse']) {
      const pkgPath = '$BUILD_DIR/lib/' + dir + '/package.json';
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      delete pkg.devDependencies;
      delete pkg.scripts;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  "

  # 4. Install production deps in an ISOLATED temp dir.
  #    Running npm inside the monorepo causes it to walk up, find the root
  #    package.json, follow pnpm symlinks, and MUTATE source files.
  #    Running outside the monorepo prevents this.
  #
  #    Use a persistent npm cache to avoid re-downloading every deploy.
  #    --prefer-offline uses cached packages when available.
  #    Copy .npmrc from project root so npm uses workspace config.
  rm -rf "$ISOLATED_DIR"
  mkdir -p "$ISOLATED_DIR" "$NPM_CACHE_DIR"
  cp -R "$BUILD_DIR/." "$ISOLATED_DIR/"
  if [ -f .npmrc ]; then cp .npmrc "$ISOLATED_DIR/.npmrc"; fi
  echo 'legacy-peer-deps=true' >> "$ISOLATED_DIR/.npmrc"
  cd "$ISOLATED_DIR"
  npm install --omit=dev --ignore-scripts --prefer-offline --cache "$NPM_CACHE_DIR" --no-audit --no-fund 2>&1
  cd - > /dev/null
  # Copy resolved node_modules back (sources are 88KB; node_modules is the bulk)
  rm -rf "$BUILD_DIR/node_modules"
  cp -R "$ISOLATED_DIR/node_modules" "$BUILD_DIR/"
  rm -rf "$ISOLATED_DIR"

  echo "   Deploy bundle created at ${BUILD_DIR}"
fi

# ── Step 3: Size budget check (after npm install — catches full node_modules) ──
info "📏 Checking build size..."
if [[ -d "$BUILD_DIR" ]]; then
  SIZE_KB=$(du -sk "$BUILD_DIR" 2>/dev/null | cut -f1)
  SIZE_MB=$((SIZE_KB / 1024))
  echo "   Build size: ${SIZE_MB}MB (limit: ${SIZE_FAIL_MB}MB, warn: ${SIZE_WARN_MB}MB)"

  if [[ "$SIZE_MB" -gt "$SIZE_FAIL_MB" ]]; then
    fail "❌ Build too large: ${SIZE_MB}MB exceeds hard limit ${SIZE_FAIL_MB}MB"
  fi

  if [[ "$SIZE_MB" -gt "$SIZE_WARN_MB" ]]; then
    warn "⚠️  Build size ${SIZE_MB}MB exceeds warning threshold ${SIZE_WARN_MB}MB"
  fi
else
  echo "   (skipped — dry run or build directory missing)"
fi

# ── Step 4: Ensure remote release directory exists ──────────────────
info "📁 Preparing remote release directory..."
[[ "$DRY_RUN" == false ]] && ssh "$SSH_HOST" "mkdir -p ${REMOTE_BASE}/releases/api"

# ── Step 5: rsync build to remote timestamped release dir ───────────
info "📤 Syncing build to remote..."
RSYNC_CMD="rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules/.cache' \
  --exclude '*.log' \
  --exclude '.env*' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --chmod=D755,F644 \
  ${BUILD_DIR}/ ${SSH_HOST}:${REMOTE_RELEASE}/"

if [[ -d "$BUILD_DIR" ]]; then
  cmd "rsync -avz --delete [excludes...] ${BUILD_DIR}/ ${SSH_HOST}:${REMOTE_RELEASE}/"
  if [[ "$DRY_RUN" == false ]]; then
    REMOTE_RELEASE_CREATED=true
    eval "$RSYNC_CMD"
  fi
else
  echo "   (skipped — build directory missing)"
fi

# ── Step 5.5: Symlink shared/env into release ─────────────────────
info "🔗 Symlinking shared/api/.env into release..."
[[ "$DRY_RUN" == false ]] && ssh "$SSH_HOST" "ln -sf ${REMOTE_BASE}/shared/api/.env ${REMOTE_RELEASE}/.env"

# ── Step 5.6: Sync deploy config (ecosystem.config.js) ─────────────
# The PM2 ecosystem config lives outside the release tree at
# /opt/onpoint/deploy/ecosystem.config.js. Sync it on every deploy
# so changes to worker definitions, env vars, etc. are applied.
info "📋 Syncing PM2 ecosystem config..."
cmd "rsync deploy/ecosystem.config.js ${SSH_HOST}:${REMOTE_BASE}/deploy/ecosystem.config.js"
if [[ "$DRY_RUN" == false ]]; then
  rsync deploy/ecosystem.config.js "${SSH_HOST}:${REMOTE_BASE}/deploy/ecosystem.config.js"
fi

# ── Step 5.7: Candidate startup preflight ───────────────────────────
# Start the staged release directly on an isolated port before PM2 touches
# the live process. This catches missing bundle assets/imports and fatal
# production configuration errors without risking the current release.
info "🧪 Preflighting staged API release..."
if [[ "$DRY_RUN" == false ]]; then
  PREFLIGHT_LOG="/tmp/onpoint-preflight-${TS}.log"
  ssh "$SSH_HOST" "set +e
    cd '${REMOTE_RELEASE}'
    if (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ':48756 '; then
      echo 'preflight_port=occupied'
      exit 1
    fi
    setsid env NODE_ENV=production PORT=48756 node server.js > '${PREFLIGHT_LOG}' 2>&1 &
    pid=\$!
    status=1
    for i in \$(seq 1 25); do
      if curl -sf --max-time 2 http://127.0.0.1:48756/health > /dev/null 2>&1; then
        status=0
        break
      fi
      if ! kill -0 \"\$pid\" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 \"\$pid\" 2>/dev/null; then
      kill -TERM -- -\"\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true
      sleep 1
      kill -KILL -- -\"\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true
    fi
    if [ \"\$status\" -ne 0 ]; then
      echo 'preflight_status=failed'
      sed -E \"s#(postgres(ql)?://[^[:space:]\\\"'\''<>]+|https?://[^[:space:]\\\"'\''<>]+|0x[a-fA-F0-9]{20,}|[A-Za-z_]*(API|SECRET|TOKEN|PASSWORD|PRIVATE|DSN|KEY)[A-Za-z_]*[=:][^[:space:]\\\"'\''<>]+)#<redacted>#g\" '${PREFLIGHT_LOG}' | tail -120
    else
      echo 'preflight_status=healthy'
    fi
    rm -f '${PREFLIGHT_LOG}'
    exit \"\$status\"
  " || fail "❌ Staged API release failed startup preflight"
fi

# ── Step 5.8: Verify independently managed bridge before flip ────────
# The bridge is not part of this API release. Validate both its HTTP
# endpoint and PM2 ownership while the current API is still untouched.
info "🌉 Verifying independently managed bridge..."
if [[ "$DRY_RUN" == false ]]; then
  BRIDGE_OK=false
  for i in $(seq 1 "$BRIDGE_HEALTH_RETRIES"); do
    if ssh "$SSH_HOST" "curl -sf ${BRIDGE_HEALTH_URL}" &>/dev/null; then
      BRIDGE_OK=true
      echo -e "   ${GREEN}✅${NC} Bridge health check passed (attempt ${i}/${BRIDGE_HEALTH_RETRIES})"
      break
    fi
    echo -e "   ${YELLOW}⏳${NC} Waiting for bridge... (${i}/${BRIDGE_HEALTH_RETRIES})"
    sleep "$BRIDGE_HEALTH_DELAY"
  done
  [[ "$BRIDGE_OK" == true ]] || fail "❌ Bridge (${BRIDGE_HEALTH_URL}) is unreachable; aborting before symlink flip"

  BRIDGE_PM2_OK=false
  for j in $(seq 1 "$BRIDGE_HEALTH_RETRIES"); do
    if ssh "$SSH_HOST" "test -n \"\$(pm2 pid onpoint-bridge 2>/dev/null)\" && test \"\$(pm2 pid onpoint-bridge 2>/dev/null)\" -gt 0 && pm2 describe onpoint-bridge --no-color 2>/dev/null | grep -q online"; then
      BRIDGE_PM2_OK=true
      break
    fi
    sleep 1
  done
  [[ "$BRIDGE_PM2_OK" == true ]] || fail "❌ Bridge responds but PM2 does not report onpoint-bridge online; refusing deployment"
fi

# ── Step 6: Atomic symlink flip ─────────────────────────────────────
info "🔗 Flipping symlink: apps/api → ${RELEASE_DIR}"

if [[ "$DRY_RUN" == false ]]; then
  # Check if apps/api is a real directory (first deploy transition)
  IS_DIR=$(ssh "$SSH_HOST" "test -d ${REMOTE_CURRENT} && ! test -L ${REMOTE_CURRENT} && echo 'yes' || echo 'no'")

  if [[ "$IS_DIR" == "yes" ]]; then
    echo "   (first deploy: renaming existing apps/api → apps/api.bak)"
    ssh "$SSH_HOST" "mv ${REMOTE_CURRENT} ${REMOTE_CURRENT}.bak"
    HAS_BAK=true
  else
    HAS_BAK=false
  fi

  # Capture previous symlink target for potential rollback
  PREV_RELEASE=$(ssh "$SSH_HOST" "readlink ${REMOTE_CURRENT}" 2>/dev/null || echo "")
  echo "   Previous: ${PREV_RELEASE:-none}"

  # Create the symlink using ABSOLUTE path (relative would resolve to
  # /opt/onpoint/apps/api/releases/api/$TS which is wrong)
  ssh "$SSH_HOST" "ln -sfn ${REMOTE_RELEASE} ${REMOTE_CURRENT}"
  echo "   Current:  ${REMOTE_RELEASE}"
fi

cmd "ssh ${SSH_HOST} \"ln -sfn ${REMOTE_RELEASE} ${REMOTE_CURRENT}\""

# ── Step 7: PM2 reload (zero-downtime) ──────────────────────────────
info "🔄 Reloading PM2 process: onpoint-api"
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api\""

if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api" || {
    if [[ -n "${PREV_RELEASE:-}" ]]; then
      warn "↩ PM2 reload failed; rolling symlink back to ${PREV_RELEASE}"
      PREV_ABSOLUTE="${REMOTE_BASE}/${PREV_RELEASE#/}"
      if [[ "$PREV_RELEASE" = /* ]]; then
        PREV_ABSOLUTE="$PREV_RELEASE"
      fi
      ssh "$SSH_HOST" "ln -sfn ${PREV_ABSOLUTE} ${REMOTE_CURRENT} && cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api"
      verify_api_recovery || fail "PM2 reload failed and rollback validation failed"
    elif [[ "${HAS_BAK:-false}" == true ]]; then
      warn "↩ PM2 reload failed; restoring original apps/api from backup"
      ssh "$SSH_HOST" "rm -f ${REMOTE_CURRENT} && mv ${REMOTE_CURRENT}.bak ${REMOTE_CURRENT} && cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api"
      verify_api_recovery || fail "PM2 reload failed and rollback validation failed"
    fi
    fail "PM2 reload failed"
  }
fi

# ── Step 8: Health check with automatic rollback ────────────────────
info "🏥 Running health checks..."

# ── 8a. API health check (existing behaviour, unchanged) ───────────
if [[ "$DRY_RUN" == false ]]; then
  HEALTH_OK=false
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    sleep "$HEALTH_DELAY"
    if ssh "$SSH_HOST" "curl -sf ${HEALTH_URL}" &>/dev/null; then
      HEALTH_OK=true
      echo -e "   ${GREEN}✅${NC} API health check passed (attempt ${i}/${HEALTH_RETRIES})"
      break
    fi
    echo -e "   ${YELLOW}⏳${NC} Waiting for API... (${i}/${HEALTH_RETRIES})"
  done

  # Require every expected API cluster worker to be online, not just one
  # successful HTTP response through the shared cluster listener. PM2 can
  # briefly report a worker as launching during a graceful reload, so poll
  # the process state before declaring the release unhealthy.
  API_CLUSTER_OK=false
  for j in $(seq 1 "$HEALTH_RETRIES"); do
    API_CLUSTER_OK=$(ssh "$SSH_HOST" "pm2 pid onpoint-api 2>/dev/null | tr ',' '\\n' | awk 'NF && \$1 > 0 { count++ } END { print (count == ${API_EXPECTED_INSTANCES} ? \"true\" : \"false\") }'" || echo false)
    [[ "$API_CLUSTER_OK" == true ]] && break
    sleep "$HEALTH_DELAY"
  done
  if [[ "$API_CLUSTER_OK" != true ]]; then
    HEALTH_OK=false
    warn "⚠️  API cluster is not fully online"
  fi

  if [[ "$HEALTH_OK" != true ]]; then
    echo -e "${RED}❌ Health check failed after ${HEALTH_RETRIES} attempts${NC}"
    warn "🔎 Capturing redacted API diagnostics before rollback"
    ssh "$SSH_HOST" 'set +e
      echo "--- PM2 API state ---"
      pm2 jlist 2>/dev/null | node -e '\''
        let input=""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
          try {
            const apps = JSON.parse(input).filter((app) => app.name === "onpoint-api");
            console.log(JSON.stringify(apps.map((app) => ({
              name: app.name,
              pid: app.pid,
              status: app.pm2_env?.status,
              restartTime: app.pm2_env?.restart_time,
              uptime: app.pm2_env?.pm_uptime,
              execPath: app.pm2_env?.pm_exec_path,
            }))));
          } catch { console.log("<pm2-state-unavailable>"); }
        });
      '\''
      echo "--- listener ---"
      (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E "48751|48752" || true
      echo "--- API log tail ---"
      (tail -80 /var/log/pm2/onpoint-api-error.log 2>/dev/null; tail -80 /var/log/pm2/onpoint-api-out.log 2>/dev/null) | sed -E "s#(postgres(ql)?://[^[:space:]\\\"'\''<>]+|https?://[^[:space:]\\\"'\''<>]+|0x[a-fA-F0-9]{20,}|(API|SECRET|TOKEN|KEY|PASSWORD|PRIVATE)[A-Z_]*[=:][^[:space:]\\\"'\''<>]+)#<redacted>#g"
    ' || warn "⚠️  Could not capture remote API diagnostics"

    # Attempt rollback
    if [[ -n "${PREV_RELEASE:-}" ]]; then
      echo -e "   ${YELLOW}↩ Rolling back to ${PREV_RELEASE}${NC}"
      # PREV_RELEASE might be relative, ensure absolute path
      PREV_ABSOLUTE="${REMOTE_BASE}/${PREV_RELEASE#/}"
      if [[ "$PREV_RELEASE" = /* ]]; then
        PREV_ABSOLUTE="$PREV_RELEASE"
      fi
      ssh "$SSH_HOST" "ln -sfn ${PREV_ABSOLUTE} ${REMOTE_CURRENT} && cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api"

      if verify_api_recovery; then
        echo -e "   ${GREEN}✅${NC} Rollback successful — running ${PREV_ABSOLUTE}"
      else
        fail "Rollback also failed — API health or cluster validation failed"
      fi
    elif [[ "${HAS_BAK:-false}" == true ]]; then
      # First deploy fallback: restore original directory
      echo -e "   ${YELLOW}↩ Restoring original apps/api from backup${NC}"
      ssh "$SSH_HOST" "rm -f ${REMOTE_CURRENT} && mv ${REMOTE_CURRENT}.bak ${REMOTE_CURRENT} && cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-api"

      if verify_api_recovery; then
        echo -e "   ${GREEN}✅${NC} Rollback successful — restored original directory"
      else
        fail "Rollback also failed — API health or cluster validation failed"
      fi
    else
      fail "No previous release to roll back to"
    fi
    exit 1
  fi
fi

# ── Step 9: Start/reload onpoint-worker ──────────────────────────
# Use startOrGracefulReload so it works on first deploy (process doesn't
# exist yet → starts) and subsequent deploys (process exists → reloads).
info "🔄 Starting/reloading PM2 process: onpoint-worker"
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-worker\""

if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-worker" || {
    warn "⚠️  Worker start/reload failed — API deploy succeeded"
  }
fi

# ── Step 9.5: Start/reload onpoint-agent-server ──────────────────────
# Same pattern as the worker — startOrGracefulReload handles first-deploy
# (process doesn't exist yet → starts) and subsequent deploys (reloads).
info "🔄 Starting/reloading PM2 process: onpoint-agent-server"
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-agent-server\""

if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-agent-server" || {
    warn "⚠️  Agent server start/reload failed — API deploy succeeded"
  }
fi

# ── Step 9.6: Start/reload onpoint-signer ────────────────────────────
# Isolated signer process (ADR 0001 Phase 4). Holds AGENT_PRIVATE_KEY
# exclusively on loopback-only socket.
info "🔄 Starting/reloading PM2 process: onpoint-signer"
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-signer\""

if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && pm2 startOrGracefulReload deploy/ecosystem.config.js --only onpoint-signer" || {
    warn "⚠️  Signer start/reload failed — API deploy succeeded"
  }
fi

# ── Step 10: Cleanup old backup (if this was first-deploy transition) ─
if [[ "$DRY_RUN" == false && "${HAS_BAK:-false}" == true ]]; then
  info "🧹 Removing backup of original apps/api directory"
  ssh "$SSH_HOST" "rm -rf ${REMOTE_CURRENT}.bak"
  echo "   Removed: ${REMOTE_CURRENT}.bak"
fi

# ── Step 11: Prune old releases ─────────────────────────────────────
info "🧹 Pruning old releases (keeping ${KEEP_RELEASES})"
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && prune inactive releases while preserving apps/api target\""

if [[ "$DRY_RUN" == false ]]; then
  PRUNED=$(ssh "$SSH_HOST" "cd ${REMOTE_BASE} && \
    active=\$(readlink -f apps/api 2>/dev/null || true) && \
    ls -1t releases/api/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do \
      candidate=\$(readlink -f \"releases/api/\$old\" 2>/dev/null || true); \
      if [ -n \"\$candidate\" ] && [ \"\$candidate\" != \"\$active\" ]; then \
        printf '%s\n' \"\$old\"; \
      fi; \
    done")
  if [[ -n "$PRUNED" ]]; then
    echo "$PRUNED" | while read -r old; do
      ssh "$SSH_HOST" "rm -rf ${REMOTE_BASE}/releases/api/${old}"
      echo "   Removed: ${old}"
    done
  else
    echo "   Nothing to prune"
  fi
fi

# ── Step 12: Final disk usage check with growth threshold ───────────
info "💾 Remote disk status"
if [[ "$DRY_RUN" == false ]]; then
  # Show disk usage
  ssh "$SSH_HOST" "df -h ${REMOTE_BASE} | tail -1 | awk '{print \"   Used: \" \$3 \" / \" \$2 \" (\" \$5 \")\"}'"
  echo ""
  ssh "$SSH_HOST" "du -sh ${REMOTE_BASE}/releases/api/*/ 2>/dev/null | sort -rh | while read line; do echo \"   \$line\"; done"

  # Growth check against previous deploy
  CURRENT_SIZE=$(ssh "$SSH_HOST" "du -sb ${REMOTE_BASE} 2>/dev/null | cut -f1" || echo "0")
  if [[ -f "$PREV_SIZE_FILE" ]]; then
    PREV_SIZE=$(cat "$PREV_SIZE_FILE")
    if [[ "$PREV_SIZE" -gt 0 && "$CURRENT_SIZE" -gt 0 ]]; then
      RATIO=$(echo "scale=2; $CURRENT_SIZE / $PREV_SIZE" | bc 2>/dev/null || echo "0")
      if (( $(echo "$RATIO > $GROWTH_FAIL_RATIO" | bc -l 2>/dev/null || echo "0") )); then
        warn "⚠️  /opt/onpoint grew ${RATIO}× since last deploy (fail >${GROWTH_FAIL_RATIO}×)"
        echo "   Prev: $(echo $PREV_SIZE | awk '{printf "%.0f MB", $1/1048576}')  Now: $(echo $CURRENT_SIZE | awk '{printf "%.0f MB", $1/1048576}')"
      elif (( $(echo "$RATIO > $GROWTH_WARN_RATIO" | bc -l 2>/dev/null || echo "0") )); then
        warn "⚠️  /opt/onpoint grew ${RATIO}× since last deploy (warn >${GROWTH_WARN_RATIO}×)"
        echo "   Prev: $(echo $PREV_SIZE | awk '{printf "%.0f MB", $1/1048576}')  Now: $(echo $CURRENT_SIZE | awk '{printf "%.0f MB", $1/1048576}')"
      fi
    fi
  fi
  echo "$CURRENT_SIZE" > "$PREV_SIZE_FILE"
fi

# ── Cleanup local build ─────────────────────────────────────────────
DEPLOY_SUCCEEDED=true
rm -rf "$BUILD_DIR"
echo ""

# ── Done ────────────────────────────────────────────────────────────
info "✅ Deploy complete! Release: ${TS}"
echo "   View logs: ssh ${SSH_HOST} \"pm2 logs onpoint-api --lines 20\""
echo "   Worker:    ssh ${SSH_HOST} \"pm2 logs onpoint-worker --lines 20\""
echo "   Bridge:    ssh ${SSH_HOST} \"pm2 logs onpoint-bridge --lines 20\""
echo "   Dashboard: http://${SSH_HOST}:48751/status-ui"
echo "   Health:    ssh ${SSH_HOST} \"curl ${HEALTH_URL}\""
echo "   Bridge:    ssh ${SSH_HOST} \"curl ${BRIDGE_HEALTH_URL}\""
echo "   Config:    ssh ${SSH_HOST} \"pm2 show onpoint-worker --no-color | head -10\""
