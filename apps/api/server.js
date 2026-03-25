/**
 * OnPoint API Server
 * 
 * Lightweight Express server for agent routes.
 * Runs on Hetzner VPS via PM2.
 * 
 * Ports: 48751 (API), 48752 (Bridge) - exotic to avoid conflicts
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');

// Initialize Express
const app = express();
app~/.cache/pnpm/up/736cc7c2d8ff7b70a972e8ac6dabf5c2270a79d55717da691ee42d3bfa49a4e4(d8({ origin: 'https://onpoint-web-647723858538.us-central1.run.app' })); // Allow Vercel frontend
app.use(express.json());

// Initialize Redis (use existing localhost instance)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.json({ 
      status: 'healthy',
      redis: 'connected',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Import route handlers from apps/web (reuse existing logic!)
// We'll create thin wrappers that call the same middleware
const suggestionRoute = require('./routes/suggestion');
const purchaseRoute = require('./routes/purchase');
const approvalRoute = require('./routes/approval');
const catalogRoute = require('./routes/catalog');
const styleRoute = require('./routes/style');
const tipRoute = require('./routes/tip');

// Mount routes
app.use('/api/agent/suggestion', suggestionRoute);
app.use('/api/agent/purchase', purchaseRoute);
app.use('/api/agent/approval', approvalRoute);
app.use('/api/agent/catalog', catalogRoute);
app.use('/api/agent/style', styleRoute);
app.use('/api/agent/tip', tipRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 48751;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OnPoint API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

module.exports = app;
