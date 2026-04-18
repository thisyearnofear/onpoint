/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup.
 * Fails fast in production if critical vars are missing, preventing
 * silent failures (e.g., rate limiting disabled, auth broken).
 */

import { logger } from "./logger";

interface EnvRule {
  name: string;
  required: "production" | "always" | "optional";
  description: string;
}

const ENV_RULES: EnvRule[] = [
  // Auth0 — required in production for Token Vault
  {
    name: "AUTH0_SECRET",
    required: "production",
    description: "Auth0 session encryption secret",
  },
  {
    name: "AUTH0_ISSUER_BASE_URL",
    required: "production",
    description: "Auth0 tenant URL",
  },
  {
    name: "AUTH0_CLIENT_ID",
    required: "production",
    description: "Auth0 application client ID",
  },
  {
    name: "AUTH0_CLIENT_SECRET",
    required: "production",
    description: "Auth0 application client secret",
  },

  // Redis — required in production for rate limiting & state
  {
    name: "UPSTASH_REDIS_REST_URL",
    required: "production",
    description: "Upstash Redis REST URL (rate limiting, state persistence)",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    required: "production",
    description: "Upstash Redis REST token",
  },

  // AI — at least one should be set
  {
    name: "VENICE_API_KEY",
    required: "optional",
    description: "Venice AI API key (primary AI provider)",
  },
  {
    name: "GEMINI_API_KEY",
    required: "optional",
    description: "Google Gemini API key (Live AR sessions)",
  },

  // Blockchain
  {
    name: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    required: "production",
    description: "WalletConnect project ID for wallet connections",
  },
];

/**
 * Validate environment variables. Call once at app startup.
 *
 * In production: throws if any required var is missing.
 * In development: logs warnings for missing vars.
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.name];
    const isMissing =
      !value || value.includes("your_") || value.includes("<");

    if (!isMissing) continue;

    if (rule.required === "always") {
      missing.push(rule.name);
    } else if (rule.required === "production" && isProduction) {
      missing.push(rule.name);
    } else if (rule.required === "production" && !isProduction) {
      warnings.push(`${rule.name} — ${rule.description}`);
    }
  }

  // Check that at least one AI provider is configured
  const hasAI =
    process.env.VENICE_API_KEY ||
    (process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here") ||
    (process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "your_openai_api_key_here");

  if (!hasAI) {
    if (isProduction) {
      missing.push("VENICE_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY (at least one)");
    } else {
      warnings.push(
        "No AI provider configured — AI features will be unavailable",
      );
    }
  }

  if (warnings.length > 0) {
    logger.warn("Missing optional env vars (dev mode)", {
      component: "env-validation",
      warnings,
    });
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join("\n")}`;

    if (isProduction) {
      logger.error(message, { component: "env-validation" });
      throw new Error(message);
    } else {
      logger.warn(message, { component: "env-validation" });
    }
  }

  return { valid: missing.length === 0, missing };
}
