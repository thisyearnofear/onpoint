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
import { FashionCategory as FC } from './fashion-category';

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

/**
 * African Pattern Type
 */
interface AfricanPattern {
  name: string;
  origin: string;
  characteristics: string;
  culturalSignificance: string;
  colorPalette: readonly string[];
}

/**
 * African Pattern Library
 * 
 * Cultural pattern data for African-inspired designs
 * Used by AI generator and styling suggestions
 */
export const AFRICAN_PATTERNS: readonly AfricanPattern[] = [
  {
    name: 'Ankara',
    origin: 'West Africa',
    characteristics: 'Vibrant wax prints with bold geometric patterns',
    culturalSignificance: 'Celebratory wear, everyday fashion',
    colorPalette: ['#FF5722', '#FF9800', '#4CAF50', '#2196F3'],
  },
  {
    name: 'Kente',
    origin: 'Ghana (Ashanti)',
    characteristics: 'Woven silk strips with intricate geometric designs',
    culturalSignificance: 'Royalty, special occasions, cultural pride',
    colorPalette: ['#FFD700', '#FF4500', '#008000', '#000080'],
  },
  {
    name: 'Adire',
    origin: 'Yoruba (Nigeria)',
    characteristics: 'Indigo tie-dye with white resist patterns',
    culturalSignificance: 'Traditional craftsmanship, spiritual patterns',
    colorPalette: ['#1A237E', '#FFFFFF', '#5D4037'],
  },
  {
    name: 'Bogolan',
    origin: 'Mali (Bambara)',
    characteristics: 'Mud-cloth with earthy tones and symbolic motifs',
    culturalSignificance: 'Rites of passage, storytelling through patterns',
    colorPalette: ['#5D4037', '#8D6E63', '#FFFFFF', '#3E2723'],
  },
  {
    name: 'Shweshwe',
    origin: 'South Africa',
    characteristics: 'Printed cotton with intricate floral and geometric designs',
    culturalSignificance: 'Traditional attire, cultural identity',
    colorPalette: ['#8E24AA', '#3F51B5', '#009688', '#FFC107'],
  },
];

/**
 * Get African pattern by name
 * @param name - Pattern name
 * @returns African pattern data or undefined
 */
export function getAfricanPatternByName(name: string): AfricanPattern | undefined {
  return AFRICAN_PATTERNS.find(pattern => pattern.name === name);
}

/**
 * Get random African pattern for AI inspiration
 * @returns Random African pattern
 */
export function getRandomAfricanPattern(): AfricanPattern | undefined {
  return AFRICAN_PATTERNS[Math.floor(Math.random() * AFRICAN_PATTERNS.length)];
}
