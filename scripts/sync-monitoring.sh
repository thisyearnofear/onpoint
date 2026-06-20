#!/bin/bash
# scripts/sync-monitoring.sh
# Sync the local deploy/ tree to the Hetzner VPS and reload the
# monitoring stack in place (no container restart for Prometheus).
#
# Run from your LOCAL machine (not on the server).
#
# Usage:
#   ./scripts/sync-monitoring.sh             # sync + Prometheus reload
#   ./scripts/sync-monitoring.sh --dry-run   # preview rsync only
#   ./scripts/sync-monitoring.sh --restart   # also restart Grafana
#                                          # (needed when dashboard JSON
#                                          #  or provisioning files change)
#
# Prerequisites:
#   - SSH access to snel-bot configured in ~/.ssh/config
#   - The monitoring stack running on the server from deploy/
#   - Prometheus started with --web.enable-lifecycle
#
# Why sync the whole deploy/ tree (not just monitoring files)?
#   /opt/onpoint/deploy/ contains the monitoring configs but also
#   ecosystem.config.js, nginx configs, and the deploy README. Keeping
#   the whole tree in sync ensures these don't drift. The tree is small
#   (~60 KB) and source-controlled, so a full sync is cheap and safe.
#
#   RSYNC_EXCLUDES below protects any server-only files (e.g. .env).
#
# Note: the API release pipeline (scripts/deploy-api.sh) syncs
# apps/api + packages/, NOT deploy/. That's by design — deploy/
# changes don't require an API rebuild. This script is the deploy/
# counterpart.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SSH_HOST="${ONPOINT_SSH_HOST:-snel-bot}"
REMOTE_BASE="/opt/onpoint/deploy"
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3000"
LOCAL_TREE="deploy"
RSYNC_EXCLUDES=(
  "--exclude=.env"
  "--exclude=.env.*"
  "--exclude=*.local"
)

DRY_RUN=false
RESTART_GRAFANA=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --restart) RESTART_GRAFANA=true ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ── Colors ──────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; BLUE=""; RESET=""
fi

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}!${RESET} $*"; }
err()  { echo -e "${RED}✗${RESET} $*" >&2; }
info() { echo -e "${BLUE}→${RESET} $*"; }

# ── Preflight ───────────────────────────────────────────────────────
info "Syncing ${LOCAL_TREE}/ → ${SSH_HOST}:${REMOTE_BASE}/"

command -v rsync >/dev/null || { err "rsync not found in PATH"; exit 1; }
[[ -d "$LOCAL_TREE" ]] || { err "Local tree not found: $LOCAL_TREE"; exit 1; }

# ── Rsync ───────────────────────────────────────────────────────────
RSYNC_ARGS=(-av --delete "${RSYNC_EXCLUDES[@]}")

if $DRY_RUN; then
  warn "DRY RUN — not modifying the server"
  rsync "${RSYNC_ARGS[@]}" --dry-run \
    "${LOCAL_TREE}/" "${SSH_HOST}:${REMOTE_BASE}/"
  exit 0
fi

rsync "${RSYNC_ARGS[@]}" \
  "${LOCAL_TREE}/" "${SSH_HOST}:${REMOTE_BASE}/"
ok "rsync complete"

# ── Reload Prometheus ───────────────────────────────────────────────
echo
info "Reloading Prometheus (POST /-/reload)..."
if ssh "$SSH_HOST" "curl -s -f -X POST ${PROMETHEUS_URL}/-/reload" >/dev/null; then
  ok "Prometheus reloaded"
else
  err "Prometheus reload failed — is --web.enable-lifecycle set?"
  exit 1
fi

# ── Restart Grafana (if requested) ──────────────────────────────────
if $RESTART_GRAFANA; then
  echo
  info "Restarting Grafana (provisioning files require a restart)..."
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && docker compose -f docker-compose.monitoring.yml restart grafana" \
    | sed 's/^/    /'
  sleep 4
  ok "Grafana restarted"
fi

# ── Verify ──────────────────────────────────────────────────────────
echo
info "Verifying Prometheus targets..."

# Give Prometheus one scrape cycle to pick up new targets.
sleep 6

ssh "$SSH_HOST" "curl -s ${PROMETHEUS_URL}/api/v1/targets" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ok = bad = 0
for t in d['data']['activeTargets']:
    job = t['labels']['job']
    health = t['health']
    marker = '✓' if health == 'up' else '✗'
    print(f'    {marker} {job:15s} {health}')
    if health == 'up': ok += 1
    else: bad += 1
sys.exit(1 if bad else 0)
" || { err "Some targets are not 'up'"; exit 1; }

if $RESTART_GRAFANA; then
  echo
  info "Verifying Grafana datasource + dashboard..."
  DS_COUNT="$(ssh "$SSH_HOST" "curl -s -u admin:admin ${GRAFANA_URL}/api/datasources" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")"
  DB_COUNT="$(ssh "$SSH_HOST" "curl -s -u admin:admin '${GRAFANA_URL}/api/search?query=' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'")"
  echo "    datasources: ${DS_COUNT}, dashboards: ${DB_COUNT}"
  if [[ "$DS_COUNT" -lt 1 || "$DB_COUNT" -lt 1 ]]; then
    err "Grafana provisioning didn't load — check provisioning/datasources and provisioning/dashboards"
    exit 1
  fi
fi

echo
ok "Monitoring sync complete"