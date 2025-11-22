'use client';

import React, { useState, useMemo } from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { CardEnhanced } from './CardEnhanced';
import { LayoutGrid, LayoutList, Zap, TrendingUp } from 'lucide-react';

/**
 * Smart Shop Grid Component
 * 
 * Responsive, interactive grid with:
 * - Masonry and list view layouts
 * - Smart sorting (trending, newest, highest-rated)
 * - Infinite scroll placeholder
 * - Category filtering
 * - Engagement metrics aggregation
 */

interface ShopGridProps {
  items: FashionItem[];
  onItemClick?: (item: FashionItem) => void;
  onLike?: (itemId: string, liked: boolean) => void;
  onShare?: (item: FashionItem) => void;
  className?: string;
  showFilters?: boolean;
  showStats?: boolean;
}

type SortOption = 'trending' | 'newest' | 'rating' | 'price-low' | 'price-high';
type ViewMode = 'grid' | 'list';

export const ShopGrid: React.FC<ShopGridProps> = ({
  items,
  onItemClick,
  onLike,
  onShare,
  className = '',
  showFilters = true,
  showStats = true,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map(item => item.category))],
    [items]
  );

  const sortedAndFiltered = useMemo(() => {
    let result = items;

    // Filter by category
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case 'trending':
        result = [...result].sort((a, b) => (b.tryOnCount || 0) - (a.tryOnCount || 0));
        break;
      case 'rating':
        result = [...result].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'newest':
        result = [...result].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'price-low':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
    }

    return result;
  }, [items, sortBy, selectedCategory]);

  const totalEngagement = useMemo(
    () => items.reduce((sum, item) => sum + (item.tryOnCount || 0), 0),
    [items]
  );

  const avgRating = useMemo(
    () => items.length > 0 
      ? (items.reduce((sum, item) => sum + (item.averageRating || 0), 0) / items.length).toFixed(1)
      : '0',
    [items]
  );

  return (
    <div className={className}>
      {/* Header Stats */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Fashion Catalog</h2>
          <p className="text-sm text-gray-600">{sortedAndFiltered.length} items</p>
        </div>

        {/* Engagement Stats */}
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalEngagement.toLocaleString()}</div>
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Try-ons
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{avgRating}★</div>
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Avg Rating
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      {showFilters && (
        <div className="mb-8 space-y-4">
          {/* View Mode Toggle & Sort */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            {/* View Mode */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="List view"
              >
                <LayoutList className="h-5 w-5" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:border-primary focus:border-primary focus:outline-none transition-colors"
            >
              <option value="trending">🔥 Trending</option>
              <option value="rating">⭐ Highest Rated</option>
              <option value="newest">✨ Newest</option>
              <option value="price-low">💰 Price: Low to High</option>
              <option value="price-high">💎 Price: High to Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid/List View */}
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-3'
        }
      >
        {sortedAndFiltered.map(item => (
          <CardEnhanced
            key={item.id}
            item={item}
            onClick={() => onItemClick?.(item)}
            onLike={(liked) => onLike?.(item.id, liked)}
            onShare={() => onShare?.(item)}
            showStats={showStats}
            showActions={true}
            className={viewMode === 'list' ? 'flex gap-4 h-24' : ''}
          />
        ))}
      </div>

      {/* Empty State */}
      {sortedAndFiltered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">👗</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
          <p className="text-gray-600">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

export default ShopGrid;
