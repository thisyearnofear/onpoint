// Shared types for the OnPoint application

// Import specific types from memory module
import {
  EnhancedUserProfile,
  SocialReaction,
  MemoryIdentitySource,
  MemorySocialStats,
  MemoryIdentity,
  MemoryIdentityGraph,
  MemoryUser,
  SocialActivity
} from './memory';

// Import MemoryAPIClient and MemoryUtils from memory-client module
import { MemoryAPIClient, MemoryUtils } from './memory-client';

// Re-export all types from memory module
export * from './memory';


/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}
=======

/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}
=======

/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}

// Re-export fashion data and utilities
export * from './fashion-data';
=======
// Re-export MemoryAPIClient and MemoryUtils
export { MemoryAPIClient, MemoryUtils } from './memory-client';

// Re-export fashion category enum
export { FashionCategory } from './fashion-category';

// Re-export fashion data and utilities
export * from './fashion-data';============

/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}

// Re-export fashion data and utilities
export * from './fashion-data';============

/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}============

/**
 * Product categories - modeled after astro-shop pattern
 */
export enum FashionCategory {
  Shirts = "shirts",
  Pants = "pants",
  Shoes = "shoes",
  Accessories = "accessories",
  Outerwear = "outerwear",
  Dresses = "dresses",
}

import { FashionCategory } from './fashion-category';

/**
 * Core fashion item with transition metadata
 * Single source of truth for all fashion product data
 */
export interface FashionItem {
  // Identifiers
  id: string;
  slug: string; // URL-friendly identifier for transitions
  
  // Display data
  name: string;
  description: string;
  price: number;
  category: FashionCategory;
  
  // Media - includes transition names for View Transitions API
  cover: string;
  coverCredits?: string;
  productImages?: string[]; // Multiple product views
  modelImages?: string[]; // Model wear views
  
  // Styling canvas specific
  productSrc?: string; // Primary product image for canvas
  modelSrc?: string; // Model image for canvas
  modelSize?: string; // Size worn by model
  modelHeight?: string; // Model height for reference
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Blockchain/NFT integration
  contractAddress?: string;
  tokenId?: string;
  
  // Social engagement
  tryOnCount?: number;
  mintCount?: number;
  averageRating?: number;
}

/**
 * Outfit composition - group of FashionItems
 */
export interface Outfit {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  items: FashionItem[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Enhanced with social data
  creator?: EnhancedUserProfile;
  reactions?: SocialReaction[];
  mintCount?: number;
  tryOnCount?: number;
  averageRating?: number;
}

/**
 * AI-generated critique/feedback
 */
export interface Critique {
  id: string;
  outfitId: string;
  feedback: string;
  rating: number;
  createdAt: Date;
  // Enhanced with social identity
  critic?: EnhancedUserProfile;
}

// Legacy types - kept for backward compatibility
export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}