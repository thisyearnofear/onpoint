'use client';

import React, { useState } from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { getTransitionName } from '@onpoint/shared-types';
import { Heart, Share2, Zap } from 'lucide-react';

/**
 * Unified Fashion Card Component
 * 
 * Single, versatile card handling both basic and enhanced displays.
 * Consolidates FashionCard + CardEnhanced for DRY principle.
 * 
 * Features:
 * - Data-driven styling via attributes (trending, rating tiers)
 * - Container queries for responsive sizing
 * - Touch-optimized interactions (44px+ tap targets)
 * - Configurable feature levels (basic → enhanced)
 * - View Transitions API integration
 * - Mobile-first with adaptive layout
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
  variant?: 'basic' | 'enhanced'; // 'basic' mimics old FashionCard, 'enhanced' is full-featured
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
      variant = 'enhanced',
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

    // Data-driven attributes for styling
    const isTrending = (item.tryOnCount || 0) > 50;
    const ratingTier = item.averageRating && item.averageRating >= 4.5 ? 'premium' : 
                       item.averageRating && item.averageRating >= 4 ? 'excellent' : 
                       item.averageRating && item.averageRating >= 3 ? 'good' : 'standard';
    const rating = item.averageRating || 0;
    const isBasicVariant = variant === 'basic';

    return (
      <article
        ref={ref}
        onClick={onClick}
        className={`
          @container group relative bg-white rounded-xl overflow-hidden
          shadow-md hover:shadow-2xl
          transition-all duration-300 ease-out
          cursor-pointer
          border border-gray-100 hover:border-gray-200
          ${isBasicVariant ? 'rounded-lg shadow-sm hover:shadow-lg' : ''}
          ${className}
        `}
        data-transition-item-id={item.id}
        data-transition-item-slug={item.slug}
        data-trending={isTrending}
        data-rating-tier={ratingTier}
        data-rating={rating}
        data-variant={variant}
      >
        {/* Image Container with Overlay */}
        <div className="relative overflow-hidden bg-gray-100 aspect-square">
          {/* Trending Badge - only show in enhanced variant */}
          {isTrending && !isBasicVariant && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-red-500/90 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm animate-pulse">
              <Zap className="h-3.5 w-3.5" />
              Trending
            </div>
          )}

          {/* Image - optimized with contain for performance */}
          <img
            src={item.cover}
            alt={item.name}
            className="
              w-full h-full object-cover
              group-hover:scale-105 @sm:group-hover:scale-110
              transition-transform duration-500 ease-out
              will-change-transform
            "
            style={{
              viewTransitionName: imageTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
            loading="lazy"
          />

          {/* Gradient Overlay on Hover - only in enhanced variant */}
          {!isBasicVariant && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          )}

          {/* Quick Action Buttons - touch-friendly (44px minimum) only in enhanced variant */}
          {showActions && !isBasicVariant && (
            <div className="absolute bottom-3 left-0 right-0 flex gap-2 px-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
              <button
                onClick={handleLike}
                className={`
                  flex-1 py-2.5 px-3 rounded-lg backdrop-blur-md
                  font-medium text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                  min-h-[44px] @xs:min-h-auto
                  ${isLiked 
                    ? 'bg-red-500/90 text-white' 
                    : 'bg-white/90 text-gray-900 hover:bg-white active:bg-gray-100'
                  }
                `}
                aria-label={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                {isLiked && <span className="text-xs">{likeCount}</span>}
              </button>
              <button
                onClick={handleShare}
                className="
                  flex-1 py-2.5 px-3 rounded-lg backdrop-blur-md
                  bg-white/90 text-gray-900 hover:bg-white active:bg-gray-100
                  font-medium text-sm transition-all duration-200
                  flex items-center justify-center gap-2
                  min-h-[44px] @xs:min-h-auto
                "
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Rating Badge - styled via data attribute */}
          {item.averageRating && (
            <div 
              className="absolute top-3 right-3 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-1
                [&[data-rating-tier='premium']]:bg-amber-500/90
                [&[data-rating-tier='excellent']]:bg-blue-500/90
                [&[data-rating-tier='good']]:bg-gray-600/90
                [&[data-rating-tier='standard']]:bg-gray-400/90
              "
              data-rating-tier={ratingTier}
            >
              <span>★</span>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className={`${isBasicVariant ? 'p-4 space-y-2' : 'p-4 space-y-3'}`}>
          {/* Title - container-query responsive */}
          <h3
            className="font-semibold truncate text-gray-900 group-hover:text-primary transition-colors
              @xs:text-sm @sm:text-base"
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

          {/* Stats Row - only in enhanced variant */}
          {showStats && !isBasicVariant && (
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

          {/* Footer: Price & Action */}
          <div className={`${isBasicVariant ? 'flex items-center justify-between pt-2 border-t border-gray-100' : 'flex items-center justify-between pt-2 border-t border-gray-100'}`}>
            <span
              className={`font-bold text-gray-900 ${isBasicVariant ? 'text-base' : 'text-lg'}`}
              style={{
                viewTransitionName: priceTransition,
                contain: 'layout style paint',
              } as React.CSSProperties}
            >
              ${item.price}
            </span>
            {/* Preview button - only in enhanced variant */}
            {!isBasicVariant && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickPreview?.();
                  setShowQuickPreview(!showQuickPreview);
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 active:bg-primary/30 transition-colors min-h-[44px] flex items-center justify-center @xs:min-h-auto"
                aria-label="Preview"
              >
                Preview
              </button>
            )}
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
