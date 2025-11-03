import { useMutation } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import {
    MemoryAPIClient,
    SocialActivity
} from '@onpoint/shared-types';

// Initialize Memory API client
const memoryClient = new MemoryAPIClient({
    apiKey: process.env.NEXT_PUBLIC_MEMORY_API_KEY || '',
});

export function useMemoryAPI(): {
    searchUsers: any;
    linkWallet: any;
    farcasterUser: any;
    walletAddress: string | undefined;
} {
    const { address } = useAccount();
    const { context } = useMiniApp();

    // Simplified - focus on Memory Protocol rewards and cross-platform data
    // Farcaster SDK handles user identity and social features

    // Search users by platform (for discovery)
    const searchUsers = useMutation({
        mutationFn: async ({ platform, query }: { platform: string; query: string }) => {
            if (platform === 'farcaster') {
                // Use Neynar for Farcaster search
                const response = await fetch(`/api/social/search?q=${encodeURIComponent(query)}&limit=10`);
                if (!response.ok) {
                    throw new Error('Failed to search users');
                }
                const data = await response.json();
                return data.users || [];
            } else {
                // Fallback to Memory Protocol for other platforms
                return memoryClient.searchUsers(platform, query);
            }
        },
    });

    // Link wallet to Memory Protocol for rewards
    const linkWallet = useMutation({
        mutationFn: async () => {
            if (!address || !context?.user?.fid) return null;

            return memoryClient.linkIdentity(address, {
                platform: 'farcaster',
                id: context.user.fid.toString(),
            });
        },
    });

    return {
        // Mutations
        searchUsers,
        linkWallet,

        // User context from Farcaster
        farcasterUser: context?.user,
        walletAddress: address,
    };
}

// Simplified - Farcaster SDK handles user identity
// Memory API now focused on reward tracking and cross-platform data

// Hook for social activities (this would integrate with your backend)
export function useSocialActivities() {
    const { address } = useAccount();

    const recordActivity = useMutation({
        mutationFn: async (activity: Omit<SocialActivity, 'id' | 'createdAt'>) => {
            const response = await fetch('/api/social/activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(activity),
            });

            if (!response.ok) {
                throw new Error('Failed to record social activity');
            }

            return response.json();
        },
    });

    const recordTryOn = (outfitId: string) =>
        recordActivity.mutate({
            userId: address || '',
            type: 'try_on',
            targetId: outfitId,
        });

    const recordMint = (nftId: string) =>
        recordActivity.mutate({
            userId: address || '',
            type: 'mint',
            targetId: nftId,
        });

    const recordReaction = (targetId: string, reactionType: string) =>
        recordActivity.mutate({
            userId: address || '',
            type: 'reaction',
            targetId,
            metadata: { reactionType },
        });

    return {
        recordActivity,
        recordTryOn,
        recordMint,
        recordReaction,
    };
}