/**
 * OnPoint API Server
 * 
 * Consolidated backend for all AI and agent routes.
 * Runs on Hetzner VPS via PM2.
 * 
 * Ports: 48751 (API), 48752 (Bridge)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');

// Initialize Express
const app = express();
// CORS is handled by nginx proxy, don't add headers here to avoid duplicates

// Per-route body parsing with size limits.
// Health + status routes: 1KB (GET only, but safety-net)
// AI routes (images/base64): 10MB
// No global parser — each route group controls its own memory ceiling.
const json1k = express.json({ limit: '1kb' });
const json10mb = express.json({ limit: '10mb' });

// Initialize Redis (use existing localhost instance)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Middleware
const { createRateLimiter } = require('./middleware/rate-limit');
const { createApiKeyAuth } = require('./middleware/api-key-auth');

const veniceRateLimit = createRateLimiter(redis, 'veniceFree');
const veniceBurstLimit = createRateLimiter(redis, 'veniceBurst');
const liveSessionRateLimit = createRateLimiter(redis, 'liveSession');
const apiKeyAuth = createApiKeyAuth();

// Health check endpoint (1KB body limit — no payloads needed)
app.get('/health', json1k, async (req, res) => {
  try {
    await redis.ping();
    res.json({ 
      status: 'healthy',
      redis: 'connected',
      venice: !!process.env.VENICE_API_KEY,
      gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Start server
const PORT = process.env.PORT || 48751;

// Simple API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'onpoint-api',
    version: '2.0.0',
    status: 'running',
    port: PORT,
    features: ['venice-vision', 'gemini-live', 'virtual-tryon']
  });
});

// AI routes - consolidated (with body size limits + rate limiting + API key auth)
app.use('/api/ai/virtual-tryon', json10mb, apiKeyAuth, veniceRateLimit, veniceBurstLimit, require('./routes/ai-virtual-tryon'));
app.use('/api/ai/analyze-person', json10mb, apiKeyAuth, veniceRateLimit, veniceBurstLimit, require('./routes/ai-analyze-person'));
app.use('/api/ai/venice-analyze', json10mb, apiKeyAuth, veniceRateLimit, veniceBurstLimit, require('./routes/ai-venice-analyze'));
app.use('/api/ai/live-session', json1k, apiKeyAuth, liveSessionRateLimit, require('./routes/ai-live-session'));

// Agent routes (placeholder for future migration)
app.use('/api/agent/:route', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: `Route ${req.params.route} available`,
    note: 'Full implementation via Vercel or upcoming migration'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OnPoint API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Features: Venice Vision, Gemini Live, Virtual Try-On`);
});

module.exports = app;
