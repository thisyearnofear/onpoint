'use client';

import React from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { getTransitionName } from '@onpoint/shared-types';

/**
 * FashionCard Component
 * 
 * Reusable, transition-aware card for displaying fashion items.
 * Coordinates with TransitionDetail via matching transition names.
 * 
 * Features:
 * - View Transitions API integration
 * - Responsive design
 * - Hover effects
 * - Customizable click handlers
 */

interface FashionCardProps {
  item: FashionItem;
  onClick?: () => void;
  className?: string;
  showRating?: boolean;
  showPrice?: boolean;
}

export const FashionCard = React.forwardRef<HTMLDivElement, FashionCardProps>(
  (
    {
      item,
      onClick,
      className = '',
      showRating = true,
      showPrice = true,
    },
    ref
  ) => {
    const imageTransition = getTransitionName(item.id, 'image');
    const titleTransition = getTransitionName(item.id, 'title');
    const descriptionTransition = getTransitionName(item.id, 'description');
    const priceTransition = getTransitionName(item.id, 'price');

    return (
      <article
        ref={ref}
        onClick={onClick}
        className={`
          group bg-white rounded-lg overflow-hidden
          shadow-sm hover:shadow-lg
          transition-all duration-300
          cursor-pointer
          ${className}
        `}
        data-transition-item-id={item.id}
        data-transition-item-slug={item.slug}
      >
        {/* Image Container */}
        <div className="relative overflow-hidden bg-gray-100 aspect-square">
          <img
            src={item.cover}
            alt={item.name}
            className="
              w-full h-full object-cover
              group-hover:scale-105
              transition-transform duration-300
              grayscale-[0.1] group-hover:grayscale-0
            "
            style={{
              viewTransitionName: imageTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
          />
          
          {/* Rating Badge */}
          {showRating && item.averageRating && (
            <div className="absolute top-2 right-2 bg-black/75 text-white px-2 py-1 rounded text-xs font-semibold">
              {item.averageRating.toFixed(1)}★
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-2">
          {/* Title */}
          <h3
            className="font-semibold text-lg truncate text-gray-900"
            style={{
              viewTransitionName: titleTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
          >
            {item.name}
          </h3>

          {/* Description */}
          <p
            className="text-gray-600 text-sm line-clamp-2"
            style={{
              viewTransitionName: descriptionTransition,
              contain: 'layout style paint',
            } as React.CSSProperties}
          >
            {item.description}
          </p>

          {/* Footer: Category & Price */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {item.category}
            </span>

            {showPrice && (
              <span
                className="font-bold text-gray-900"
                style={{
                  viewTransitionName: priceTransition,
                  contain: 'layout style paint',
                } as React.CSSProperties}
              >
                ${item.price}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  }
);

FashionCard.displayName = 'FashionCard';

export default FashionCard;
