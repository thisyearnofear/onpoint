# OnPoint Deployment Guide

## Overview

This guide covers deploying OnPoint API services to a production backend.

## Architecture

```
┌─────────────────┐
│   Vercel        │
│   Frontend      │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   API Backend   │
│   (Nginx+SSL)   │
└────────┬────────┘
         ▼
┌─────────────────┐
│   Express API   │
│   (PM2 Cluster) │
└────────┬────────┘
         ▼
┌─────────────────┐
│   Redis Cache   │
└─────────────────┘
```

## Quick Start

### Prerequisites

- Ubuntu 24.04 server with sudo access
- Nginx installed and running
- Node.js 20+ and PM2
- Python 3.10+ (for bridge service)
- Redis server
- Domain with DNS A record pointing to server IP

### Step 1: Clone Repository

```bash
cd /opt
sudo mkdir -p onpoint && sudo chown $USER:$USER onpoint
cd onpoint
# Pull from your repository
```

### Step 2: Install API Dependencies

```bash
cd apps/api
npm install --production
cp .env.example .env.production
# Edit .env.production with your configuration
```

### Step 3: Configure Environment

Required variables in `.env.production`:

```bash
REDIS_URL=redis://localhost:6379
PORT=48751
NODE_ENV=production
```

### Step 4: Start with PM2

```bash
cd /opt/onpoint
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup
```

### Step 5: Configure Nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/api.yourdomain.com
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 6: Enable SSL

```bash
sudo certbot --nginx -d api.yourdomain.com --non-interactive --agree-tos --email your@email.com
```

## Testing

```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"healthy","redis":"connected",...}
```

## Monitoring

```bash
# View logs
pm2 logs onpoint-api --lines 50

# Monitor processes
pm2 monit

# Check status
pm2 list
```

## Troubleshooting

### API Not Starting

```bash
# Check syntax
cd /opt/onpoint/api && node -c server.js

# View error logs
pm2 logs onpoint-api --err
```

### Redis Connection Issues

```bash
# Test connection
redis-cli ping

# Restart if needed
sudo systemctl restart redis
```

### SSL Certificate Problems

```bash
# Check certificates
sudo certbot certificates

# Renew if expired
sudo certbot renew
```

## Security Best Practices

1. **Use firewall rules** - Only expose necessary ports (80, 443)
2. **Keep system updated** - `sudo apt update && sudo apt upgrade -y`
3. **Monitor logs** - Set up log rotation and monitoring
4. **Use environment variables** - Never commit secrets
5. **Regular backups** - Backup configs and data regularly
6. **SSH key authentication** - Disable password auth on server

## Rollback

If issues arise:

```bash
# Stop services
pm2 stop all

# Traffic fails over to Vercel automatically
# No downtime expected
```

## Support

For detailed internal documentation, check the server at `/opt/onpoint/deploy/`

---

**Version:** 1.0  
**Last Updated:** March 2026
