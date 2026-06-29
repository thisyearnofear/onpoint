/**
 * useMissionState — Client-side hook for user mission/gamification state
 *
 * Fetches from /api/agent/missions to get XP, badges, and mission progress.
 * Used by persona unlock checks, faceoff voting, and style recap.
 *
 * Auth0-first with wallet fallback: if the user has an Auth0 session, uses
 * their Auth0 ID as userId. If not, falls back to the connected wallet
 * address so the G$ Style Streak loop works without an Auth0 account.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAccount } from "wagmi";

export interface MissionState {
  totalXp: number;
  badges: string[];
  completedCount: number;
  inProgressCount: number;
}

interface UseMissionStateReturn {
  missionState: MissionState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMissionState(): UseMissionStateReturn {
  const { user, isLoading: authLoading } = useUser();
  const { address, isConnected } = useAccount();
  const [missionState, setMissionState] = useState<MissionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prefer Auth0 userId; fall back to wallet address for wallet-only users.
  // This enables the G$ loop (claim → streak → premium access) without Auth0.
  const userId = user?.sub ?? (isConnected && address ? address : null);

  const fetchState = useCallback(async () => {
    if (authLoading) return;
    if (!userId) {
      setMissionState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/agent/missions?userId=${userId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          setMissionState(null);
          return;
        }
        throw new Error(`Mission fetch failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.userState) {
        setMissionState(data.userState);
      }
    } catch (err) {
      console.error("[useMissionState] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch missions");
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return {
    missionState,
    loading: loading || authLoading,
    error,
    refresh: fetchState,
  };
}
