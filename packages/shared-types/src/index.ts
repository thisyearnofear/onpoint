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

// Re-export MemoryAPIClient and MemoryUtils
export { MemoryAPIClient, MemoryUtils } from './memory-client';

export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outfit {
  id: string;
  name: string;
  items: Item[];
  createdAt: Date;
  updatedAt: Date;
  // Enhanced with social data
  creator?: EnhancedUserProfile;
  reactions?: SocialReaction[];
  mintCount?: number;
  tryOnCount?: number;
}

export interface Critique {
  id: string;
  outfitId: string;
  feedback: string;
  rating: number;
  createdAt: Date;
  // Enhanced with social identity
  critic?: EnhancedUserProfile;
}