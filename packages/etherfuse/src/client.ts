/**
 * Etherfuse FX API — HTTP client
 *
 * Thin wrapper around fetch with the Etherfuse auth convention
 * (raw API key in `Authorization`, no `Bearer` prefix).
 *
 * No business logic lives here. Endpoint shape is defined in `./types`.
 */

import type { EtherfuseConfig } from "./types.js";

export const ETHERFUSE_DEFAULT_BASES = {
  sandbox: "https://api.sand.etherfuse.com",
  production: "https://api.etherfuse.com",
} as const;

export class EtherfuseApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly endpoint: string;

  constructor(message: string, status: number, body: unknown, endpoint: string) {
    super(message);
    this.name = "EtherfuseApiError";
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

export interface EtherfuseClient {
  readonly config: EtherfuseConfig;
  readonly baseUrl: string;
  request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function createEtherfuseClient(config: EtherfuseConfig): EtherfuseClient {
  if (!config.apiKey) {
    throw new Error("Etherfuse apiKey is required");
  }

  const baseUrl: string =
    config.baseUrl ?? ETHERFUSE_DEFAULT_BASES[config.environment];

  async function request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeoutMs = config.timeoutMs ?? 15_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          // Etherfuse convention: raw API key, no `Bearer` prefix.
          Authorization: config.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "onpoint-stylist/1.0",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      const parsed: unknown = text ? safeJson(text) : null;

      if (!res.ok) {
        throw new EtherfuseApiError(
          `Etherfuse ${method} ${path} failed: ${res.status}`,
          res.status,
          parsed,
          path,
        );
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof EtherfuseApiError) throw err;
      if ((err as Error)?.name === "AbortError") {
        throw new EtherfuseApiError(
          `Etherfuse ${method} ${path} timed out after ${timeoutMs}ms`,
          408,
          null,
          path,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    config,
    baseUrl,
    request,
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Build a client from environment variables. Returns `null` when the API
 * key is absent, so route handlers can degrade gracefully ("not configured")
 * instead of throwing on import.
 */
export function etherfuseClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EtherfuseClient | null {
  const apiKey = env.ETHERFUSE_API_KEY;
  if (!apiKey) return null;

  const environment =
    env.ETHERFUSE_ENV === "production" ? "production" : "sandbox";

  return createEtherfuseClient({
    apiKey,
    environment,
    baseUrl: env.ETHERFUSE_BASE_URL,
    defaultChain: (env.ETHERFUSE_DEFAULT_CHAIN as "celo" | "base" | undefined) ?? "base",
    defaultFiat: (env.ETHERFUSE_DEFAULT_FIAT as "MXN" | "USD" | undefined) ?? "MXN",
    webhookSecret: env.ETHERFUSE_WEBHOOK_SECRET,
  });
}
