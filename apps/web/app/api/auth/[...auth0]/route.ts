import { auth0 } from "../../../../lib/auth0";

/**
 * Auth0 SDK Automatic Route Handler
 * 
 * Handles all Auth0 authentication endpoints:
 * - /api/auth/login     - Initiates login flow
 * - /api/auth/logout    - Logs user out
 * - /api/auth/callback  - OAuth callback handler
 * - /api/auth/profile   - Returns current user profile
 * 
 * This is the v4 SDK standard pattern.
 */
export const GET = auth0.handleAuth();
