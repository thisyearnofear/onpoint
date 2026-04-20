/**
 * Structured Logger
 *
 * Replaces raw console.error calls with structured, searchable logs.
 * Each log entry includes: level, context, message, metadata, timestamp.
 *
 * In production, pipe to an external service (Sentry, Axiom, etc.).
 * In development, logs to console with color coding.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  action?: string;
  agentId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  timestamp: string;
  error?: {
    message: string;
    stack?: string;
  };
}

const isDev = process.env.NODE_ENV !== "production";

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  error?: unknown,
): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    error:
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
          ? { message: String(error) }
          : undefined,
  };

  if (isDev) {
    const prefix = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
    }[level];
    const method =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    method(
      `${prefix} [${context.component ?? "app"}] ${message}`,
      context,
      error ?? "",
    );
  } else {
    // In production, emit structured JSON + Sentry for errors
    const method =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    method(formatEntry(entry));
  }

  // Report errors to Sentry (lazy import to avoid bundling when unused)
  if (level === "error" && typeof window === "undefined") {
    import("@sentry/nextjs")
      .then((Sentry) => {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: { component: context.component as string },
          });
        } else {
          Sentry.captureMessage(message, {
            level: "error",
            tags: { component: context.component as string },
          });
        }
      })
      .catch(() => {});
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),

  info: (message: string, context?: LogContext) =>
    log("info", message, context),

  warn: (message: string, context?: LogContext, error?: unknown) =>
    log("warn", message, context, error),

  error: (message: string, context?: LogContext, error?: unknown) =>
    log("error", message, context, error),

  // Convenience for API route errors
  apiError: (
    route: string,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
  ) => log("error", message, { component: "api", route, ...meta }, error),

  // Convenience for agent action errors
  agentError: (
    action: string,
    agentId: string,
    message: string,
    error?: unknown,
  ) => log("error", message, { component: "agent", action, agentId }, error),
};
