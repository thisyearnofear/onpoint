import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY || '',
});

export const neynarClient = new NeynarAPIClient(config);

/**
 * Social utilities powered by Neynar API
 */
export class NeynarSocialUtils {
  /**
   * Create a managed signer via Neynar REST API.
   * Returns signer_uuid and signer_approval_url
   */
  static async createManagedSigner() {
    try {
      const apiKey = process.env.NEYNAR_API_KEY || '';
      const res = await fetch('https://api.neynar.com/v2/farcaster/signer/', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
      });
      if (!res.ok) {
        throw new Error(`Create signer failed: ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Failed to create managed signer:', error);
      return null;
    }
  }
  /**
   * Get user's feed with their following activity
   */
  static async getUserFeed(fid: number, limit = 25) {
    try {
      const feed = await neynarClient.fetchFeed({
        feedType: 'following',
        fid,
        limit,
      });
      return feed;
    } catch (error) {
      console.error('Failed to fetch user feed:', error);
      return null;
    }
  }

  /**
   * Get user's profile data
   */
  static async getUserProfile(fid: number) {
    try {
      const response = await neynarClient.fetchBulkUsers({ fids: [fid] });
      return response.users?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }

  /**
   * Get user's followers and following
   */
  static async getUserSocialStats(fid: number) {
    try {
      const [followers, following] = await Promise.all([
        neynarClient.fetchUserFollowers({ fid, limit: 100 }),
        neynarClient.fetchUserFollowing({ fid, limit: 100 }),
      ]);

      return {
        followersCount: followers?.users?.length || 0,
        followingCount: following?.users?.length || 0,
        followers: followers?.users || [],
        following: following?.users || [],
      };
    } catch (error) {
      console.error('Failed to fetch user social stats:', error);
      return {
        followersCount: 0,
        followingCount: 0,
        followers: [],
        following: [],
      };
    }
  }

  /**
   * Publish a cast (post) to Farcaster - TODO: Implement with proper signer setup
   */
  static async publishCast(signerUuid: string, options: {
    text: string;
    embeds?: Array<{ url: string }>;
    parent?: string;
  }) {
    try {
      const result = await neynarClient.publishCast({
        signerUuid,
        text: options.text,
        embeds: options.embeds,
        parent: options.parent,
      } as any);
      return result;
    } catch (error) {
      console.error('Failed to publish cast:', error);
      throw error;
    }
  }

  /**
   * React to a cast (like/recast) - TODO: Implement when needed
   */
  static async reactToCast(signerUuid: string, castHash: string, reaction: 'like' | 'recast') {
    try {
      const result = await neynarClient.publishReaction({
        signerUuid,
        reactionType: reaction,
        target: castHash,
      } as any);
      return result;
    } catch (error) {
      console.error('Failed to publish reaction:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user - TODO: Implement when needed
   */
  static async getNotifications(fid: number, limit = 50) {
    try {
      const result = await neynarClient.fetchAllNotifications({ fid, limit } as any);
      return result?.notifications || [];
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  /**
   * Search for users by username or display name - TODO: Implement with correct method
   */
  static async searchUsers(query: string, limit = 20) {
    try {
      const result = await neynarClient.searchUser({ q: query, limit } as any);
      return result;
    } catch (error) {
      console.error('Failed to search users:', error);
      return { users: [] } as any;
    }
  }

  /**
   * Get trending casts
   */
  static async getTrendingCasts(limit = 25) {
    try {
      const casts = await neynarClient.fetchFeed({
        feedType: 'filter',
        filterType: 'global_trending',
        limit,
      });
      return casts;
    } catch (error) {
      console.error('Failed to fetch trending casts:', error);
      return null;
    }
  }
}
