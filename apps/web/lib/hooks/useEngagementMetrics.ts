'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * useEngagementMetrics Hook
 * 
 * Manages engagement data (likes, try-ons, shares) for fashion items.
 * Persists to localStorage for persistence across sessions.
 * 
 * @example
 * ```tsx
 * const { getMetrics, incrementLike, incrementTryOn, incrementShare } = useEngagementMetrics();
 * 
 * const metrics = getMetrics(itemId);
 * console.log(metrics.likes, metrics.tries, metrics.shares);
 * ```
 */

export interface ItemMetrics {
  likes: number;
  tries: number;
  shares: number;
  lastLiked?: number;
}

export interface EngagementState {
  [itemId: string]: ItemMetrics;
}

const STORAGE_KEY = 'onpoint-engagement-metrics';
const STORAGE_VERSION = 1;

export function useEngagementMetrics() {
  const [metrics, setMetrics] = useState<EngagementState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Verify version for future migrations
        if (parsed.version === STORAGE_VERSION) {
          setMetrics(parsed.data || {});
        }
      }
    } catch (error) {
      console.error('Failed to load engagement metrics:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever metrics change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;

    try {
      const toStore = {
        version: STORAGE_VERSION,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save engagement metrics:', error);
    }
  }, [metrics, isLoaded]);

  /**
   * Get metrics for a specific item
   */
  const getMetrics = useCallback(
    (itemId: string): ItemMetrics => {
      return (
        metrics[itemId] || {
          likes: 0,
          tries: 0,
          shares: 0,
        }
      );
    },
    [metrics]
  );

  /**
   * Increment like counter
   */
  const incrementLike = useCallback((itemId: string) => {
    setMetrics(prev => {
      const updated: EngagementState = {
        ...prev,
        [itemId]: {
          likes: (prev[itemId]?.likes || 0) + 1,
          tries: prev[itemId]?.tries || 0,
          shares: prev[itemId]?.shares || 0,
          lastLiked: Date.now(),
        },
      };
      return updated;
    });
  }, []);

  /**
   * Decrement like counter
   */
  const decrementLike = useCallback((itemId: string) => {
    setMetrics(prev => {
      const updated: EngagementState = {
        ...prev,
        [itemId]: {
          likes: Math.max(0, (prev[itemId]?.likes || 1) - 1),
          tries: prev[itemId]?.tries || 0,
          shares: prev[itemId]?.shares || 0,
        },
      };
      return updated;
    });
  }, []);

  /**
   * Increment try-on counter
   */
  const incrementTryOn = useCallback((itemId: string) => {
    setMetrics(prev => {
      const updated: EngagementState = {
        ...prev,
        [itemId]: {
          likes: prev[itemId]?.likes || 0,
          tries: (prev[itemId]?.tries || 0) + 1,
          shares: prev[itemId]?.shares || 0,
        },
      };
      return updated;
    });
  }, []);

  /**
   * Increment share counter
   */
  const incrementShare = useCallback((itemId: string) => {
    setMetrics(prev => {
      const updated: EngagementState = {
        ...prev,
        [itemId]: {
          likes: prev[itemId]?.likes || 0,
          tries: prev[itemId]?.tries || 0,
          shares: (prev[itemId]?.shares || 0) + 1,
        },
      };
      return updated;
    });
  }, []);

  /**
   * Check if user has liked an item
   */
  const hasLiked = useCallback(
    (itemId: string): boolean => {
      return (metrics[itemId]?.lastLiked || 0) > 0;
    },
    [metrics]
  );

  /**
   * Get aggregate metrics across all items
   */
  const getAggregateMetrics = useCallback(() => {
    return Object.values(metrics).reduce(
      (acc, item) => ({
        totalLikes: acc.totalLikes + item.likes,
        totalTries: acc.totalTries + item.tries,
        totalShares: acc.totalShares + item.shares,
      }),
      { totalLikes: 0, totalTries: 0, totalShares: 0 }
    );
  }, [metrics]);

  /**
   * Clear all metrics (for testing/debugging)
   */
  const clearMetrics = useCallback(() => {
    setMetrics({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    metrics,
    isLoaded,
    getMetrics,
    incrementLike,
    decrementLike,
    incrementTryOn,
    incrementShare,
    hasLiked,
    getAggregateMetrics,
    clearMetrics,
  };
}

export default useEngagementMetrics;
