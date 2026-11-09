"use client";

/**
 * Agent wallet session client — challenge → personal_sign → verify.
 *
 * The API no longer accepts a bare `x-agent-address` header or a plaintext
 * `x-curator-whatsapp` value for look writes. Writers first prove control of
 * a wallet via POST /api/auth/challenge + POST /api/auth/verify, then send
 * the returned Bearer token on every write plus `x-curator-slug` when acting
 * in a curator context.
 */

import { getApiBase } from "./utils/api-base";

const STORAGE_KEY = "onpoint_agent_session";
const ADDRESS_KEY = "onpoint_agent_address";

export interface AgentSession {
  token: string;
  address: string;
  expiresAt: string;
}

export function getAgentSession(): AgentSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentSession;
    if (!parsed.token || !parsed.address) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAgentSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ADDRESS_KEY);
  } catch {
    // ignore
  }
}

/** Headers for authenticated look writes. Pass curatorSlug for curator-scoped writes. */
export function agentAuthHeaders(curatorSlug?: string): Record<string, string> {
  const session = getAgentSession();
  return agentAuthHeadersFromSession(session, curatorSlug);
}

/** Build the same headers from an already-loaded session (avoids storage races). */
export function agentAuthHeadersFromSession(
  session: AgentSession | null,
  curatorSlug?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (curatorSlug) headers["x-curator-slug"] = curatorSlug;
  return headers;
}

/**
 * Full sign-in: fetch a challenge for `address`, sign it with the connected
 * wallet, verify it, and persist the session token. `signMessage` is wagmi's
 * `signMessageAsync` (or any personal_sign implementation).
 */
export async function signInWithWallet(
  address: string,
  signMessage: (args: { message: string }) => Promise<string>,
): Promise<AgentSession> {
  const base = getApiBase();

  const challengeRes = await fetch(`${base}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!challengeRes.ok) {
    const data = await challengeRes.json().catch(() => ({}));
    throw new Error(data.error || "Failed to start wallet sign-in");
  }
  const { message } = (await challengeRes.json()) as { message: string };

  const signature = await signMessage({ message });

  const verifyRes = await fetch(`${base}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });
  if (!verifyRes.ok) {
    const data = await verifyRes.json().catch(() => ({}));
    throw new Error(data.error || "Wallet signature rejected");
  }
  const { token, expiresAt } = (await verifyRes.json()) as {
    token: string;
    expiresAt: string;
  };

  const session: AgentSession = {
    token,
    address: address.toLowerCase(),
    expiresAt,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    sessionStorage.setItem(ADDRESS_KEY, session.address);
  } catch {
    // ignore — session just won't persist across reloads
  }
  // Notify same-tab hook listeners.
  try {
    window.dispatchEvent(new CustomEvent("onpoint:agent-session", { detail: session }));
  } catch {
    // ignore
  }
  return session;
}
