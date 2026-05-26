#!/bin/bash
# deploy/deploy.sh — Server-side quick-deploy (fallback)
#
# PRIMARY DEPLOY: Run scripts/deploy-api.sh from your local machine.
# This script is a fallback for quick fixes directly on the server
# when you can't run the full local build+rsync pipeline.
#
# ⚠  IMPORTANT: Because apps/api is a SYMLINK to a release dir,
#    a plain `git pull` updates the git database but NOT the working
#    tree under the symlink. This script uses `git archive` to
#    correctly extract source files from the git tree.
#
# Usage (on server):
#   cd /opt/onpoint && ./deploy/deploy.sh
#
# Architecture:
#   apps/api -> releases/api/<timestamp>/  (symlink flipped atomically)
#   .env is set via PM2 env block (shared/api/.env is for reference)
#
# Note: The API now depends on workspace packages (@repo/agent-core,
# @onpoint/shared-types, @repo/blockchain-client). This script extracts
# the full monorepo from git and uses pnpm deploy --legacy to create a
# self-contained deployment with all dependencies resolved.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 OnPoint quick-deploy (server-side fallback)${NC}"
echo -e "${YELLOW}⚠  For routine deploys, use scripts/deploy-api.sh from your local machine.${NC}"

# Navigate to project root
cd /opt/onpoint

# Step 1: Pull latest
echo -e "${YELLOW}📦 Pulling latest changes...${NC}"
git pull origin master

# Step 2: Create timestamped release dir
TS=$(date +%Y%m%d-%H%M%S)
RELEASE="releases/api/$TS"
echo -e "${YELLOW}📁 Creating release: $RELEASE${NC}"
mkdir -p "$RELEASE"

# Step 3: Extract full monorepo from git (needed for pnpm workspace resolution).
#         git archive reads directly from the git object store.
echo -e "${YELLOW}📄 Extracting monorepo from git...${NC}"
git archive HEAD | tar -xC "$RELEASE"

# Step 4: Build workspace CJS packages and create deployment bundle.
#         pnpm deploy --legacy creates a self-contained dir with all
#         production dependencies resolved, including workspace:* protocol.
echo -e "${YELLOW}📦 Building workspace packages and creating deployment bundle...${NC}"
cd "$RELEASE"

# Build workspace CJS packages first
if command -v pnpm &>/dev/null && [ -f pnpm-lock.yaml ]; then
  echo "   Building workspace packages (CJS)..."
  pnpm --filter @repo/agent-core build 2>&1 || echo "   (agent-core build skipped)"
  pnpm --filter @onpoint/shared-types build 2>&1 || echo "   (shared-types build skipped)"
  pnpm --filter @repo/blockchain-client build 2>&1 || echo "   (blockchain-client build skipped)"

  # Create standalone deployment bundle
  echo "   Creating deployment bundle..."
  API_DEPLOY_DIR="${RELEASE}/api-deploy"
  pnpm deploy --legacy --filter @onpoint/api "${API_DEPLOY_DIR}" 2>&1 || {
    echo -e "${YELLOW}pnpm deploy failed, falling back to pnpm install --prod${NC}"
    # pnpm install --prod in the monorepo context also works
    pnpm install --prod --filter @onpoint/api --no-frozen-lockfile 2>&1
    API_DEPLOY_DIR="${RELEASE}"
  }

  # The deploy creates a standalone bundle; apps/api symlink should point here
  echo "   Deployment bundle created at ${API_DEPLOY_DIR}"
else
  echo -e "${RED}❌ pnpm not found or no pnpm-lock.yaml — cannot resolve workspace dependencies${NC}"
  echo "   Install pnpm and try again, or use scripts/deploy-api.sh from your local machine."
  exit 1
fi

# Step 5: Atomic symlink flip.
#         Point apps/api to the standalone deploy bundle (not the full monorepo).
echo -e "${YELLOW}🔗 Flipping symlink...${NC}"
cd /opt/onpoint

# If pnpm deploy succeeded, point to the standalone bundle
# Otherwise point to the full monorepo extraction
if [ -d "${API_DEPLOY_DIR:-}" ]; then
  ln -sfn "$API_DEPLOY_DIR" apps/api
else
  ln -sfn "$RELEASE" apps/api
fi

# Step 6: Reload PM2 (zero-downtime)
echo -e "${YELLOW}🔄 Reloading PM2...${NC}"
pm2 reload onpoint-api

# Step 7: Health check
echo -e "${YELLOW}🏥 Health check...${NC}"
sleep 2
if curl -sf http://localhost:48751/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed${NC}"
fi

# Step 8: Prune old releases (keep last 3)
echo -e "${YELLOW}🧹 Pruning old releases...${NC}"
ls -1t releases/api/ 2>/dev/null | tail -n +4 | while read -r old; do
  rm -rf "releases/api/$old"
  echo "   Removed: $old"
done

echo -e "${GREEN}✅ Done${NC}"
