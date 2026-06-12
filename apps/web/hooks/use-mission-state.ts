/**
 * useMissionState — Client-side hook for user mission/gamification state
 *
 * Fetches from /api/agent/missions to get XP, badges, and mission progress.
 * Used by persona unlock checks, faceoff voting, and style recap.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

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
  const [missionState, setMissionState] = useState<MissionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setMissionState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/agent/missions?userId=${user.sub}`, {
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
  }, [user, authLoading]);

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
