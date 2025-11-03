// Memory API types for social identity integration

export interface MemoryIdentitySource {
    id: string;
    platform: string;
    verified: boolean;
}

export interface MemorySocialStats {
    followers?: number;
    following?: number;
    verified?: boolean | null;
}

export interface MemoryIdentity {
    id: string;
    platform: string;
    url: string;
    avatar?: string | null;
    username?: string | null;
    social?: MemorySocialStats | null;
    sources: MemoryIdentitySource[];
}

export interface MemoryIdentityGraph {
    identities: MemoryIdentity[];
    totalIdentities: number;
    platforms: string[];
}

export interface MemoryUser {
    walletAddress: string;
    identityGraph: MemoryIdentityGraph;
    lastUpdated: Date;
}

// Social activity types for Memory integration
export interface SocialActivity {
    id: string;
    userId: string;
    type: 'try_on' | 'mint' | 'reaction' | 'share' | 'follow' | 'cast';
    targetId: string; // outfit ID, NFT ID, etc.
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface SocialReaction {
    id: string;
    userId: string;
    targetId: string;
    targetType: 'outfit' | 'nft' | 'user';
    reactionType: 'like' | 'love' | 'fire' | 'star';
    createdAt: Date;
}

export interface EnhancedUserProfile {
    walletAddress: string;
    farcasterFid?: number;
    identityGraph: MemoryIdentityGraph;
    socialStats: {
        totalFollowers: number;
        totalFollowing: number;
        crossPlatformVerified: boolean;
        platforms: string[];
    };
    onPointStats: {
        tryOns: number;
        mints: number;
        reactions: number;
        followers: number;
    };
}