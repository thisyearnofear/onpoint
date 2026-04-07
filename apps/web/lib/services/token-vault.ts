/**
 * Auth0 Token Vault Service for AI Agents
 *
 * Securely manages 3rd-party OAuth tokens for shopping agents.
 * Implements RFC 8693 Token Exchange via Auth0 Token Vault.
 *
 * The agent never sees user credentials - Auth0 handles OAuth flows,
 * token storage, and refresh. Agent requests scoped access tokens
 * on-demand for specific providers.
 */

import { auth0 } from "../auth0";
import { AgentAuthContext } from "../../middleware/agent-auth";

export type SupportedProvider =
  | "google-oauth2" // Google Calendar, Gmail, Drive
  | "github" // GitHub repos, gists
  | "slack" // Slack messaging
  | "windowslive" // Microsoft services
  | "notion" // Notion pages
  | "custom-shopping"; // Custom shopping API

export interface TokenVaultRequest {
  connection: SupportedProvider;
  scopes: string[];
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  payload?: any;
}

export interface ConnectedAccount {
  connection: SupportedProvider;
  connected: boolean;
  scopes?: string[];
  connectedAt?: number;
}

export class TokenVaultService {
  /**
   * Execute a secure API call using Auth0 Token Vault.
   *
   * Flow:
   * 1. Validate agent permissions
   * 2. Request access token from Token Vault for specific connection
   * 3. Make API call with delegated token
   * 4. Return response (agent never sees the token)
   */
  static async executeSecureRequest(
    auth: AgentAuthContext,
    request: TokenVaultRequest,
  ): Promise<any> {
    // 1. Validate agent has permission to act
    if (
      !auth.permissions.includes("shopping:purchase") &&
      !auth.permissions.includes("shopping:write")
    ) {
      throw new Error(
        "Unauthorized: Agent lacks 'shopping:purchase' or 'shopping:write' permission",
      );
    }

    try {
      // 2. Get access token from Token Vault for the specific connection
      const accessToken = await this.getConnectionToken(
        request.connection,
        request.scopes,
      );

      if (!accessToken) {
        throw new TokenVaultError(
          `User has not connected ${request.connection}. Please authorize access.`,
          "NOT_CONNECTED",
          request.connection,
        );
      }

      // 3. Execute the API call with the delegated token
      console.log(
        `[TokenVault] Calling ${request.connection} ${request.method} ${request.endpoint}`,
      );

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
        // Handle token expiry or revocation
        if (response.status === 401) {
          throw new TokenVaultError(
            "Access token expired or revoked. User needs to re-authorize.",
            "TOKEN_EXPIRED",
            request.connection,
          );
        }

        throw new Error(
          `API call failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        success: true,
        data,
        connection: request.connection,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error(`[TokenVault] Request failed:`, error.message);

      if (error instanceof TokenVaultError) {
        throw error;
      }

      throw new Error(`Token Vault request failed: ${error.message}`);
    }
  }

  /**
   * Get access token for a specific connection from Auth0 Token Vault.
   * Uses RFC 8693 Token Exchange under the hood.
   */
  private static async getConnectionToken(
    connection: SupportedProvider,
    scopes: string[],
  ): Promise<string | null> {
    try {
      // Auth0 SDK handles token exchange internally
      const result = await auth0.getAccessTokenForConnection({
        connection,
      });

      return result?.token || null;
    } catch (error: any) {
      console.error(
        `[TokenVault] Failed to get token for ${connection}:`,
        error.message,
      );

      // User hasn't connected this account
      if (error.code === "ERR_NO_CONNECTION") {
        return null;
      }

      throw error;
    }
  }

  /**
   * Get the status of all connected accounts for a user.
   * Shows which providers are authorized and what scopes they have.
   */
  static async getConnectedAccounts(
    auth0Id: string,
  ): Promise<ConnectedAccount[]> {
    try {
      const session = await auth0.getSession();

      if (!session?.user) {
        return [];
      }

      // In production, this would query Auth0 Management API
      // for the user's connected accounts and granted scopes
      const connections: ConnectedAccount[] = [
        {
          connection: "google-oauth2",
          connected: false,
          scopes: [],
        },
        {
          connection: "github",
          connected: false,
          scopes: [],
        },
        {
          connection: "slack",
          connected: false,
          scopes: [],
        },
        {
          connection: "notion",
          connected: false,
          scopes: [],
        },
      ];

      return connections;
    } catch (error) {
      console.error("[TokenVault] Failed to get connected accounts:", error);
      return [];
    }
  }

  /**
   * Initiate OAuth flow to connect a new account.
   * Returns the authorization URL to redirect the user to.
   */
  static getConnectionAuthUrl(
    connection: SupportedProvider,
    scopes: string[],
    redirectUri: string,
  ): string {
    const params = new URLSearchParams({
      connection,
      scope: scopes.join(" "),
      redirect_uri: redirectUri,
      response_type: "code",
      prompt: "consent",
    });

    return `/api/auth/connect?${params.toString()}`;
  }

  /**
   * Revoke access to a connected account.
   * Removes tokens from Token Vault.
   */
  static async revokeConnection(
    auth0Id: string,
    connection: SupportedProvider,
  ): Promise<void> {
    try {
      // In production, this would call Auth0 Management API
      // to revoke the connection and delete stored tokens
      console.log(`[TokenVault] Revoking ${connection} for user ${auth0Id}`);

      // For now, log the action
      // await auth0.management.deleteUserConnection(auth0Id, connection);
    } catch (error) {
      console.error(`[TokenVault] Failed to revoke ${connection}:`, error);
      throw error;
    }
  }
}

/**
 * Custom error for Token Vault operations.
 * Provides context about which connection failed and why.
 */
export class TokenVaultError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_CONNECTED"
      | "TOKEN_EXPIRED"
      | "INSUFFICIENT_SCOPE"
      | "API_ERROR",
    public connection: SupportedProvider,
  ) {
    super(message);
    this.name = "TokenVaultError";
  }
}
