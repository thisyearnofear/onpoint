# Memory API Integration Guide

This document outlines the integration of Memory Protocol's API to enhance the social aspects of BeOnPoint, enabling cross-platform identity graphs and social activity tracking.

## Overview

The Memory API integration provides:

- **Reward Tracking**: Earn $MEM tokens when users interact with your content
- **Social Activity Tracking**: Track and reward social actions like try-ons, mints, and reactions  
- **Cross-Platform Discovery**: Find users across different platforms
- **Wallet Linking**: Connect wallet addresses to Farcaster identities for rewards

**Note**: User profiles and social identity are handled by Farcaster's SDK. Memory Protocol focuses on rewards and cross-platform data monetization.

## Setup

### 1. Get Memory API Key

1. Visit the [Memory developer dashboard](https://api.memoryproto.co)
2. Create an Organization
3. Generate an API key
4. Add the key to your environment variables:

```bash
NEXT_PUBLIC_MEMORY_API_KEY=your_memory_api_key_here
```

### 2. Install Dependencies

The integration uses existing dependencies:
- `@tanstack/react-query` for data fetching
- `wagmi` for wallet connections
- `@farcaster/miniapp-sdk` for Farcaster integration

## Architecture

### Core Components

#### 1. Memory API Client (`packages/shared-types/src/memory-client.ts`)

```typescript
const memoryClient = new MemoryAPIClient({
  apiKey: process.env.NEXT_PUBLIC_MEMORY_API_KEY,
});

// Get identity graph for a user
const identities = await memoryClient.getIdentityGraph(walletAddress);
```

#### 2. React Hooks (`apps/web/lib/hooks/useMemoryAPI.ts`)

```typescript
// Simplified - Farcaster handles identity, Memory handles rewards
const { 
  searchUsers,
  linkWallet,
  farcasterUser,
  walletAddress
} = useMemoryAPI();

const { recordTryOn, recordReaction } = useSocialActivities();
```

#### 3. Enhanced Components

- `FarcasterUser`: Lightweight user display using Farcaster SDK data
- `SocialFeed`: Activity feed with integrated discovery
- `VirtualTryOn`: Enhanced with Farcaster sharing and social activity tracking

#### 4. Social Utilities (`apps/web/lib/utils/social.ts`)

```typescript
// Share content with Farcaster integration
await SocialUtils.shareContent({ text: shareText }, farcasterContext);

// Generate activity-specific share text
const shareText = SocialUtils.generateShareText(activity);
```

### Data Flow

1. **User connects wallet** → Fetch identity graph from Memory API
2. **User performs action** (try-on, mint, reaction) → Record social activity
3. **Display social content** → Enrich with cross-platform identity data
4. **User interactions** → Update social stats and distribute rewards

## Features

### Identity Graphs

Users' identities are automatically connected across platforms:

```typescript
interface MemoryIdentity {
  id: string;
  platform: string; // 'farcaster', 'twitter', 'github', 'ens', etc.
  url: string;
  avatar?: string;
  username?: string;
  social?: {
    followers?: number;
    following?: number;
    verified?: boolean;
  };
  sources: MemoryIdentitySource[];
}
```

### Social Activity Tracking

Track user actions for rewards and social features:

```typescript
// Record a try-on activity
recordTryOn(outfitId);

// Record a reaction
recordReaction(targetId, 'fire');

// Record an NFT mint
recordMint(nftId);
```

### Enhanced User Profiles

Profiles show comprehensive social data:

- Cross-platform follower counts
- Verified status across platforms
- BeOnPoint-specific stats (try-ons, mints, reactions)
- Platform badges with verification indicators

### Social Discovery

Find users across platforms:

```typescript
const results = await searchUsers.mutateAsync({
  platform: 'farcaster',
  query: 'username',
});
```

## Integration Points

### 1. Virtual Try-On Component

Enhanced to track social activities:

```typescript
const handleTryOnDesign = useCallback(async () => {
  const outfitId = `outfit-${Date.now()}`;
  recordTryOn(outfitId); // Track social activity
  await enhanceTryOn(outfitItems);
}, [recordTryOn]);
```

### 2. Farcaster Integration

Leverages existing Farcaster connection:

```typescript
const { context } = useMiniApp();
const farcasterFid = context?.user?.fid;

// Automatically included in identity graph
```

### 3. Social Feed

Activities are enriched with identity data:

```typescript
// Use Farcaster's built-in user data
<FarcasterUser fid={activity.userId} compact />
```

## API Endpoints

### Identity Graph
- `GET /identity/{identifier}` - Get identity graph for user
- `POST /identity/batch` - Get multiple identity graphs
- `POST /identity/link` - Link new identity (requires verification)

### Search
- `GET /search?platform={platform}&q={query}` - Search users by platform

## Monetization Integration

The Memory Protocol includes built-in monetization:

- Users earn $MEM tokens when their data is queried
- Consumer apps pay fees in $MEM for API access
- Automatic fee distribution to data providers
- Weekly rewards through on-chain Merkle Tree distributor

## Privacy & Security

- Public data is automatically indexed (Twitter, Farcaster follows/posts)
- Private data requires explicit user upload and consent
- All identity links include source verification
- Users can curate their own identity graphs

## Future Enhancements

### Planned Features

1. **Private Data Upload**: Allow users to upload private social data
2. **Data Curation**: Community-driven data quality assessment
3. **Advanced Analytics**: Deeper social insights and recommendations
4. **Cross-App Integration**: Share identity graphs across dApps
5. **Reputation System**: Build reputation based on social activities

### Integration Opportunities

- **NFT Marketplaces**: Enhanced creator profiles
- **Social Tokens**: Identity-based token distribution
- **DAO Governance**: Cross-platform reputation for voting
- **DeFi Protocols**: Social credit scoring

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify key is correctly set in environment variables
   - Check API key permissions in Memory dashboard

2. **Identity Graph Empty**
   - User may not have public social profiles
   - Try different identifier formats (ENS, wallet address)

3. **Social Activities Not Recording**
   - Check wallet connection status
   - Verify user has completed onboarding

### Debug Mode

Enable debug logging:

```typescript
const memoryClient = new MemoryAPIClient({
  apiKey: process.env.NEXT_PUBLIC_MEMORY_API_KEY,
  debug: true, // Enable debug logging
});
```

## Support

- [Memory Protocol Documentation](https://docs.memoryproto.co)
- [Memory Developer Dashboard](https://api.memoryproto.co)
- [BeOnPoint Discord](https://discord.gg/beonpoint)

## Contributing

To contribute to the Memory API integration:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

See `CONTRIBUTING.md` for detailed guidelines.