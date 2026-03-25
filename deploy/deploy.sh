#!/bin/bash
# OnPoint Deployment Script for Hetzner VPS
# 
# Usage: ./deploy/deploy.sh
#
# This script:
# 1. Pulls latest changes from git
# 2. Installs dependencies
# 3. Restarts PM2 processes
# 4. Shows status

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting OnPoint deployment...${NC}"

# Navigate to app directory
cd /opt/onpoint

# Pull latest changes
echo -e "${YELLOW}📦 Pulling latest changes from git...${NC}"
git pull origin master

# Install API dependencies
echo -e "${YELLOW}📦 Installing API dependencies...${NC}"
cd /opt/onpoint/apps/api
npm install --production

# Install Bridge dependencies (if updated)
echo -e "${YELLOW}📦 Checking bridge dependencies...${NC}"
cd /opt/onpoint/packages/agent-web-bridge
if [ -f requirements.txt ]; then
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
fi

# Restart PM2 processes
echo -e "${YELLOW}🔄 Restarting PM2 processes...${NC}"
cd /opt/onpoint
pm2 restart onpoint-api
pm2 restart onpoint-bridge

# Wait for services to start
sleep 3

# Check status
echo -e "${GREEN}✅ Checking service status...${NC}"
pm2 list | grep -E "onpoint-(api|bridge)"

# Test health endpoint
echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
curl -s http://localhost:48751/health | jq '.' || echo "Health check failed"

echo -e "${GREEN}✨ Deployment complete!${NC}"
echo -e "${YELLOW}📊 Monitor with: pm2 monit${NC}"
echo -e "${YELLOW}📄 View logs with: pm2 logs${NC}"
