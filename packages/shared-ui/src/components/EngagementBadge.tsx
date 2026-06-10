'use client';

import React from 'react';
import { Zap, TrendingUp, Award, Heart } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

/**
 * Animated Engagement Badge Component
 *
 * Displays animated counters and social proof indicators.
 * Optimized for virality and engagement signaling.
 * Gradients are themed via CSS custom properties.
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

interface BadgeStyle {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  /** CSS variable suffix for the accent gradient (vibrant from→to) */
  gradientVar: string;
  /** CSS variable suffix for the background gradient (subtle from→to) */
  bgGradientVar: string;
}

const BADGE_CONFIG: Record<'trending' | 'viral' | 'popular' | 'new', BadgeStyle> = {
  trending: {
    icon: Zap,
    label: 'Trending',
    gradientVar: 'trending',
    bgGradientVar: 'trending',
  },
  viral: {
    icon: TrendingUp,
    label: 'Going Viral',
    gradientVar: 'viral',
    bgGradientVar: 'viral',
  },
  popular: {
    icon: Heart,
    label: 'Popular',
    gradientVar: 'popular',
    bgGradientVar: 'popular',
  },
  new: {
    icon: Award,
    label: 'Just Released',
    gradientVar: 'new',
    bgGradientVar: 'new',
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
  const config = BADGE_CONFIG[type] ?? BADGE_CONFIG.trending;
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5
          rounded-full text-xs font-semibold text-white
          backdrop-blur-sm
          ${className}
        `}
        style={{
          background: `linear-gradient(135deg, var(--badge-${config.gradientVar}-from), var(--badge-${config.gradientVar}-to))`,
        }}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-lg p-4 space-y-3 border border-border
        hover:border-border/60 transition-colors
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg, var(--badge-${config.bgGradientVar}-bg-from), var(--badge-${config.bgGradientVar}-bg-to))`,
      }}
    >
      {/* Badge Header */}
      <div className="flex items-center gap-2">
        <div
          className="p-2 rounded-lg"
          style={{
            background: `linear-gradient(135deg, var(--badge-${config.gradientVar}-from), var(--badge-${config.gradientVar}-to))`,
          }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">
            {config.label}
          </h3>
          <p className="text-xs text-muted-foreground">Community favorite</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {/* Try-On Count */}
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">
            <AnimatedCounter
              value={tryOnCount}
              duration={600}
              animated={animated}
              formatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))}
            />
          </div>
          <div className="text-xs text-muted-foreground">Try-ons</div>
        </div>

        {/* Rating */}
        {rating > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">
              {rating.toFixed(1)}★
            </div>
            <div className="text-xs text-muted-foreground">Rating</div>
          </div>
        )}

        {/* Mint Count */}
        {mintCount > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">
              {mintCount}
            </div>
            <div className="text-xs text-muted-foreground">Mints</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EngagementBadge;
