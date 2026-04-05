#!/bin/bash
# Deploy OnPoint API to Hetzner VPS

set -e

echo "🚀 Deploying OnPoint API to Hetzner..."

# SSH into server and deploy
ssh snel-bot << 'ENDSSH'
  cd /opt/onpoint/api
  
  echo "📥 Pulling latest changes..."
  git pull
  
  echo "📦 Installing dependencies..."
  pnpm install --prod
  
  echo "🔄 Restarting PM2 process..."
  pm2 restart onpoint-api
  
  echo "✅ Deployment complete!"
  
  echo ""
  echo "📊 Process status:"
  pm2 list | grep onpoint
  
  echo ""
  echo "📝 Recent logs:"
  pm2 logs onpoint-api --lines 10 --nostream
ENDSSH

echo ""
echo "✨ API deployed successfully!"
echo "🔗 Health check: https://api.onpoint.famile.xyz/health"
