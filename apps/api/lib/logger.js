/**
 * Structured Logger for Express API Server
 *
 * Mirrors the Next.js logger.ts format. In production emits JSON to stdout
 * so PM2 / docker logs can aggregate. In dev emits colored console output.
 */

const isDev = process.env.NODE_ENV !== 'production';

function log(level, message, context = {}, error = null) {
  const entry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    error: error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error ? { message: String(error) } : undefined,
  };

  if (isDev) {
    const prefix = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(`${prefix} [${context.component || 'api'}] ${message}`, context, error ? error.message || error : '');
  } else {
    // Production: structured JSON to stdout (PM2 / k8s log aggregation)
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(JSON.stringify(entry));
  }

  return entry;
}

module.exports = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context, error) => log('warn', message, context, error),
  error: (message, context, error) => log('error', message, context, error),

  // Domain-specific helpers
  veniceError: (action, message, error, meta = {}) =>
    log('error', message, { component: 'venice', action, ...meta }, error),

  sessionError: (action, message, error, meta = {}) =>
    log('error', message, { component: 'live-session', action, ...meta }, error),

  tryonError: (action, message, error, meta = {}) =>
    log('error', message, { component: 'virtual-tryon', action, ...meta }, error),
};
