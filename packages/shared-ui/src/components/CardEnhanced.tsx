'use client';

import React, { useState } from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { getTransitionName } from '@onpoint/shared-types';
import { Heart, Share2, Zap, TrendingUp } from 'lucide-react';

/**
 * Enhanced Fashion Card
 * 
 * Premium version with micro-interactions, social proof, and engagement signals.
 * Features:
 * - Animated engagement metrics (try-on count, rating)
 * - Quick action buttons (like, share, quick preview)
 * - Trending/hot badges for virality
 * - Smooth hover depth and light effects
 * - Optimized for mobile swipe interactions
 */

interface CardEnhancedProps {
  item: FashionItem;
  onClick?: () => void;
  onLike?: (liked: boolean) => void;
  onShare?: () => void;
  onQuickPreview?: () => void;
  className?: string;
  showStats?: boolean;
  showActions?: boolean;
}

export const CardEnhanced = React.forwardRef<HTMLDivElement, CardEnhancedProps>(
  (
    {
      item,
      onClick,
      onLike,
      onShare,
      onQuickPreview,
      className = '',
      showStats = true,
      showActions = true,
    },
    ref
  ) => {
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(item.tryOnCount || 0);
    const [showQuickPreview, setShowQuickPreview] = useState(false);
    
    const imageTransition = getTransitionName(item.id, 'image');
    const titleTransition = getTransitionName(item.id, 'title');
    const priceTransition = getTransitionName(item.id, 'price');

    const handleLike = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newLiked = !isLiked;
      setIsLiked(newLiked);
      setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
      onLike?.(newLiked);
    };

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare?.();
    };

    const isTrending = (item.tryOnCount || 0) > 50;
    const rating = item.averageRating || 0;

    return (
      <article
        ref={ref}
        onClick={onClick}
        className={`
          group relative bg-white rounded-xl overflow-hidden
          shadow-md hover:shadow-2xl
          transition-all duration-300 ease-out
          cursor-pointer
          border border-gray-100 hover:border-gray-200
          ${className}
        `}
        data-transition-item-id={item.id}
        data-transition-item-slug={item.slug}
      >
        {/* Image Container with Overlay */}
        <div className="relative overflow-hidden bg-gray-100 aspect-square">
          {/* Trending Badge */}
          {isTrending && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-red-500/90 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm animate-pulse">
              <Zap className="h-3.5 w-3.5" />
              Trending
            </div>
          )}

          {/* Image */}
          <img
            src={item.cover}
            alt={item.name}
            className="
              w-full h-full object-cover
              group-hover:scale-110
              transition-transform duration-500 ease-out
            "
            style={{
              viewTransitionName: imageTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
          />

          {/* Gradient Overlay on Hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Quick Action Buttons */}
          {showActions && (
            <div className="absolute bottom-3 left-0 right-0 flex gap-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
              <button
                onClick={handleLike}
                className={`
                  flex-1 py-2 px-3 rounded-lg backdrop-blur-md
                  font-medium text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                  ${isLiked 
                    ? 'bg-red-500/90 text-white' 
                    : 'bg-white/90 text-gray-900 hover:bg-white'
                  }
                `}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                {isLiked && <span className="text-xs">{likeCount}</span>}
              </button>
              <button
                onClick={handleShare}
                className="
                  flex-1 py-2 px-3 rounded-lg backdrop-blur-md
                  bg-white/90 text-gray-900 hover:bg-white
                  font-medium text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                "
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Rating Badge */}
          {item.averageRating && (
            <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-1">
              <span>★</span>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3
            className="font-semibold text-base truncate text-gray-900 group-hover:text-primary transition-colors"
            style={{
              viewTransitionName: titleTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
          >
            {item.name}
          </h3>

          {/* Category */}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {item.category}
          </p>

          {/* Stats Row */}
          {showStats && (
            <div className="flex items-center justify-between pt-1 text-xs text-gray-600">
              <div className="flex items-center gap-3">
                {item.tryOnCount && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">👁️</span>
                    <span>{item.tryOnCount.toLocaleString()}</span>
                  </div>
                )}
                {item.mintCount && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">✨</span>
                    <span>{item.mintCount}</span>
                  </div>
                )}
              </div>
              <div className="text-gray-400">•</div>
            </div>
          )}

          {/* Footer: Price */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span
              className="font-bold text-lg text-gray-900"
              style={{
                viewTransitionName: priceTransition,
                contain: 'layout style paint',
              } as React.CSSProperties}
            >
              ${item.price}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickPreview?.();
                setShowQuickPreview(!showQuickPreview);
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
            >
              Preview
            </button>
          </div>
        </div>

        {/* Quick Preview Tooltip */}
        {showQuickPreview && item.modelSrc && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl z-30 backdrop-blur-sm">
            <div className="text-center">
              <img 
                src={item.modelSrc} 
                alt="Quick preview"
                className="max-w-[80%] max-h-[80%] object-contain"
              />
            </div>
          </div>
        )}
      </article>
    );
  }
);

CardEnhanced.displayName = 'CardEnhanced';

export default CardEnhanced;
