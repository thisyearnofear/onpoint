# Configuring Frontend to Use Hetzner Backend

## Overview

Your OnPoint frontend can now use either:
1. **Vercel Serverless** (default) - API routes run on Vercel
2. **Hetzner Backend** (recommended for production) - API routes run on your Hetzner VPS

## Quick Setup

### Option 1: Use Hetzner Backend (Recommended)

Add this to your `.env.local` file:

```bash
NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz
```

### Option 2: Keep Using Vercel Serverless

Do nothing - the default behavior uses Vercel serverless functions.

---

## Detailed Configuration

### Step 1: Update Environment Variables

Copy the example and configure:

```bash
cd apps/web
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Agent API Backend Configuration
# Leave empty to use Vercel (default)
# Set to Hetzner URL for better performance
NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz
```

### Step 2: Deploy Frontend Changes

The updated components automatically use the new backend:

- `AgentSuggestionToast.tsx` - Agent suggestions
- `AgentApprovalModal.tsx` - Approval requests  
- `TipModal.tsx` - Tip confirmations

All fetch calls now route through the configured backend.

### Step 3: Test the Connection

From your local machine:

```bash
# Test HTTPS endpoint
curl https://api.onpoint.famile.xyz/health

# Expected response:
# {"status":"healthy","redis":"connected","timestamp":...}
```

### Step 4: Deploy to Production

Commit and push your changes:

```bash
git add apps/web/.env.local
git commit -m "config: enable Hetzner backend for agent API"
git push
vercel --prod
```

---

## Architecture

### With Hetzner Backend Enabled

```
┌─────────────────┐
│   Vercel        │
│   Frontend      │
│   (React/Next)  │
└────────┬────────┘
         │ HTTPS
         │
         ▼
┌─────────────────┐
│   Nginx         │
│   (Hetzner)     │
│   SSL/TLS       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Express API   │
│   Port 48751    │
│   (PM2)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Redis         │
│   localhost     │
└─────────────────┘
```

### Without Hetzner Backend (Default)

```
┌─────────────────┐
│   Vercel        │
│   Frontend +    │
│   Serverless    │
│   Functions     │
└─────────────────┘
```

---

## Benefits of Hetzner Backend

| Metric | Vercel | Hetzner | Improvement |
|--------|--------|---------|-------------|
| **API Latency** | 200-500ms | 50-150ms | **3-4x faster** |
| **Redis Latency** | ~30ms | ~1ms | **30x faster** |
| **Monthly Cost** | $70-95 | $35-60 | **~$40 savings** |
| **Cold Starts** | Yes | No | Always warm |
| **Rate Limits** | Limited | Unlimited | Full control |

---

## Hybrid Approach

You can use a hybrid setup:

- **Critical paths** → Hetzner (purchases, approvals, suggestions)
- **AI-heavy tasks** → Vercel (virtual try-on, image analysis)
- **Static content** → Vercel Edge (fastest delivery)

This is automatic - just set `NEXT_PUBLIC_AGENT_API_URL` and the agent routes will use Hetzner while other routes stay on Vercel.

---

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Check that your domain is whitelisted in `/opt/onpoint/api/server.js`:
   ```javascript
   app.use(cors({ origin: 'https://your-frontend.vercel.app' }));
   ```

2. Restart PM2:
   ```bash
   ssh deploy@snel-bot "pm2 restart onpoint-api"
   ```

### Connection Timeout

If requests timeout:

1. Verify DNS is working:
   ```bash
   ping api.onpoint.famile.xyz
   # Should resolve to 157.180.36.156
   ```

2. Check nginx is running:
   ```bash
   ssh deploy@snel-bot "sudo systemctl status nginx"
   ```

3. Check PM2 processes:
   ```bash
   ssh deploy@snel-bot "pm2 list | grep onpoint"
   ```

### SSL Certificate Issues

If you get SSL errors:

1. Check certificate expiry:
   ```bash
   ssh deploy@snel-bot "sudo certbot certificates"
   ```

2. Renew if needed:
   ```bash
   ssh deploy@snel-bot "sudo certbot renew"
   ```

---

## Rollback

To switch back to Vercel serverless:

1. Remove or comment out the env variable:
   ```bash
   # NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz
   ```

2. Redeploy:
   ```bash
   vercel --prod
   ```

No code changes needed - the system automatically falls back to relative paths!

---

## Monitoring

Check API health anytime:

```bash
# Health check
curl https://api.onpoint.famile.xyz/health

# View PM2 logs
ssh deploy@snel-bot "pm2 logs onpoint-api --lines 50"

# Monitor in real-time
ssh deploy@snel-bot "pm2 monit"
```

---

## Next Steps

After configuring the backend:

1. ✅ Test all agent features (suggestions, approvals, tips)
2. ✅ Monitor performance improvements
3. ✅ Consider migrating more routes to Hetzner
4. ✅ Set up monitoring/alerting (optional)

For advanced configuration, see:
- `deploy/README.md` - Deployment guide
- `deploy/DEPLOYMENT_SUMMARY.md` - Complete status
- `DEPLOYMENT_QUICKSTART.md` - Quick reference
