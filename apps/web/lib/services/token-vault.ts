/**
 * Auth0 Token Vault Service for AI Agents
 *
 * Securely manages 3rd-party OAuth tokens via Auth0 Token Vault.
 * Uses RFC 8693 Token Exchange. Agent never sees user credentials.
 */

import { auth0 } from "../auth0";
import { AgentAuthContext } from "../../middleware/agent-auth";

export type SupportedProvider =
  | "google-oauth2"
  | "github"
  | "slack"
  | "windowslive"
  | "notion"
  | "custom-shopping";

export interface TokenVaultRequest {
  connection: SupportedProvider;
  scopes: string[];
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  payload?: unknown;
}

export interface ConnectedAccount {
  connection: SupportedProvider;
  connected: boolean;
  scopes?: string[];
  connectedAt?: number;
}

const REQUIRED_PERMISSIONS: Array<AgentAuthContext["permissions"][number]> = [
  "shopping:purchase",
  "shopping:write",
];

/**
 * Execute a secure API call using Auth0 Token Vault.
 * Agent never sees credentials - Auth0 handles OAuth via RFC 8693.
 */
export async function executeSecureRequest(
  auth: AgentAuthContext,
  request: TokenVaultRequest,
): Promise<{ success: true; data: unknown; connection: string; timestamp: number }> {
  // Validate permissions
  const hasPermission = REQUIRED_PERMISSIONS.some((p) =>
    auth.permissions.includes(p),
  );
  if (!hasPermission) {
    throw new TokenVaultError(
      "Agent lacks required permissions",
      "INSUFFICIENT_SCOPE",
      request.connection,
    );
  }

  const accessToken = await getConnectionToken(request.connection);
  if (!accessToken) {
    throw new TokenVaultError(
      `User has not connected ${request.connection}`,
      "NOT_CONNECTED",
      request.connection,
    );
  }

  const response = await fetch(request.endpoint, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "OnPoint-AI-Agent/1.0",
    },
    body: request.payload ? JSON.stringify(request.payload) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new TokenVaultError(
        "Token expired or revoked",
        "TOKEN_EXPIRED",
        request.connection,
      );
    }
    throw new Error(`API failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    data,
    connection: request.connection,
    timestamp: Date.now(),
  };
}

/**
 * Get access token for a connection via RFC 8693 Token Exchange.
 */
async function getConnectionToken(
  connection: SupportedProvider,
): Promise<string | null> {
  try {
    const result = await auth0.getAccessTokenForConnection({ connection });
    return result?.token || null;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "ERR_NO_CONNECTION") return null;
    throw error;
  }
}

/**
 * Get OAuth connection URL for linking external accounts.
 * Uses Auth0's built-in connect flow.
 */
export function getConnectionAuthUrl(
  connection: SupportedProvider,
  scopes: string[],
): string {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    connection,
    scope: scopes.join(" "),
  });
  return `/api/auth/login?${params.toString()}&returnTo=/settings/connections`;
}

/**
 * Custom error for Token Vault operations.
 */
export class TokenVaultError extends Error {
  constructor(
    message: string,
    public code: "NOT_CONNECTED" | "TOKEN_EXPIRED" | "INSUFFICIENT_SCOPE" | "API_ERROR",
    public connection: SupportedProvider,
  ) {
    super(message);
    this.name = "TokenVaultError";
  }
}
