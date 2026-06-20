#!/bin/bash
# scripts/rollback-api.sh
# Rollback @onpoint/api to a previous release.
# Lists available releases, flips the symlink, reloads PM2, and
# verifies the health check passes — with auto-revert on failure.
#
# Usage:
#   ./scripts/rollback-api.sh                # list releases and prompt
#   ./scripts/rollback-api.sh releases/api/20260526-120000  # explicit target
#   ./scripts/rollback-api.sh --list         # just list releases, no action
#   ./scripts/rollback-api.sh --dry-run      # preview without changes
#
# Architecture:
#   Flips /opt/onpoint/apps/api symlink to a previous release dir,
#   then reloads PM2. No build or rsync involved — takes ~10 seconds.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SSH_HOST="${ONPOINT_SSH_HOST:-snel-bot}"
REMOTE_BASE="/opt/onpoint"
CURRENT_SYMLINK="${REMOTE_BASE}/apps/api"
HEALTH_URL="http://localhost:48751/health"
HEALTH_RETRIES=6
HEALTH_DELAY=3
RELEASES_DIR="${REMOTE_BASE}/releases/api"

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}${BOLD}==>${NC} ${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}${BOLD}==>${NC} ${YELLOW}$1${NC}"; }
fail()  { echo -e "${RED}${BOLD}==>${NC} ${RED}$1${NC}" >&2; exit 1; }
step()  { echo -e "  ${BOLD}•${NC} $1"; }
header(){ echo -e "${BOLD}$1${NC}"; }

# ── Preflight ──────────────────────────────────────────────────────
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo ok" &>/dev/null; then
  fail "Cannot SSH to ${SSH_HOST} — check your SSH config"
fi

# ── Discover releases on server ────────────────────────────────────
list_releases() {
  ssh "$SSH_HOST" "ls -1t ${RELEASES_DIR} 2>/dev/null" || true
}

get_current() {
  ssh "$SSH_HOST" "readlink ${CURRENT_SYMLINK} 2>/dev/null" || echo ""
}

# ── List mode ──────────────────────────────────────────────────────
if [[ "${1:-}" == "--list" ]]; then
  echo -e "${BOLD}Available releases on ${SSH_HOST}:${NC}"
  echo "───────────────────────────────────────────────────"
  current=$(get_current)
  releases=$(list_releases)
  if [[ -z "$releases" ]]; then
    echo "  No releases found."
    exit 0
  fi
  while IFS= read -r r; do
    marker="  "
    if [[ -n "$current" && "${r}" == "$(basename "$current" 2>/dev/null)" ]]; then
      marker="→"  # active
    fi
    size=$(ssh "$SSH_HOST" "du -sh ${RELEASES_DIR}/${r} 2>/dev/null | cut -f1")
    printf "  %s %-30s %s\n" "$marker" "$r" "${size}"
  done <<< "$releases"
  exit 0
fi

# ── Dry run mode ───────────────────────────────────────────────────
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  warn "⚙️  DRY RUN — no changes will be made"
fi

# ── Determine target release ────────────────────────────────────────
TARGET=""
if [[ -n "${1:-}" && "$1" != "--dry-run" ]]; then
  TARGET="$1"
else
  # Interactive mode — list and prompt
  echo -e "${BOLD}Available releases on ${SSH_HOST}:${NC}"
  echo "───────────────────────────────────────────────────"
  current=$(get_current)
  releases=$(list_releases)
  if [[ -z "$releases" ]]; then
    fail "No releases found on server"
  fi

  idx=0
  declare -a RELEASE_LIST
  while IFS= read -r r; do
    RELEASE_LIST+=("$r")
    marker="  "
    if [[ -n "$current" && "$r" == "$(basename "$current" 2>/dev/null)" ]]; then
      marker="→"  # active (can't select)
    fi
    size=$(ssh "$SSH_HOST" "du -sh ${RELEASES_DIR}/${r} 2>/dev/null | cut -f1")
    printf "  [%d] %s %-30s %s\n" "$idx" "$marker" "$r" "${size}"
    ((idx++))
  done <<< "$releases"

  echo ""
  read -p "  Enter release number to rollback to: " CHOICE
  if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [[ "$CHOICE" -ge "${#RELEASE_LIST[@]}" ]]; then
    fail "Invalid selection"
  fi

  TARGET="${RELEASES_DIR}/${RELEASE_LIST[$CHOICE]}"
fi

# If a relative name was given, resolve it
if [[ "$TARGET" != /* ]]; then
  TARGET="${REMOTE_BASE}/${TARGET#/}"
fi

echo ""
info "🎯 Target: ${TARGET}"

# Verify target exists on server
if ! ssh "$SSH_HOST" "test -d ${TARGET}" &>/dev/null; then
  fail "Target release does not exist on server: ${TARGET}"
fi

# Verify server.js exists in target
if ! ssh "$SSH_HOST" "test -f ${TARGET}/server.js" &>/dev/null; then
  fail "Target release is missing server.js — not a valid release"
fi

# ── Capture current state (for auto-revert on failure) ──────────────
info "📋 Capturing current state..."
CURRENT=$(get_current)
PREV_ABSOLUTE=""
if [[ -n "$CURRENT" ]]; then
  if [[ "$CURRENT" == /* ]]; then
    PREV_ABSOLUTE="$CURRENT"
  else
    PREV_ABSOLUTE="${REMOTE_BASE}/${CURRENT#/}"
  fi
fi
echo "   Current: ${PREV_ABSOLUTE:-none}"
echo "   Target:  ${TARGET}"

if [[ "$PREV_ABSOLUTE" == "$TARGET" ]]; then
  warn "Target is already the active release — nothing to do"
  exit 0
fi

# ── Confirm ─────────────────────────────────────────────────────────
echo ""
read -p "  Rollback to $TARGET? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "  Aborted."
  exit 0
fi

# ── Execute rollback ───────────────────────────────────────────────
info "🔗 Flipping symlink..."
cmd "ssh ${SSH_HOST} \"ln -sfn ${TARGET} ${CURRENT_SYMLINK}\""
if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "ln -sfn ${TARGET} ${CURRENT_SYMLINK}"
  echo "   apps/api → $(ssh "$SSH_HOST" "readlink ${CURRENT_SYMLINK}")"
fi

info "🔄 Reloading PM2..."
cmd "ssh ${SSH_HOST} \"cd ${REMOTE_BASE} && pm2 reload onpoint-api\""
if [[ "$DRY_RUN" == false ]]; then
  ssh "$SSH_HOST" "cd ${REMOTE_BASE} && pm2 reload onpoint-api" || {
    fail "PM2 reload failed"
  }
fi

# ── Health check with auto-revert ──────────────────────────────────
info "🏥 Running health check..."
if [[ "$DRY_RUN" == false ]]; then
  HEALTH_OK=false
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    sleep "$HEALTH_DELAY"
    if ssh "$SSH_HOST" "curl -sf ${HEALTH_URL}" &>/dev/null; then
      HEALTH_OK=true
      echo -e "   ${GREEN}✅${NC} Health check passed (attempt ${i}/${HEALTH_RETRIES})"
      break
    fi
    echo -e "   ${YELLOW}⏳${NC} Waiting for service... (${i}/${HEALTH_RETRIES})"
  done

  if [[ "$HEALTH_OK" != true ]]; then
    echo -e "${RED}❌ Rollback health check failed after ${HEALTH_RETRIES} attempts${NC}"

    # Auto-revert to previous release
    if [[ -n "${PREV_ABSOLUTE}" ]]; then
      echo -e "   ${YELLOW}↩ Auto-reverting to ${PREV_ABSOLUTE}${NC}"
      ssh "$SSH_HOST" "ln -sfn ${PREV_ABSOLUTE} ${CURRENT_SYMLINK} && cd ${REMOTE_BASE} && pm2 reload onpoint-api"
      sleep "$HEALTH_DELAY"

      if ssh "$SSH_HOST" "curl -sf ${HEALTH_URL}" &>/dev/null; then
        echo -e "   ${GREEN}✅${NC} Auto-revert successful — back to ${PREV_ABSOLUTE}"
      else
        fail "🚨 CRITICAL: Auto-revert also failed — manual intervention required"
      fi
    else
      fail "No previous release to revert to — manual intervention required"
    fi
    exit 1
  fi
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
info "✅ Rollback complete"
echo "   Active: ${TARGET}"
echo "   View logs: ssh ${SSH_HOST} \"pm2 logs onpoint-api --lines 20\""
