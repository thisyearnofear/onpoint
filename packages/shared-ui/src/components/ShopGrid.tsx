'use client';

import React, { useState, useMemo, useRef } from 'react';
import type { FashionItem } from '@onpoint/shared-types';
import { CardEnhanced } from './CardEnhanced';
import { LayoutGrid, LayoutList, Zap, Star, Search } from 'lucide-react';

/**
 * Smart Shop Grid Component
 * 
 * Responsive, mobile-optimized grid with:
 * - Native CSS Grid (desktop) + horizontal carousel (mobile)
 * - Smart sorting (trending, newest, highest-rated)
 * - Category filtering
 * - Touch-friendly interactions
 * - Engagement metrics aggregation
 * - Progressive enhancement (carousel graceful fallback)
 */

interface ShopGridProps {
  items: FashionItem[];
  onItemClick?: (item: FashionItem) => void;
  onLike?: (itemId: string, liked: boolean) => void;
  onShare?: (item: FashionItem) => void;
  className?: string;
  showFilters?: boolean;
  showStats?: boolean;
  enableMobileCarousel?: boolean; // Use horizontal swipe on mobile
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
  enableMobileCarousel = true,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isMobileCarousel, setIsMobileCarousel] = useState(false);

  const categories = useMemo(
    () => [...new Set(items?.map(item => item.category)?.filter(Boolean) || [])],
    [items]
  );

  const sortedAndFiltered = useMemo(() => {
    let result = items || [];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item?.name?.toLowerCase().includes(q) ||
        item?.description?.toLowerCase().includes(q) ||
        item?.category?.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(item => item?.category === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case 'trending':
        result = [...result].sort((a, b) => (b?.tryOnCount || 0) - (a?.tryOnCount || 0));
        break;
      case 'rating':
        result = [...result].sort((a, b) => (b?.averageRating || 0) - (a?.averageRating || 0));
        break;
      case 'newest':
        result = [...result].sort((a, b) => 
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        );
        break;
      case 'price-low':
        result = [...result].sort((a, b) => (a?.price || 0) - (b?.price || 0));
        break;
      case 'price-high':
        result = [...result].sort((a, b) => (b?.price || 0) - (a?.price || 0));
        break;
    }

    return result;
  }, [items, sortBy, selectedCategory, searchQuery]);

  const totalEngagement = useMemo(
    () => (items || []).reduce((sum, item) => sum + (item?.tryOnCount || 0), 0),
    [items]
  );

  const avgRating = useMemo(
    () => (items || []).length > 0 
      ? ((items || []).reduce((sum, item) => sum + (item?.averageRating || 0), 0) / (items || []).length).toFixed(1)
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
              <Star className="h-3 w-3" />
              Avg Rating
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      {showFilters && (
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, style, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none transition-colors"
            />
          </div>

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

      {/* Grid/Carousel/List View Container */}
      {/* Mobile carousel: horizontal snap scroll on mobile, grid on desktop */}
      {enableMobileCarousel ? (
        <div
          ref={carouselRef}
          className="
            w-full overflow-x-auto snap-x snap-mandatory scroll-smooth
            md:overflow-visible md:snap-none
            -mx-4 px-4
            [&::-webkit-scrollbar]:h-1.5
            [&::-webkit-scrollbar-track]:bg-gray-100
            [&::-webkit-scrollbar-thumb]:bg-gray-400
            [&::-webkit-scrollbar-thumb]:rounded-full
          "
        >
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-cols-[minmax(280px,1fr)] md:auto-cols-auto'
                : 'flex flex-col space-y-3'
            }
            style={
              viewMode === 'grid' && enableMobileCarousel
                ? {
                    display: 'grid',
                    gridAutoFlow: 'column',
                    gridAutoColumns: 'minmax(min(100%, 280px), 1fr)',
                    gap: '1.5rem',
                  }
                : undefined
            }
          >
            {sortedAndFiltered.map(item => (
              <div
                key={item.id}
                className="snap-start snap-always md:snap-none"
              >
                <CardEnhanced
                  item={item}
                  onClick={() => onItemClick?.(item)}
                  onLike={(liked) => onLike?.(item.id, liked)}
                  onShare={() => onShare?.(item)}
                  showStats={showStats}
                  showActions={true}
                  variant="enhanced"
                  className={viewMode === 'list' ? 'flex gap-4 h-24' : ''}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
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
              variant="enhanced"
              className={viewMode === 'list' ? 'flex gap-4 h-24' : ''}
            />
          ))}
        </div>
      )}

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
