/**
 * Status Dashboard Route — /api/status/dashboard
 *
 * Provides a human-readable dashboard for monitoring the agent's health.
 * Two modes:
 *   GET /api/status/dashboard.json  → JSON data (machine-readable)
 *   GET /api/status/dashboard       → HTML page (human-readable)
 *   GET /status-ui                  → Alias for HTML page
 *
 * Architecture (ADR 0001):
 *   This runs on Hetzner alongside the API. Later it can be served
 *   from a dedicated subdomain (status.onpoint.famile.xyz).
 */

const express = require('express');
const router = express.Router();
const Redis = require('ioredis');
const logger = require('../lib/logger');

// ── Helpers ──

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    await redis.quit();
    return { status: 'connected', latencyMs: latency };
  } catch (err) {
    await redis.quit().catch(() => {});
    return { status: 'disconnected', error: err.message };
  }
}

async function checkBridge() {
  const bridgeUrl = process.env.BRIDGE_URL || 'http://localhost:48752';
  try {
    const start = Date.now();
    const response = await fetch(`${bridgeUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    return { status: response.ok ? 'connected' : 'error', latencyMs: latency };
  } catch (err) {
    return { status: 'disconnected', error: err.message };
  }
}

async function checkWorker() {
  const workerPort = process.env.WORKER_PORT || 48754;
  try {
    const response = await fetch(`http://localhost:${workerPort}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { status: 'error', detail: `HTTP ${response.status}` };
    return await response.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

async function checkHeartbeat() {
  const apiUrl = `http://localhost:${process.env.PORT || 48751}`;
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) return { status: 'unavailable', note: 'SERVICE_API_KEY not configured' };

  try {
    const response = await fetch(`${apiUrl}/api/agent/heartbeat`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: 'error', detail: `HTTP ${response.status}` };
    return await response.json();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// ── JSON Endpoint ──

router.get('/dashboard.json', async (req, res) => {
  try {
    const apiStart = Date.now();

    const [redis, bridge, heartbeat, worker] = await Promise.all([
      checkRedis().catch(() => ({ status: 'error', error: 'check failed' })),
      checkBridge().catch(() => ({ status: 'error', error: 'check failed' })),
      checkHeartbeat().catch(() => ({ status: 'error', error: 'check failed' })),
      checkWorker().catch(() => ({ status: 'offline', error: 'check failed' })),
    ]);

    const responseTime = Date.now() - apiStart;

    const data = {
      service: 'onpoint-api',
      version: process.env.npm_package_version || '2.1.0',
      uptime: process.uptime(),
      responseTimeMs: responseTime,
      timestamp: Date.now(),
      infrastructure: {
        redis,
        bridge,
        worker,
      },
      agent: {
        heartbeat,
        walletConfigured: !!process.env.AGENT_WALLET_ADDRESS,
        veniceConfigured: !!process.env.VENICE_API_KEY,
        geminiConfigured: !!process.env.GOOGLE_GEMINI_API_KEY,
        serviceKeyConfigured: !!process.env.SERVICE_API_KEY,
        sentryConfigured: !!process.env.SENTRY_DSN,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        vercelDomain: process.env.VERCEL_DOMAIN || '(not set)',
      },
    };

    res.json(data);
  } catch (err) {
    logger.error('Status dashboard error', { component: 'status' }, err);
    res.status(500).json({ error: 'Status check failed', detail: err.message });
  }
});

// ── HTML Dashboard Page ──

router.get('/dashboard', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboardHTML());
});

// ── HTML renderer ──

function renderDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OnPoint Agent Status</title>
  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --blue: #58a6ff;
      --radius: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      min-height: 100vh;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 24px;
    }
    .grid {
      display: grid;
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-badge.connected, .status-badge.healthy { background: #0d3a1e; color: var(--green); }
    .status-badge.warning { background: #3d2e00; color: var(--yellow); }
    .status-badge.disconnected, .status-badge.error, .status-badge.offline { background: #3d0d14; color: var(--red); }
    .status-badge.pending { background: #0d2d4d; color: var(--blue); }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
      border-bottom: 1px solid var(--border);
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: var(--muted); }
    .stat-value { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; }
    .stat-value.green { color: var(--green); }
    .stat-value.yellow { color: var(--yellow); }
    .stat-value.red { color: var(--red); }

    .latency-bar {
      display: inline-block;
      height: 6px;
      border-radius: 3px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .latency-bar.fast { width: 16px; background: var(--green); }
    .latency-bar.medium { width: 32px; background: var(--yellow); }
    .latency-bar.slow { width: 48px; background: var(--red); }

    .tasks-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .task-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: rgba(88, 166, 255, 0.1);
      color: var(--blue);
      border: 1px solid rgba(88, 166, 255, 0.2);
    }
    .footer {
      text-align: center;
      color: var(--muted);
      font-size: 12px;
      padding: 16px 0;
    }
    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .loading { opacity: 0.5; transition: opacity 0.3s; }
    .error-message { color: var(--red); font-size: 12px; margin-top: 4px; }

    @media (min-width: 640px) {
      .grid { grid-template-columns: 1fr 1fr; }
      .grid .full { grid-column: 1 / -1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span>🛡️ OnPoint Agent Status</span>
      <span class="live-indicator"><span class="live-dot"></span> live</span>
    </h1>
    <div class="subtitle">Deployment: <span id="version">—</span> · Updating every 15s</div>

    <div class="grid" id="grid">
      <!-- Populated by JavaScript -->
    </div>

    <div class="footer">
      <span id="last-updated">Loading...</span>
    </div>
  </div>

  <script>
    async function fetchStatus() {
      const grid = document.getElementById('grid');
      grid.classList.add('loading');

      try {
        const resp = await fetch('/api/status/dashboard.json');
        const data = await resp.json();
        renderGrid(data);
        document.getElementById('version').textContent = data.version;
        document.getElementById('last-updated').textContent =
          'Last updated: ' + new Date(data.timestamp).toLocaleTimeString();
        grid.classList.remove('loading');
      } catch (err) {
        grid.innerHTML = '<div class="card full" style="text-align:center;padding:32px"><p style="color:var(--red)">Failed to load status</p><p style="font-size:12px;color:var(--muted);margin-top:8px">' + escapeHtml(err.message) + '</p></div>';
        grid.classList.remove('loading');
      }
    }

    function renderGrid(data) {
      const grid = document.getElementById('grid');
      const { infrastructure, agent } = data;

      grid.innerHTML = [
        renderCard('API Server', [
          { label: 'Status', value: 'healthy', cls: 'green' },
          { label: 'Uptime', value: formatUptime(data.uptime) },
          { label: 'Response', value: data.responseTimeMs + 'ms' },
          { label: 'Environment', value: data.environment.nodeEnv },
        ], 'healthy'),

        renderCard('Redis', [
          { label: 'Status', value: infrastructure.redis.status, cls: infrastructure.redis.latencyMs !== undefined ? (infrastructure.redis.latencyMs < 5 ? 'green' : 'yellow') : 'red' },
          { label: 'Latency', value: infrastructure.redis.latencyMs !== undefined ? infrastructure.redis.latencyMs + 'ms' : '—' },
        ], infrastructure.redis.status, infrastructure.redis.error),

        renderCard('Bridge', [
          { label: 'Status', value: infrastructure.bridge.status, cls: infrastructure.bridge.status === 'connected' ? 'green' : 'red' },
          { label: 'Latency', value: infrastructure.bridge.latencyMs !== undefined ? infrastructure.bridge.latencyMs + 'ms' : '—' },
        ], infrastructure.bridge.status, infrastructure.bridge.error),

        renderCard('Worker', [
          { label: 'Status', value: infrastructure.worker.status, cls: infrastructure.worker.status === 'running' ? 'green' : 'red' },
          { label: 'PID', value: infrastructure.worker.pid || '—' },
          { label: 'Worker Uptime', value: infrastructure.worker.uptime ? formatUptime(infrastructure.worker.uptime) : '—' },
          { label: 'Heartbeat Last Run', value: infrastructure.worker.heartbeat?.lastRun ? new Date(infrastructure.worker.heartbeat.lastRun).toLocaleTimeString() : '—' },
          { label: 'Heartbeat Status', value: infrastructure.worker.heartbeat?.lastStatus || '—', cls: infrastructure.worker.heartbeat?.lastSuccess ? 'green' : (infrastructure.worker.heartbeat?.lastStatus === 'pending' ? '' : 'yellow') },
        ], infrastructure.worker.status, infrastructure.worker.error),

        renderCard('Agent Config', [
          { label: 'Wallet', value: agent.walletConfigured ? '✅ Configured' : '❌ Not set', cls: agent.walletConfigured ? 'green' : 'red' },
          { label: 'Venice AI', value: agent.veniceConfigured ? '✅ Configured' : '❌ Not set', cls: agent.veniceConfigured ? 'green' : 'red' },
          { label: 'Gemini', value: agent.geminiConfigured ? '✅ Configured' : '❌ Not set', cls: agent.geminiConfigured ? 'green' : 'red' },
          { label: 'Service Key', value: agent.serviceKeyConfigured ? '✅ Configured' : '❌ Not set', cls: agent.serviceKeyConfigured ? 'green' : 'red' },
          { label: 'Sentry', value: agent.sentryConfigured ? '✅ Configured' : '❌ Not set', cls: agent.sentryConfigured ? 'green' : 'red' },
        ], '—'),

        renderCard('Public Heartbeat', [
          { label: 'Status', value: agent.heartbeat?.status || 'unavailable', cls: agent.heartbeat?.status === 'healthy' ? 'green' : (agent.heartbeat?.status === 'unavailable' ? '' : 'yellow') },
          { label: 'Venice', value: agent.heartbeat?.agent?.veniceConfigured ? '✅' : '❌' },
          { label: 'Wallet', value: agent.heartbeat?.agent?.walletConfigured ? '✅' : '❌' },
        ].concat(agent.heartbeat?.infrastructure ? [
          { label: 'Redis (public)', value: agent.heartbeat.infrastructure.redis || '—' },
          { label: 'Bridge (public)', value: agent.heartbeat.infrastructure.bridge || '—' },
        ] : []), agent.heartbeat?.status || 'unavailable'),
      ].join('');
    }

    function renderCard(title, stats, badgeStatus, error) {
      const badgeLabel = badgeStatus || '—';
      const badgeCls = badgeStatus === 'connected' || badgeStatus === 'healthy' || badgeStatus === 'running' ? 'connected'
        : badgeStatus === 'warning' || badgeStatus === 'pending' ? 'warning'
        : badgeStatus === 'disconnected' || badgeStatus === 'error' || badgeStatus === 'offline' ? 'error'
        : '';

      return '<div class="card' + (title === 'API Server' ? ' full' : '') + '">' +
        '<div class="card-header">' +
        '<span class="card-title">' + escapeHtml(title) + '</span>' +
        '<span class="status-badge ' + escapeHtml(badgeCls) + '">● ' + escapeHtml(badgeLabel) + '</span>' +
        '</div>' +
        stats.map(s => '<div class="stat-row">' +
          '<span class="stat-label">' + escapeHtml(s.label) + '</span>' +
          '<span class="stat-value' + (s.cls ? ' ' + escapeHtml(s.cls) : '') + '">' + escapeHtml(s.value || '—') + '</span>' +
          '</div>'
        ).join('') +
        (error ? '<div class="error-message">' + escapeHtml(typeof error === 'string' ? error : JSON.stringify(error)) + '</div>' : '') +
        '</div>';
    }

    function formatUptime(seconds) {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const parts = [];
      if (d > 0) parts.push(d + 'd');
      if (h > 0) parts.push(h + 'h');
      if (m > 0) parts.push(m + 'm');
      parts.push(s + 's');
      return parts.join(' ');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Initial load + poll every 15s
    fetchStatus();
    setInterval(fetchStatus, 15000);
  </script>
</body>
</html>`;
}

module.exports = router;
