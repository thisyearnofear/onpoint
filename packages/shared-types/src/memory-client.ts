// Memory API client for identity graph and social data
import { MemoryIdentity } from './memory';

export interface MemoryAPIConfig {
    apiKey: string;
    baseUrl?: string;
}

export class MemoryAPIClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(config: MemoryAPIConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.memoryproto.co';
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`Memory API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get identity graph for a user by wallet address, ENS, or Farcaster username
     */
    async getIdentityGraph(identifier: string): Promise<MemoryIdentity[]> {
        return this.request<MemoryIdentity[]>(`/identity/${encodeURIComponent(identifier)}`);
    }

    /**
     * Get identity graph for multiple users at once
     */
    async getBatchIdentityGraphs(identifiers: string[]): Promise<Record<string, MemoryIdentity[]>> {
        return this.request<Record<string, MemoryIdentity[]>>('/identity/batch', {
            method: 'POST',
            body: JSON.stringify({ identifiers }),
        });
    }

    /**
     * Link a new identity to an existing user (requires verification)
     */
    async linkIdentity(
        primaryIdentifier: string,
        newIdentity: { platform: string; id: string; proof?: string }
    ): Promise<{ success: boolean; verificationRequired?: boolean }> {
        return this.request<{ success: boolean; verificationRequired?: boolean }>('/identity/link', {
            method: 'POST',
            body: JSON.stringify({
                primaryIdentifier,
                newIdentity,
            }),
        });
    }

    /**
     * Search for users by platform and username
     */
    async searchUsers(platform: string, query: string): Promise<MemoryIdentity[]> {
        return this.request<MemoryIdentity[]>(
            `/search?platform=${encodeURIComponent(platform)}&q=${encodeURIComponent(query)}`
        );
    }
}

// Utility functions for working with identity graphs
export class MemoryUtils {
    /**
     * Extract social stats from identity graph
     */
    static extractSocialStats(identities: MemoryIdentity[]) {
        let totalFollowers = 0;
        let totalFollowing = 0;
        let crossPlatformVerified = false;
        const platforms = new Set<string>();

        for (const identity of identities) {
            platforms.add(identity.platform);

            if (identity.social) {
                totalFollowers += identity.social.followers || 0;
                totalFollowing += identity.social.following || 0;

                if (identity.social.verified) {
                    crossPlatformVerified = true;
                }
            }
        }

        return {
            totalFollowers,
            totalFollowing,
            crossPlatformVerified,
            platforms: Array.from(platforms),
        };
    }

    /**
     * Get primary identity for a platform
     */
    static getPrimaryIdentity(identities: MemoryIdentity[], platform: string): MemoryIdentity | null {
        return identities.find(id => id.platform === platform) || null;
    }

    /**
     * Get best avatar from identity graph
     */
    static getBestAvatar(identities: MemoryIdentity[]): string | null {
        // Priority: Farcaster > Twitter > GitHub > ENS > others
        const priorityOrder = ['farcaster', 'twitter', 'github', 'ens'];

        for (const platform of priorityOrder) {
            const identity = identities.find(id => id.platform === platform && id.avatar);
            if (identity?.avatar) {
                return identity.avatar;
            }
        }

        // Fallback to any avatar
        const withAvatar = identities.find(id => id.avatar);
        return withAvatar?.avatar || null;
    }

    /**
     * Get best username from identity graph
     */
    static getBestUsername(identities: MemoryIdentity[]): string | null {
        // Priority: Farcaster > Twitter > GitHub > others
        const priorityOrder = ['farcaster', 'twitter', 'github'];

        for (const platform of priorityOrder) {
            const identity = identities.find(id => id.platform === platform && id.username);
            if (identity?.username) {
                return identity.username;
            }
        }

        // Fallback to any username
        const withUsername = identities.find(id => id.username);
        return withUsername?.username || null;
    }
}