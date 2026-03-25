# OnPoint Deployment Guide - Hetzner VPS

## Overview

This guide covers deploying OnPoint API routes to your existing Hetzner VPS using PM2 and git-based deployment.

**Architecture:**
- **Frontend:** Vercel (Next.js app)
- **Backend API:** Hetzner VPS (Express server on port 48751)
- **Bridge:** Hetzner VPS (Python FastAPI on port 48752)
- **Cache:** Existing Redis on localhost:6379

---

## Prerequisites

Your Hetzner VPS should have:
- ✅ Ubuntu 24.04
- ✅ Node.js v22+ (`node --version`)
- ✅ Python 3.10+ with venv
- ✅ PM2 installed globally (`pm2 --version`)
- ✅ Redis running on localhost:6379
- ✅ Git installed

---

## Initial Setup (One-Time, ~30 minutes)

### Step 1: Clone Repository on VPS

```bash
ssh deploy@snel-bot

# Create directory
sudo mkdir -p /opt/onpoint
sudo chown deploy:deploy /opt/onpoint
cd /opt/onpoint

# Clone repository
git clone https://github.com/thisyearnofear/onpoint.git .
```

### Step 2: Set Up Environment Variables

```bash
# API environment
cd /opt/onpoint/apps/api
cp .env.example .env.production

# Edit with your values
nano .env.production
```

**`.env.production` contents:**
```env
REDIS_URL=redis://localhost:6379
BRIDGE_URL=http://localhost:48752
PORT=48751
NODE_ENV=production
PREMIUM_USERS=your-user-id-here
```

```bash
# Bridge environment
cd /opt/onpoint/packages/agent-web-bridge
cp .env.example .env

# Edit with your API keys
nano .env
```

**`.env` contents:**
```env
BROWSER_USE_API_KEY=bu_Uj2qzxJDVOByle9EG1rnMMHsTdOYXC-M7R1MGg-vjz8
PURCH_API_URL=https://api.purch.xyz
HOST=0.0.0.0
PORT=48752
```

### Step 3: Install Dependencies

```bash
# API dependencies
cd /opt/onpoint/apps/api
npm install --production

# Bridge dependencies
cd /opt/onpoint/packages/agent-web-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### Step 4: Start Services with PM2

```bash
cd /opt/onpoint

# Start both services
pm2 start deploy/ecosystem.config.js

# Save PM2 configuration (auto-restart on reboot)
pm2 save

# Set PM2 to startup on boot
pm2 startup
# Copy the command it outputs and run it
```

### Step 5: Verify Deployment

```bash
# Check status
pm2 list

# Should show:
# ┌────┬─────────────────┬──────────┬─────────┬──────────┐
# │ id │ name            │ status   │ cpu     │ mem      │
# ├────┼─────────────────┼──────────┼─────────┼──────────┤
# │ 20 │ onpoint-api     │ online   │ 0%      │ 150mb    │
# │ 21 │ onpoint-bridge  │ online   │ 0%      │ 80mb     │
# └────┴─────────────────┴──────────┴─────────┴──────────┘

# Test health endpoint
curl http://localhost:48751/health

# Expected response:
# {"status":"healthy","redis":"connected","timestamp":...}

# Test catalog search
curl "http://localhost:48751/api/agent/catalog?query=jacket&limit=3"

# Test bridge health
curl http://localhost:48752/health
```

### Step 6: Update Vercel App

Update your Next.js app's environment variable:

```bash
# In your local dev environment
cd apps/web
cp .env.local .env.local.backup

# Edit .env.local
EXTERNAL_AGENT_URL=https://api.yourdomain.com
# OR if using direct IP:
EXTERNAL_AGENT_URL=http://your-hetzner-ip:48751

# Commit and push to trigger Vercel deploy
git add .env.local
git commit -m "chore: point to production API"
git push
```

---

## Routine Deployment (Every Time You Want to Update)

### Option A: Automated Script (Recommended)

```bash
ssh deploy@snel-bot
cd /opt/onpoint
./deploy/deploy.sh
```

That's it! The script will:
1. Pull latest changes
2. Install dependencies
3. Restart PM2 processes
4. Show status

### Option B: Manual Steps

```bash
ssh deploy@snel-bot

cd /opt/onpoint

# Pull changes
git pull origin master

# Restart services
pm2 restart onpoint-api
pm2 restart onpoint-bridge

# Monitor logs
pm2 logs --lines 50
```

---

## Monitoring & Maintenance

### Real-Time Monitoring

```bash
# CPU/Memory monitoring
pm2 monit

# View all logs
pm2 logs

# Filter by service
pm2 logs onpoint-api
pm2 logs onpoint-bridge
```

### Health Checks

```bash
# API health
curl http://localhost:48751/health

# Bridge health
curl http://localhost:48752/health

# Redis connection
redis-cli ping
# Should return: PONG
```

### Log Rotation

PM2-logrotate is already installed. Configure in `~/.pm2/module_conf.json`:

```json
{
  "max_size": "10M",
  "retain": "7",
  "compress": true
}
```

### Backup Strategy

```bash
# Backup environment files
tar -czf onpoint-env-backup-$(date +%Y%m%d).tar.gz \
  /opt/onpoint/apps/api/.env.production \
  /opt/onpoint/packages/agent-web-bridge/.env

# Store securely (e.g., AWS S3, Backblaze)
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check PM2 logs
pm2 logs onpoint-api --err

# Common issues:
# 1. Port already in use
lsof -i :48751

# 2. Missing dependencies
cd /opt/onpoint/apps/api && npm install

# 3. Environment variables missing
cat /opt/onpoint/apps/api/.env.production
```

### High Memory Usage

```bash
# Monitor memory
pm2 monit

# If >400MB, reduce instances
# Edit deploy/ecosystem.config.js:
#   instances: 1  # Change from 2 to 1

pm2 reload onpoint-api
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# If not responding:
sudo systemctl status redis
sudo systemctl restart redis

# Verify connection string in .env.production
REDIS_URL=redis://localhost:6379
```

### Rollback to Previous Version

```bash
cd /opt/onpoint

# Find previous good commit
git log --oneline -10

# Checkout that commit
git checkout abc1234

# Restart services
pm2 restart all

# Deploy as normal when ready
git checkout master
./deploy/deploy.sh
```

---

## Security Best Practices

### 1. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (for SSL termination)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 48751        # API - internal only
sudo ufw deny 48752        # Bridge - internal only
sudo ufw enable
```

### 2. Environment Variable Security

```bash
# Restrict access to .env files
chmod 600 /opt/onpoint/apps/api/.env.production
chmod 600 /opt/onpoint/packages/agent-web-bridge/.env
chown deploy:deploy /opt/onpoint/apps/api/.env.production
```

### 3. Regular Updates

```bash
# Weekly security updates
sudo apt update && sudo apt upgrade -y

# Monthly dependency updates
cd /opt/onpoint/apps/api && npm update
cd /opt/onpoint/packages/agent-web-bridge && pip install --upgrade -r requirements.txt
```

### 4. Monitoring Suspicious Activity

```bash
# Check failed login attempts
sudo grep "Failed password" /var/log/auth.log | tail -20

# Monitor PM2 for crashes
pm2 logs --err | grep -i "error\|exception"
```

---

## Performance Optimization

### Enable Gzip Compression

Add to your reverse proxy (Nginx/Caddy):

```nginx
gzip on;
gzip_types application/json text/plain;
gzip_min_length 1000;
```

### Cache Static Responses

In your Express app, add Redis caching:

```javascript
// Example: cache catalog searches for 1 hour
const cached = await redis.get(`catalog:${query}`);
if (cached) return JSON.parse(cached);

// ...fetch results...

await redis.setex(`catalog:${query}`, 3600, JSON.stringify(results));
```

### Database Optimization (Future)

When you add PostgreSQL:
- Run on same VPS (localhost = fast)
- Use connection pooling
- Add indexes on frequently queried columns

---

## Cost Breakdown

| Resource | Current | After Migration | Savings |
|----------|---------|-----------------|---------|
| Vercel (API routes) | ~$20/mo | $0 | $20/mo |
| Upstash Redis | ~$10/mo | $0 (use existing) | $10/mo |
| Cloud Run (Bridge) | ~$5-30/mo | $0 | $5-30/mo |
| Hetzner VPS | Already owned | Already owned | $0 |
| **Total** | **$35-60/mo** | **$0** | **$35-60/mo** |

**Annual savings: $420-720**

---

## Next Steps

1. ✅ Review this guide
2. ✅ Run initial setup (30 min)
3. ✅ Test with small traffic (10-100 requests)
4. ✅ Monitor for 24 hours
5. ✅ Switch production traffic
6. ✅ Celebrate! 🎉

---

## Support

If you encounter issues:
1. Check logs: `pm2 logs`
2. Review troubleshooting section above
3. Check server resources: `htop`, `df -h`, `free -h`
4. Verify Redis: `redis-cli ping`

**Emergency rollback:** Just update `EXTERNAL_AGENT_URL` in Vercel back to old URL.
