'use client';

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, Award, Heart } from 'lucide-react';

/**
 * Animated Engagement Badge Component
 * 
 * Displays animated counters and social proof indicators.
 * Optimized for virality and engagement signaling.
 */

interface EngagementBadgeProps {
  tryOnCount?: number;
  mintCount?: number;
  rating?: number;
  type?: 'trending' | 'viral' | 'popular' | 'new';
  animated?: boolean;
  compact?: boolean;
  className?: string;
}

const BADGE_CONFIG = {
  trending: {
    icon: Zap,
    label: 'Trending',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-gradient-to-r from-orange-50 to-red-50',
  },
  viral: {
    icon: TrendingUp,
    label: 'Going Viral',
    color: 'from-pink-500 to-red-500',
    bg: 'bg-gradient-to-r from-pink-50 to-red-50',
  },
  popular: {
    icon: Heart,
    label: 'Popular',
    color: 'from-purple-500 to-pink-500',
    bg: 'bg-gradient-to-r from-purple-50 to-pink-50',
  },
  new: {
    icon: Award,
    label: 'Just Released',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-gradient-to-r from-blue-50 to-cyan-50',
  },
};

export const EngagementBadge: React.FC<EngagementBadgeProps> = ({
  tryOnCount = 0,
  mintCount = 0,
  rating = 0,
  type = 'trending',
  animated = true,
  compact = false,
  className = '',
}) => {
  const [displayCount, setDisplayCount] = useState(0);
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;

  // Animated counter
  useEffect(() => {
    if (!animated) {
      setDisplayCount(tryOnCount);
      return;
    }

    let animationId: ReturnType<typeof setInterval>;
    let current = 0;

    const increment = Math.max(1, Math.floor(tryOnCount / 20));
    animationId = setInterval(() => {
      current += increment;
      if (current >= tryOnCount) {
        setDisplayCount(tryOnCount);
        clearInterval(animationId);
      } else {
        setDisplayCount(current);
      }
    }, 30);

    return () => clearInterval(animationId);
  }, [tryOnCount, animated]);

  if (compact) {
    return (
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5
          rounded-full text-xs font-semibold
          bg-gradient-to-r ${config.color} text-white
          backdrop-blur-sm
          ${className}
        `}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`
        ${config.bg} rounded-lg p-4 space-y-3 border border-transparent
        hover:border-gray-200 transition-colors
        ${className}
      `}
    >
      {/* Badge Header */}
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-gray-900">
            {config.label}
          </h3>
          <p className="text-xs text-gray-600">Community favorite</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {/* Try-On Count */}
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {displayCount > 999 ? `${(displayCount / 1000).toFixed(1)}k` : displayCount}
          </div>
          <div className="text-xs text-gray-600">Try-ons</div>
        </div>

        {/* Rating */}
        {rating > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {rating.toFixed(1)}★
            </div>
            <div className="text-xs text-gray-600">Rating</div>
          </div>
        )}

        {/* Mint Count */}
        {mintCount > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {mintCount}
            </div>
            <div className="text-xs text-gray-600">Mints</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EngagementBadge;
