/**
 * Mission Service — Gamified Style Challenges
 *
 * Directs user behavior toward valuable features (Agent Economy, Live AR)
 * in a fun, rewarding way. Tracks progress via Redis-backed state.
 *
 * Design: DRY (single source), MODULAR (composable missions), PERFORMANT
 * (Redis with in-memory fallback), ENHANCEMENT FIRST (builds on existing
 * agent-controls infrastructure).
 */

// ── Types ──

export type MissionCategory =
  | "explorer"
  | "stylist"
  | "collector"
  | "economy"
  | "social";

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  icon: string; // Lucide icon name
  reward: {
    type: "xp" | "badge" | "unlock";
    value: number | string;
  };
  requirements: MissionRequirement[];
  maxProgress: number;
  isHidden?: boolean; // Surprise missions
}

export interface MissionRequirement {
  type:
    | "session-complete"
    | "score-threshold"
    | "mint-count"
    | "purchase-count"
    | "spending-limit-set"
    | "catalog-browse"
    | "persona-used"
    | "share-count";
  target?: string; // e.g., persona ID, category
  threshold?: number;
}

export interface UserMissionProgress {
  missionId: string;
  currentProgress: number;
  completed: boolean;
  completedAt?: number;
  claimedReward: boolean;
}

export interface UserMissionState {
  userId: string;
  missions: UserMissionProgress[];
  totalXp: number;
  badges: string[];
  lastUpdated: number;
}

// ── Mission Definitions ──

const MISSIONS: Mission[] = [
  // Explorer Missions
  {
    id: "first-session",
    title: "First Steps",
    description: "Complete your first Live AR styling session",
    category: "explorer",
    icon: "Sparkles",
    reward: { type: "xp", value: 50 },
    requirements: [{ type: "session-complete" }],
    maxProgress: 1,
  },
  {
    id: "try-all-personas",
    title: "Personality Test",
    description: "Try styling sessions with 3 different personas",
    category: "explorer",
    icon: "Users",
    reward: { type: "xp", value: 100 },
    requirements: [{ type: "persona-used", threshold: 3 }],
    maxProgress: 3,
  },
  {
    id: "set-spending-limit",
    title: "Agent Manager",
    description: "Set a daily spending limit for your AI agent",
    category: "explorer",
    icon: "Shield",
    reward: { type: "xp", value: 75 },
    requirements: [{ type: "spending-limit-set" }],
    maxProgress: 1,
  },

  // Stylist Missions
  {
    id: "miranda-survival",
    title: "Survival Mode",
    description: "Get a 7+ score from Miranda Priestly in Critique mode",
    category: "stylist",
    icon: "Star",
    reward: { type: "badge", value: "miranda-approved" },
    requirements: [
      { type: "session-complete" },
      { type: "score-threshold", target: "miranda", threshold: 7 },
    ],
    maxProgress: 1,
  },
  {
    id: "style-master",
    title: "Style Master",
    description: "Score 9+ in any styling session",
    category: "stylist",
    icon: "Crown",
    reward: { type: "badge", value: "style-elite" },
    requirements: [{ type: "score-threshold", threshold: 9 }],
    maxProgress: 1,
  },
  {
    id: "catalog-explorer",
    title: "Market Research",
    description: "Browse items across 3 different categories",
    category: "stylist",
    icon: "Search",
    reward: { type: "xp", value: 60 },
    requirements: [{ type: "catalog-browse", threshold: 3 }],
    maxProgress: 3,
  },

  // Collector Missions
  {
    id: "first-mint",
    title: "Proof of Style",
    description: "Mint your first Proof of Style NFT on Celo",
    category: "collector",
    icon: "Gem",
    reward: { type: "xp", value: 100 },
    requirements: [{ type: "mint-count", threshold: 1 }],
    maxProgress: 1,
  },
  {
    id: "collector-3",
    title: "The Collector",
    description: "Mint 3 Proof of Style NFTs on Celo",
    category: "collector",
    icon: "Layers",
    reward: { type: "badge", value: "collector" },
    requirements: [{ type: "mint-count", threshold: 3 }],
    maxProgress: 3,
  },

  // Economy Missions
  {
    id: "first-purchase",
    title: "Smart Shopper",
    description: "Complete your first agent-mediated purchase",
    category: "economy",
    icon: "ShoppingBag",
    reward: { type: "xp", value: 75 },
    requirements: [{ type: "purchase-count", threshold: 1 }],
    maxProgress: 1,
  },

  // Social Missions
  {
    id: "first-share",
    title: "Style Ambassador",
    description: "Share your first Style Report to social media",
    category: "social",
    icon: "Share2",
    reward: { type: "xp", value: 50 },
    requirements: [{ type: "share-count", threshold: 1 }],
    maxProgress: 1,
  },
];

// ── In-Memory Store (Redis-backed in production) ──

const userStates: Map<string, UserMissionState> = new Map();

// ── Core Functions ──

/**
 * Get all available missions.
 */
export function getAllMissions(): Mission[] {
  return MISSIONS.filter((m) => !m.isHidden);
}

/**
 * Get missions by category.
 */
export function getMissionsByCategory(category: MissionCategory): Mission[] {
  return MISSIONS.filter((m) => m.category === category && !m.isHidden);
}

/**
 * Get user mission state.
 */
export function getUserMissionState(userId: string): UserMissionState {
  if (userStates.has(userId)) {
    return userStates.get(userId)!;
  }

  const state: UserMissionState = {
    userId,
    missions: MISSIONS.map((m) => ({
      missionId: m.id,
      currentProgress: 0,
      completed: false,
      claimedReward: false,
    })),
    totalXp: 0,
    badges: [],
    lastUpdated: Date.now(),
  };

  userStates.set(userId, state);
  return state;
}

/**
 * Update mission progress based on an event.
 */
export function updateMissionProgress(
  userId: string,
  eventType: MissionRequirement["type"],
  metadata?: {
    persona?: string;
    score?: number;
    category?: string;
  },
): { missionId: string; newProgress: number; completed: boolean }[] {
  const state = getUserMissionState(userId);
  const updates: { missionId: string; newProgress: number; completed: boolean }[] = [];

  for (const mission of MISSIONS) {
    const progress = state.missions.find((m) => m.missionId === mission.id);
    if (!progress || progress.completed) continue;

    // Check if this mission has a matching requirement
    const matchingReq = mission.requirements.find((r) => r.type === eventType);
    if (!matchingReq) continue;

    // Validate metadata if needed
    if (matchingReq.target && metadata?.persona) {
      if (matchingReq.target !== metadata.persona) continue;
    }
    if (matchingReq.threshold && metadata?.score != null) {
      if (eventType === "score-threshold" && metadata.score < matchingReq.threshold) {
        continue;
      }
    }

    // Increment progress
    progress.currentProgress = Math.min(
      progress.currentProgress + 1,
      mission.maxProgress,
    );

    // Check completion
    if (progress.currentProgress >= mission.maxProgress) {
      progress.completed = true;
      progress.completedAt = Date.now();

      // Award reward
      if (mission.reward.type === "xp") {
        state.totalXp += mission.reward.value as number;
      } else if (mission.reward.type === "badge") {
        if (!state.badges.includes(mission.reward.value as string)) {
          state.badges.push(mission.reward.value as string);
        }
      }
    }

    updates.push({
      missionId: mission.id,
      newProgress: progress.currentProgress,
      completed: progress.completed,
    });
  }

  state.lastUpdated = Date.now();
  userStates.set(userId, state);
  return updates;
}

/**
 * Claim a mission reward.
 */
export function claimMissionReward(
  userId: string,
  missionId: string,
): { success: boolean; reward?: Mission["reward"] } {
  const state = getUserMissionState(userId);
  const progress = state.missions.find((m) => m.missionId === missionId);

  if (!progress || !progress.completed || progress.claimedReward) {
    return { success: false };
  }

  progress.claimedReward = true;
  state.lastUpdated = Date.now();
  userStates.set(userId, state);

  const mission = MISSIONS.find((m) => m.id === missionId);
  return { success: true, reward: mission?.reward };
}

/**
 * Get completed missions for a user.
 */
export function getCompletedMissions(userId: string): UserMissionProgress[] {
  const state = getUserMissionState(userId);
  return state.missions.filter((m) => m.completed);
}

/**
 * Get in-progress missions for a user.
 */
export function getInProgressMissions(userId: string): UserMissionProgress[] {
  const state = getUserMissionState(userId);
  return state.missions.filter((m) => !m.completed && m.currentProgress > 0);
}

/**
 * Get user's total XP.
 */
export function getUserXp(userId: string): number {
  const state = getUserMissionState(userId);
  return state.totalXp;
}

/**
 * Get user's badges.
 */
export function getUserBadges(userId: string): string[] {
  const state = getUserMissionState(userId);
  return state.badges;
}

// ── Exports ──

export const MissionService = {
  getAllMissions,
  getMissionsByCategory,
  getUserMissionState,
  updateMissionProgress,
  claimMissionReward,
  getCompletedMissions,
  getInProgressMissions,
  getUserXp,
  getUserBadges,
};