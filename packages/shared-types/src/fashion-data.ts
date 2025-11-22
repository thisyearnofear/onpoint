/**
 * Fashion Data Source
 * 
 * Centralized, type-safe fashion item definitions
 * Modeled after astro-shop's clean data pattern
 * 
 * This is the single source of truth for:
 * - Product catalog
 * - Styling canvas items
 * - NFT metadata
 * - Virtual try-on references
 */

import type { FashionItem, FashionCategory } from './index';
import { FashionCategory as FC } from './index';

/**
 * Core styling canvas items - these are the draggable items in InteractiveStylingCanvas
 */
export const CANVAS_ITEMS: FashionItem[] = [
  {
    id: '1',
    slug: 't-705-shirt-brave',
    name: 'Ratphex-T',
    description: 'Bold graphic tee with streetwear aesthetic',
    price: 129,
    category: FC.Shirts,
    cover: '/assets/1Product.png',
    productSrc: '/assets/1Product.png',
    modelSrc: '/assets/1Model.png',
    modelSize: 'L',
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.5,
  },
  {
    id: '2',
    slug: 'ratward-scissor-t',
    name: 'RatwardScissor-T',
    description: 'Minimalist geometric design with clean lines',
    price: 99,
    category: FC.Shirts,
    cover: '/assets/2Product.png',
    productSrc: '/assets/2Product.png',
    modelSrc: '/assets/2Model.png',
    modelSize: 'XL',
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.2,
  },
  {
    id: '3',
    slug: 'animal-collective-t',
    name: 'AnimalCollective-T',
    description: 'Vintage-inspired animal graphics on premium cotton',
    price: 79,
    category: FC.Shirts,
    cover: '/assets/3Product.png',
    productSrc: '/assets/3Product.png',
    modelSrc: '/assets/3Model.png',
    modelSize: 'S',
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.8,
  },
];

/**
 * Get a fashion item by ID
 * @param id - Fashion item ID
 * @returns Fashion item or undefined
 */
export function getFashionItemById(id: string): FashionItem | undefined {
  return CANVAS_ITEMS.find(item => item.id === id);
}

/**
 * Get a fashion item by slug (for URL routing)
 * @param slug - URL-friendly identifier
 * @returns Fashion item or undefined
 */
export function getFashionItemBySlug(slug: string): FashionItem | undefined {
  return CANVAS_ITEMS.find(item => item.slug === slug);
}

/**
 * Get all fashion items in a category
 * @param category - Fashion category
 * @returns Array of fashion items
 */
export function getFashionItemsByCategory(category: FashionCategory): FashionItem[] {
  return CANVAS_ITEMS.filter(item => item.category === category);
}

/**
 * Get transition name for View Transitions API
 * Unique per item to enable smooth morphing between views
 * 
 * @param itemId - Fashion item ID
 * @param element - What element to transition (image, title, price, etc)
 * @returns Transition name string
 */
export function getTransitionName(itemId: string, element: 'image' | 'title' | 'description' | 'price'): string {
  return `fashion-item-${itemId}-${element}`;
}

/**
 * Get all canvas items sorted by category
 */
export function getCanvasItemsByCategory(): Record<string, FashionItem[]> {
   const grouped: Record<string, FashionItem[]> = {};
   
   CANVAS_ITEMS.forEach(item => {
     if (!grouped[item.category]) {
       grouped[item.category] = [];
     }
     grouped[item.category]!.push(item);
   });
   
   return grouped;
}
