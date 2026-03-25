/**
 * PM2 Ecosystem Configuration for OnPoint
 * 
 * Deploy to Hetzner VPS with:
 *   pm2 start deploy/ecosystem.config.js
 * 
 * Ports: 48751 (API), 48752 (Bridge) - exotic to avoid conflicts
 */

module.exports = {
  apps: [
    {
      name: 'onpoint-api',
      cwd: '/opt/onpoint/apps/api',
      script: 'node',
      args: 'server.js',
      instances: 2, // Use both CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 48751,
        REDIS_URL: 'redis://localhost:6379',
        BRIDGE_URL: 'http://localhost:48752',
        // Auth config
        PREMIUM_USERS: '', // Comma-separated list
      },
      error_file: '/var/log/pm2/onpoint-api-error.log',
      out_file: '/var/log/pm2/onpoint-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'onpoint-bridge',
      cwd: '/opt/onpoint/packages/agent-web-bridge',
      script: '/opt/onpoint/packages/agent-web-bridge/venv/bin/python',
      args: 'main.py',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        BROWSER_USE_API_KEY: process.env.BROWSER_USE_API_KEY,
        PURCH_API_URL: 'https://api.purch.xyz',
        HOST: '0.0.0.0',
        PORT: '48752',
      },
      error_file: '/var/log/pm2/onpoint-bridge-error.log',
      out_file: '/var/log/pm2/onpoint-bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }
  ]
};
