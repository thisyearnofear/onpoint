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

// Import fashion category for type usage
import { FashionCategory } from './fashion-category';

// Re-export all types from memory module
export * from './memory';

// Re-export MemoryAPIClient and MemoryUtils
export { MemoryAPIClient, MemoryUtils } from './memory-client';

// Re-export fashion category enum
export { FashionCategory } from './fashion-category';

// Re-export wallet adapter
export * from './wallet-adapter';

// Re-export fashion data and utilities
export * from './fashion-data';

// Re-export market intelligence signal types
export * from './market-intelligence';

// Re-export x402 payment protocol builders
export * from './x402';

// ============ Fashion Domain Types ============

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

// Re-export Curator types (ADR 0002)
export * from './curator';

// Legacy types - kept for backward compatibility
export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
