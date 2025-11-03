// Social utility functions for BeOnPoint
import { SocialActivity } from '@onpoint/shared-types';

export interface ShareOptions {
    text: string;
    url?: string;
    imageUrl?: string;
}

export class SocialUtils {
    /**
     * Share content to Farcaster if in mini app, otherwise fallback to clipboard
     */
    static async shareContent(options: ShareOptions, farcasterContext?: any): Promise<boolean> {
        try {
            if (farcasterContext?.client) {
                // Share to Farcaster feed
                console.log('Sharing to Farcaster:', options);
                // This would integrate with Farcaster's sharing API
                return true;
            } else {
                // Fallback to clipboard
                const shareText = options.url ? `${options.text} ${options.url}` : options.text;
                await navigator.clipboard.writeText(shareText);
                return true;
            }
        } catch (error) {
            console.error('Share failed:', error);
            return false;
        }
    }

    /**
     * Generate share text for different activity types
     */
    static generateShareText(activity: SocialActivity): string {
        switch (activity.type) {
            case 'try_on':
                return `Just tried on ${activity.metadata?.outfitName || 'an amazing look'} with BeOnPoint! 🔥 #BeOnPoint #Fashion #AI`;
            case 'mint':
                return `Minted ${activity.metadata?.nftName || 'a new NFT'} on BeOnPoint! ✨ #BeOnPoint #NFT #Fashion`;
            case 'reaction':
                return `Loving the fashion creativity on BeOnPoint! 💫 #BeOnPoint #Fashion`;
            default:
                return `Creating amazing fashion experiences with BeOnPoint! 🎨 #BeOnPoint #Fashion #AI`;
        }
    }

    /**
     * Format time ago for social activities
     */
    static formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    /**
     * Get platform emoji for display
     */
    static getPlatformEmoji(platform: string): string {
        const emojis: Record<string, string> = {
            farcaster: '🟣',
            twitter: '🐦',
            github: '🐙',
            lens: '🌿',
            ens: '🏷️',
            ethereum: '⟠',
            basenames: '🔵',
        };
        return emojis[platform] || '🔗';
    }

    /**
     * Check if user is in Farcaster mini app
     */
    static isInFarcasterApp(context?: any): boolean {
        return !!(context?.client);
    }
}