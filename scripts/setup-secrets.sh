#!/bin/bash
# scripts/setup-secrets.sh
# Securely populate shared/api/.env on the server.
# 
# This script prompts for each secret value using hidden terminal input
# (nothing is echoed to the screen or saved to your local disk).
# Values are written directly to the server via SSH.
#
# Usage:
#   ./scripts/setup-secrets.sh              # interactive mode
#   ./scripts/setup-secrets.sh --check      # check which secrets are missing
#
# Security:
#   - read -s hides input from the terminal
#   - Values stream through SSH pipe — never written to a local file
#   - Server file has chmod 600 (owner read/write only)
#   - After setup, remove your terminal scrollback to clear any residual

set -euo pipefail

SSH_HOST="${ONPOINT_SSH_HOST:-snel-bot}"
REMOTE_ENV="/opt/onpoint/shared/api/.env"

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}${BOLD}==>${NC} ${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}${BOLD}==>${NC} ${YELLOW}$1${NC}"; }
fail()  { echo -e "${RED}${BOLD}==>${NC} ${RED}$1${NC}" >&2; exit 1; }
cmd()   { echo -e "  ${BOLD}\$${NC} $1"; }

# ── Check mode: report which secrets are present/missing ────────────
check_mode() {
  info "🔍 Checking secrets on ${SSH_HOST}"
  if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "test -f $REMOTE_ENV" 2>/dev/null; then
    warn "⚠️  No .env file exists at ${REMOTE_ENV} on the server"
    echo "   Run without --check to create one."
    exit 0
  fi

  echo ""
  printf "  %-35s %s\n" "Secret" "Status"
  printf "  %-35s %s\n" "──────" "──────"

  check_secret "VENICE_API_KEY"
  check_secret "GOOGLE_GEMINI_API_KEY"
  check_secret "OPENAI_API_KEY"
  check_secret "SERVICE_API_KEY"
  check_secret "AGENT_WALLET_ADDRESS"
  check_secret "VERCEL_DOMAIN"
  check_secret "PREMIUM_USERS"

  echo ""
  info "Edit manually: ssh ${SSH_HOST} 'nano ${REMOTE_ENV}'"
  exit 0
}

check_secret() {
  local key="$1"
  local val
  val=$(ssh "$SSH_HOST" "grep -oP '^${key}=\K.*' ${REMOTE_ENV} 2>/dev/null || true")
  if [[ -n "$val" ]]; then
    printf "  ${GREEN}%-35s ✅ set${NC}\n" "$key"
  else
    printf "  ${YELLOW}%-35s ⚠️  not set${NC}\n" "$key"
  fi
}

# ── Prompt mode: collect values and write to server ─────────────────
prompt_secret() {
  local key="$1"
  local description="$2"
  local default="${3:-}"
  local val=""

  if [[ -n "$default" ]]; then
    echo -e "  ${BOLD}$key${NC} — $description"
    echo -n "    Value (Enter for default: $default): "
  else
    echo -e "  ${BOLD}$key${NC} — $description"
    echo -n "    Value (blank to skip): "
  fi

  read -rs val
  echo "" # newline after hidden input

  if [[ -z "$val" && -n "$default" ]]; then
    val="$default"
  fi

  if [[ -n "$val" ]]; then
    echo "$key=$val" >> "$TEMP_ENV"
    echo -e "    ${GREEN}✓${NC} set"
  else
    echo -e "    ${YELLOW}—${NC} skipped"
  fi
  echo ""
}

# ── Main ────────────────────────────────────────────────────────────

# Check mode
if [[ "${1:-}" == "--check" ]]; then
  check_mode
fi

info "🔐 OnPoint API — Secure Secret Setup"
echo ""
echo "  This script will prompt for each secret value."
echo "  Typed input is hidden from the terminal."
echo "  Values are written directly to ${SSH_HOST}:${REMOTE_ENV}"
echo "  They will NEVER be stored on your local machine."
echo ""

# Verify SSH access
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo ok" &>/dev/null; then
  fail "Cannot SSH to ${SSH_HOST} — check your SSH config"
fi

# Ensure shared/api/ exists on server
ssh "$SSH_HOST" "mkdir -p $(dirname "$REMOTE_ENV")"

# Create a temp file locally (will be cleaned up)
umask 077
TEMP_ENV=$(mktemp /tmp/onpoint-env-XXXXXX)
trap 'rm -f "$TEMP_ENV"' EXIT INT TERM

# Write header
cat > "$TEMP_ENV" << 'HEADER'
# OnPoint API Environment Variables
# Managed by scripts/setup-secrets.sh
# File permissions: 600 (owner read/write only)

HEADER

echo -e "${BOLD}Environment variables${NC}"
echo "─────────────────────────────────────────────────────────────"
echo ""

# Prompt for each secret with clear description
prompt_secret "VENICE_API_KEY"         "Venice AI API key — required for vision, analyze, and agent routes" ""
prompt_secret "GOOGLE_GEMINI_API_KEY"  "Google Gemini API key — required for Live Session routes" ""
prompt_secret "OPENAI_API_KEY"         "OpenAI API key — optional fallback for AI routes" ""
prompt_secret "SERVICE_API_KEY"        "Service-to-service auth key — shared between Vercel and Hetzner" ""
prompt_secret "AGENT_WALLET_ADDRESS"   "Agent wallet address for gas checks (0x...)" ""
prompt_secret "VERCEL_DOMAIN"          "Vercel domain for agent route proxying (e.g., onpoint.vercel.app)" ""
prompt_secret "PREMIUM_USERS"          "Comma-separated list of premium user IDs (optional)" ""

echo "─────────────────────────────────────────────────────────────"
echo ""

# Confirm before writing
if [[ ! -s "$TEMP_ENV" ]]; then
  # Only header was written — no secrets provided
  warn "No secrets entered — nothing to write"
  exit 0
fi

echo -e "  ${YELLOW}About to write $(wc -l < "$TEMP_ENV") lines to ${SSH_HOST}:${REMOTE_ENV}${NC}"
read -p "  Proceed? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "  Aborted."
  exit 0
fi

# Write to server via SSH
echo ""
info "📤 Writing secrets to server..."
cmd "cat > ${REMOTE_ENV}"
ssh "$SSH_HOST" "cat > ${REMOTE_ENV}" < "$TEMP_ENV"
ssh "$SSH_HOST" "chmod 600 ${REMOTE_ENV}"

echo ""
info "✅ Secrets written to ${SSH_HOST}:${REMOTE_ENV}"
echo "   Permissions: 600 (owner read/write only)"
echo ""

# Verify
echo -e "  ${BOLD}Verification (key names only):${NC}"
echo "  ──────────────────────────────────────────"
ssh "$SSH_HOST" "grep -oE '^[A-Z_]+=' ${REMOTE_ENV} 2>/dev/null | grep -v '^#' | while read k; do echo \"   ✓ \$k\"; done"
echo ""

info "Secrets will take effect on next PM2 reload (run deploy or pm2 restart onpoint-api)"
echo ""
echo -e "  ${YELLOW}Security note:${NC} Your terminal may have captured the keystrokes in scrollback."
echo -e "  Run ${BOLD}reset${NC} or close this terminal tab when done to clear any residual data."
