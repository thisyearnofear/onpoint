// Shared types for the OnPoint application

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

// Re-export Memory API types
export * from './memory';
export * from './memory-client';