/**
 * Agent Reputation System - OWS Hackathon Track 2: Spend Governance
 *
 * Tracks agent reputation to dynamically adjust spending limits.
 *
 * Spend Tiers:
 * - New agent: $5/day limit
 * - Established: $500/day
 * - Premium: $5000/day
 *
 * Reputation is earned from:
 * - Transaction count
 * - Total volume
 * - Success rate
 * - Account age
 */

import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger";

export interface AgentReputation {
  walletAddress: string;
  score: number;
  tier: "new" | "established" | "premium";
  transactionCount: number;
  totalVolume: number;
  successRate: number;
  accountAge: number;
  lastActive: number;
  createdAt: number;
}

export interface ReputationConfig {
  newAgentLimit: number;
  establishedLimit: number;
  premiumLimit: number;
  minTransactionsForEstablished: number;
  minVolumeForEstablished: number;
  minSuccessRate: number;
}

export const REPUTATION_CONFIG: ReputationConfig = {
  newAgentLimit: 5,
  establishedLimit: 500,
  premiumLimit: 5000,
  minTransactionsForEstablished: 10,
  minVolumeForEstablished: 100,
  minSuccessRate: 0.9,
};

const REDIS_KEY_PREFIX = "ow:agent:reputation:";

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url.includes("your-") || token.includes("your-")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production",
      );
    }

    logger.warn("Upstash Redis not configured; using in-memory fallback", {
      component: "agent-reputation",
    });
    return null;
  }

  return new Redis({ url, token });
}

// In-memory fallback for development
const memoryStore = new Map<string, AgentReputation>();

export class AgentReputationService {
  private redis: Redis | null = null;

  constructor() {
    this.redis = getRedisClient();
  }

  private getKey(walletAddress: string): string {
    return `${REDIS_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  }

  async getReputation(walletAddress: string): Promise<AgentReputation | null> {
    if (this.redis) {
      const key = this.getKey(walletAddress);
      const data = await this.redis.get<AgentReputation>(key);
      return data;
    }
    return memoryStore.get(this.getKey(walletAddress)) || null;
  }

  async initializeAgent(walletAddress: string): Promise<AgentReputation> {
    const now = Date.now();
    const reputation: AgentReputation = {
      walletAddress: walletAddress.toLowerCase(),
      score: 0,
      tier: "new",
      transactionCount: 0,
      totalVolume: 0,
      successRate: 1,
      accountAge: 0,
      lastActive: now,
      createdAt: now,
    };

    if (this.redis) {
      await this.redis.set(this.getKey(walletAddress), reputation);
    } else {
      memoryStore.set(this.getKey(walletAddress), reputation);
    }

    return reputation;
  }

  async recordTransaction(
    walletAddress: string,
    amount: number,
    success: boolean,
  ): Promise<AgentReputation> {
    const reputation =
      (await this.getReputation(walletAddress)) ||
      (await this.initializeAgent(walletAddress));

    const now = Date.now();
    const successIncrement = success ? 1 : 0;
    const totalAttempts = reputation.transactionCount + 1;

    // Update metrics
    reputation.transactionCount = totalAttempts;
    reputation.totalVolume += amount;
    reputation.successRate =
      (reputation.successRate * (totalAttempts - 1) + successIncrement) /
      totalAttempts;
    reputation.accountAge = now - reputation.createdAt;
    reputation.lastActive = now;

    // Calculate score
    reputation.score = this.calculateScore(reputation);

    // Update tier based on thresholds
    if (
      reputation.transactionCount >=
        REPUTATION_CONFIG.minTransactionsForEstablished &&
      reputation.totalVolume >= REPUTATION_CONFIG.minVolumeForEstablished &&
      reputation.successRate >= REPUTATION_CONFIG.minSuccessRate
    ) {
      reputation.tier =
        reputation.totalVolume > 1000 ? "premium" : "established";
    } else {
      reputation.tier = "new";
    }

    // Persist
    if (this.redis) {
      await this.redis.set(this.getKey(walletAddress), reputation);
    } else {
      memoryStore.set(this.getKey(walletAddress), reputation);
    }

    return reputation;
  }

  private calculateScore(reputation: AgentReputation): number {
    const now = Date.now();
    const ageHours = (now - reputation.createdAt) / (1000 * 60 * 60);

    const volumeScore = Math.log10(Math.max(reputation.totalVolume, 1)) * 20;
    const transactionScore = Math.log10(reputation.transactionCount + 1) * 15;
    const successScore = reputation.successRate * 30;
    const ageScore = Math.min(ageHours / 24, 30);

    return Math.round(volumeScore + transactionScore + successScore + ageScore);
  }

  async getSpendLimit(walletAddress: string): Promise<number> {
    const reputation = await this.getReputation(walletAddress);
    if (!reputation) return REPUTATION_CONFIG.newAgentLimit;

    switch (reputation.tier) {
      case "premium":
        return REPUTATION_CONFIG.premiumLimit;
      case "established":
        return REPUTATION_CONFIG.establishedLimit;
      default:
        return REPUTATION_CONFIG.newAgentLimit;
    }
  }

  async getLeaderboard(limit: number = 10): Promise<AgentReputation[]> {
    if (this.redis) {
      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      const results: AgentReputation[] = [];

      for (const key of keys.slice(0, 50)) {
        const data = await this.redis.get<AgentReputation>(key);
        if (data) results.push(data);
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    return Array.from(memoryStore.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const agentReputation = new AgentReputationService();
