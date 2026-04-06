"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  Shield,
  Check,
  X,
  LogIn,
  ExternalLink,
  Settings,
  Loader2,
} from "lucide-react";

interface Authorization {
  id: string;
  name: string;
  authorized: boolean;
  scopes: string[];
}

interface AuthStatus {
  auth0Id: string;
  hasAuth0Session: boolean;
  scopes: string[];
  authorizations: Authorization[];
}

export function AgentPermissionDashboard() {
  const { user, isLoading: authLoading } = useUser();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAuthStatus();
    }
  }, [user]);

  const fetchAuthStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth0/authorization");
      if (!response.ok) {
        throw new Error("Failed to fetch authorization status");
      }
      const data = await response.json();
      setAuthStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return <div className="animate-pulse bg-zinc-900/50 rounded-xl h-64" />;
  }

  if (!user) {
    return (
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center backdrop-blur-md">
        <Shield className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          Agent Authorization
        </h3>
        <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
          Login via Auth0 to securely authorize your AI agent to browse and shop
          on your behalf.
        </p>
        <a
          href="/auth/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <LogIn className="w-4 h-4" />
          Authorize Agent
        </a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center backdrop-blur-md">
        <Loader2 className="w-8 h-8 text-violet-500 mx-auto mb-4 animate-spin" />
        <p className="text-zinc-400 text-sm">Loading authorization status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/80 border border-red-900/50 rounded-2xl p-6 text-center backdrop-blur-md">
        <X className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={fetchAuthStatus}
          className="text-violet-400 text-sm hover:text-violet-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const permissions = authStatus?.authorizations || [];

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-md">
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-bold text-white">Secure Token Vault</h3>
            <p className="text-xs text-zinc-500">
              Managed by Auth0 for AI Agents
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {permissions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-zinc-500 text-sm">No retailer connections yet</p>
            <p className="text-zinc-600 text-xs mt-1">
              Authorize the agent to access shopping sites
            </p>
          </div>
        ) : (
          permissions.map((perm) => (
            <div
              key={perm.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                perm.authorized
                  ? "bg-zinc-800/30 border-zinc-700/50"
                  : "bg-zinc-900/50 border-dashed border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    perm.authorized ? "bg-emerald-500/10" : "bg-zinc-800"
                  }`}
                >
                  {perm.authorized ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Shield className="w-5 h-5 text-zinc-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">
                    {perm.name}
                  </h4>
                  <div className="flex gap-2 mt-1">
                    {perm.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {perm.authorized ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-500 font-medium px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    ACTIVE
                  </span>
                  <button className="text-[10px] text-zinc-500 hover:text-red-400 font-medium underline">
                    Revoke
                  </button>
                </div>
              ) : (
                <button className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
                  Connect
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-violet-900/10 border-t border-zinc-800 flex items-start gap-3">
        <div className="mt-0.5">
          <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-[11px] text-zinc-400 leading-tight">
          <span className="text-violet-400 font-medium">Agent Reasoning:</span>{" "}
          I'm currently monitoring Zara for price drops on your saved looks.
          Credentials are isolated in the Auth0 Token Vault.
        </p>
      </div>
    </div>
  );
}
