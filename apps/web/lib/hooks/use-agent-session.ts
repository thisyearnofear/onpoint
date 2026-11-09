"use client";

import { useCallback, useEffect, useState } from "react";
import {
  agentAuthHeaders,
  clearAgentSession,
  getAgentSession,
  signInWithWallet,
  type AgentSession,
} from "../agent-session";

/**
 * Reactive wrapper around the sessionStorage-backed agent session.
 * Re-reads on mount, on `storage` events (other tabs), and on the
 * `onpoint:agent-session` custom event fired by signInWithWallet().
 */
export function useAgentSession() {
  const [session, setSession] = useState<AgentSession | null>(null);

  useEffect(() => {
    setSession(getAgentSession());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "onpoint_agent_session") {
        setSession(getAgentSession());
      }
    };
    const onCustom = () => setSession(getAgentSession());
    window.addEventListener("storage", onStorage);
    window.addEventListener("onpoint:agent-session", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("onpoint:agent-session", onCustom);
    };
  }, []);

  const signIn = useCallback(
    async (
      address: string,
      signMessage: (args: { message: string }) => Promise<string>,
    ) => {
      const next = await signInWithWallet(address, signMessage);
      setSession(next);
      return next;
    },
    [],
  );

  const signOut = useCallback(() => {
    clearAgentSession();
    setSession(null);
    try {
      window.dispatchEvent(new CustomEvent("onpoint:agent-session"));
    } catch {
      // ignore
    }
  }, []);

  return { session, signIn, signOut, authHeaders: agentAuthHeaders };
}
