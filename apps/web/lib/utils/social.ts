// Social utility functions for BeOnPoint
import { SocialActivity } from '@onpoint/shared-types';

export interface ShareOptions {
    text: string;
    url?: string;
    imageUrl?: string;
    /** Base64 data URL or blob URL of a capture image to upload & embed */
    imageDataUrl?: string;
}

export class SocialUtils {
    /**
     * Upload a capture image via /api/social/upload (IPFS + Neynar).
     * Returns the Neynar-hosted URL (fast OG previews) and IPFS URL (permanent).
     */
    static async uploadCaptureImage(imageDataUrl: string): Promise<{ url: string; ipfsUrl?: string; ipfsCid?: string } | null> {
        try {
            const blob = await (await fetch(imageDataUrl)).blob();
            const file = new File([blob], 'style-capture.jpg', { type: blob.type || 'image/jpeg' });
            const formData = new FormData();
            formData.append('image', file);

            const res = await fetch('/api/social/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                console.error('Image upload failed:', await res.text());
                return null;
            }

            return res.json();
        } catch (err) {
            console.error('Image upload error:', err);
            return null;
        }
    }

    /**
     * Share content to Farcaster with optional image embed.
     *
     * Flow:
     * 1. If imageDataUrl provided, upload to IPFS + Neynar first
     * 2. If in Farcaster mini-app, publish via API with image embed
     * 3. Otherwise, open Farcaster compose URL with image embed
     * 4. Final fallback: copy text to clipboard
     */
    static async shareContent(options: ShareOptions, farcasterContext?: any): Promise<boolean> {
        try {
            // Upload capture image if provided
            let embeds: string[] = [];
            if (options.imageDataUrl) {
                const uploaded = await this.uploadCaptureImage(options.imageDataUrl);
                if (uploaded?.url) {
                    embeds.push(uploaded.url);
                }
            }
            if (options.imageUrl) {
                embeds.push(options.imageUrl);
            }

            if (farcasterContext?.client && farcasterContext?.user?.fid) {
                // In-app: publish via API with image embeds
                const response = await fetch('/api/social/cast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signerUuid: farcasterContext.user.fid.toString(),
                        text: options.text,
                        embeds: embeds.length > 0 ? embeds : undefined,
                    }),
                });

                if (response.ok) {
                    return true;
                }
                console.error('Failed to post to Farcaster:', await response.text());
            }

            // External: open Farcaster compose URL with embeds
            const composeUrl = this.buildComposeUrl(options.text, embeds, options.url);
            window.open(composeUrl, '_blank');
            return true;
        } catch (error) {
            console.error('Share failed:', error);
            try {
                const shareText = options.url ? `${options.text} ${options.url}` : options.text;
                await navigator.clipboard.writeText(shareText);
                return true;
            } catch (clipboardError) {
                console.error('Clipboard fallback failed:', clipboardError);
                return false;
            }
        }
    }

    /**
     * Build a Farcaster compose URL with text and optional embeds.
     */
    private static buildComposeUrl(text: string, embeds: string[], fallbackUrl?: string): string {
        let url = `https://farcaster.com/~/compose?text=${encodeURIComponent(text)}`;
        if (embeds.length > 0) {
            for (const embed of embeds) {
                url += `&embeds[]=${encodeURIComponent(embed)}`;
            }
        } else if (fallbackUrl) {
            url += `&embeds[]=${encodeURIComponent(fallbackUrl)}`;
        }
        return url;
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