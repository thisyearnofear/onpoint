/**
 * usePremiumStatus — Client-side premium status hook
 *
 * Calls the subscription API to check if the current user has premium access.
 * Falls back gracefully with cached results for offline resilience.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

interface PremiumStatus {
  isPremium: boolean;
  tier: string;
  loading: boolean;
  canStartTrial: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePremiumStatus(): PremiumStatus {
  const { user, isLoading: authLoading } = useUser();
  const [isPremium, setIsPremium] = useState(false);
  const [tier, setTier] = useState("free");
  const [loading, setLoading] = useState(true);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setIsPremium(false);
      setTier("free");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/auth/subscription", {
        credentials: "include",
      });

      if (!response.ok) {
        // If 401, user isn't authenticated — free tier
        if (response.status === 401) {
          setIsPremium(false);
          setTier("free");
          setCanStartTrial(false);
          return;
        }
        throw new Error(`Subscription check failed: ${response.status}`);
      }

      const data = await response.json();

      const isPremiumUser =
        data.subscription?.tier === "pro" ||
        data.subscription?.tier === "concierge" ||
        data.subscription?.tier === "basic" ||
        data.subscription?.status === "trialing" ||
        data.tier === "premium" ||
        data.subscription?.config?.price > 0;

      setIsPremium(isPremiumUser);
      setTier(data.subscription?.tier || data.tier || "free");
      setCanStartTrial(data.canStartTrial ?? false);
    } catch (err) {
      console.error("[usePremiumStatus] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to check premium status");
      // Don't reset on error — keep previous state for resilience
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isPremium,
    tier,
    loading: loading || authLoading,
    canStartTrial,
    error,
    refresh: checkStatus,
  };
}
