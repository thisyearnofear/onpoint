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
app.use(cors({
  origin: [
    'https://beonpoint.netlify.app',
    'https://onpoint-web-647723858538.us-central1.run.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
}));
app.use(express.json({ limit: '10mb' }));

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

// Start server
const PORT = process.env.PORT || 48751;

// Simple API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'onpoint-api',
    version: '1.0.0',
    status: 'running',
    port: PORT
  });
});

// AI routes
app.use('/api/ai/virtual-tryon', require('./routes/ai-virtual-tryon'));
app.use('/api/ai/analyze-person', require('./routes/ai-analyze-person'));

// Catch-all for agent routes (return 200 OK)
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
});

module.exports = app;
