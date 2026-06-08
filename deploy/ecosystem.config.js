/**
 * PM2 Ecosystem Configuration for OnPoint
 * 
 * Deploy to Hetzner VPS with:
 *   pm2 start deploy/ecosystem.config.js
 * 
 * Ports: 48751 (API) — exotic to avoid conflicts
 * 
 * Symlink-based releases:
 *   apps/api -> releases/api/<timestamp>/   (flipped atomically by deploy-api.sh)
 * 
 * Environment variables are passed via the env block below.
 * For secrets, set values in shared/api/.env on the server.
 * The .env is NEVER rsynced — it lives outside the release tree.
 */

module.exports = {
  apps: [
    {
      name: 'onpoint-api',
      cwd: '/opt/onpoint',
      script: 'apps/api/server.js',     // resolves through symlink
      instances: 2,                      // Use both CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 48751,
        REDIS_URL: 'redis://localhost:6379',
        BRIDGE_URL: 'http://localhost:48752',
        VERCEL_DOMAIN: '',               // e.g., https://onpoint.vercel.app
        SERVICE_API_KEY: '',             // Service-to-service auth key
        VENICE_API_KEY: '',              // Venice AI API key
        AGENT_WALLET_ADDRESS: '',        // Agent wallet for gas checks
        PREMIUM_USERS: '',               // Comma-separated list
      },
      error_file: '/var/log/pm2/onpoint-api-error.log',
      out_file: '/var/log/pm2/onpoint-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'onpoint-worker',
      cwd: '/opt/onpoint',
      script: 'apps/api/worker.js',     // Heartbeat cron loop (Phase 1)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        WORKER_PORT: 48754,
        API_URL: 'http://localhost:48751',
        REDIS_URL: 'redis://localhost:6379',
        HEARTBEAT_INTERVAL: '*/5 * * * *',
        SERVICE_API_KEY: '',             // Must match onpoint-api's value
        SENTRY_DSN: '',                  // Shared Sentry DSN
        SENTRY_RELEASE: '',              // Set by deploy script
      },
      error_file: '/var/log/pm2/onpoint-worker-error.log',
      out_file: '/var/log/pm2/onpoint-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'onpoint-agent-server',
      cwd: '/opt/onpoint',
      script: 'apps/api/agent-server.js', // Meta webhook + Spectrum-ts agent (Phase 11)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        AGENT_PORT: 48753,
        STORE_URL: 'https://onpoint.famile.xyz',
        NEON_DATABASE_URL: '',           // Set in shared/.env
        WA_ACCESS_TOKEN: '',             // Set in shared/.env
        WA_PHONE_NUMBER_ID: '',          // Set in shared/.env
        WA_APP_SECRET: '',               // Set in shared/.env
        R2_ACCOUNT_ID: '',               // Set in shared/.env
        R2_ACCESS_KEY_ID: '',            // Set in shared/.env
        R2_SECRET_ACCESS_KEY: '',        // Set in shared/.env
        R2_BUCKET_NAME: '',              // Set in shared/.env
        SERVICE_API_KEY: '',             // Must match onpoint-api's value
      },
      error_file: '/var/log/pm2/onpoint-agent-server-error.log',
      out_file: '/var/log/pm2/onpoint-agent-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'onpoint-signer',
      cwd: '/opt/onpoint',
      script: 'apps/api/signer.js',      // Isolated signer (ADR 0001 Phase 4)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SIGNER_PORT: 48753,
        REDIS_URL: 'redis://localhost:6379',
        SIGNER_API_KEY: '',              // Set in shared/.env (must match onpoint-api)
        AGENT_PRIVATE_KEY: '',           // Set in shared/.env — sole holder
        SENTRY_DSN: '',                  // Shared Sentry DSN
        SENTRY_RELEASE: '',              // Set by deploy script
      },
      error_file: '/var/log/pm2/onpoint-signer-error.log',
      out_file: '/var/log/pm2/onpoint-signer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ]
};
