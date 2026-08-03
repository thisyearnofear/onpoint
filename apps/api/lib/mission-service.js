/**
 * Mission Service — Gamified Style Challenges
 *
 * Directs user behavior toward valuable features in a fun, rewarding way.
 *
 * State is Redis-backed (lib/cache.js) so progress survives restarts and is
 * consistent across instances. Previously this was a per-process Map that
 * silently reset on every redeploy — fine for a single dev instance, broken
 * for any multi-instance / serverless deploy. Reads/writes are async; the
 * thin route wrapper (agent-missions.js) awaits them.
 *
 * Usage: require('../lib/mission-service')
 */

// ── Mission Definitions ──

const MISSIONS = [
  // Explorer Missions
  {
    id: 'first-session',
    title: 'First Steps',
    description: 'Complete your first Live AR styling session',
    category: 'explorer',
    icon: 'Sparkles',
    reward: { type: 'xp', value: 50 },
    requirements: [{ type: 'session-complete' }],
    maxProgress: 1,
  },
  {
    id: 'try-all-personas',
    title: 'Personality Test',
    description: 'Try styling sessions with 3 different personas',
    category: 'explorer',
    icon: 'Users',
    reward: { type: 'xp', value: 100 },
    requirements: [{ type: 'persona-used', threshold: 3 }],
    maxProgress: 1,
  },
  {
    id: 'set-spending-limit',
    title: 'Agent Manager',
    description: 'Set a daily spending limit for your AI agent',
    category: 'explorer',
    icon: 'Shield',
    reward: { type: 'xp', value: 75 },
    requirements: [{ type: 'spending-limit-set' }],
    maxProgress: 1,
  },

  // Stylist Missions
  {
    id: 'miranda-survival',
    title: 'Survival Mode',
    description: 'Get a 7+ score from Miranda Priestly in Critique mode',
    category: 'stylist',
    icon: 'Star',
    reward: { type: 'badge', value: 'miranda-approved' },
    requirements: [
      { type: 'session-complete' },
      { type: 'score-threshold', target: 'miranda', threshold: 7 },
    ],
    maxProgress: 1,
  },
  {
    id: 'style-master',
    title: 'Style Master',
    description: 'Score 9+ in any styling session',
    category: 'stylist',
    icon: 'Crown',
    reward: { type: 'badge', value: 'style-elite' },
    requirements: [{ type: 'score-threshold', threshold: 9 }],
    maxProgress: 1,
  },
  {
    id: 'catalog-explorer',
    title: 'Market Research',
    description: 'Browse items across 3 different categories',
    category: 'stylist',
    icon: 'Search',
    reward: { type: 'xp', value: 60 },
    requirements: [{ type: 'catalog-browse', threshold: 3 }],
    maxProgress: 1,
  },

  // Collector Missions
  {
    id: 'first-mint',
    title: 'Proof of Style',
    description: 'Mint your first Proof of Style NFT on Celo',
    category: 'collector',
    icon: 'Gem',
    reward: { type: 'xp', value: 100 },
    requirements: [{ type: 'mint-count', threshold: 1 }],
    maxProgress: 1,
  },
  {
    id: 'collector-3',
    title: 'The Collector',
    description: 'Mint 3 Proof of Style NFTs on Celo',
    category: 'collector',
    icon: 'Layers',
    reward: { type: 'badge', value: 'collector' },
    requirements: [{ type: 'mint-count', threshold: 3 }],
    maxProgress: 1,
  },

  // Economy Missions
  {
    id: 'first-purchase',
    title: 'Smart Shopper',
    description: 'Complete your first agent-mediated purchase',
    category: 'economy',
    icon: 'ShoppingBag',
    reward: { type: 'xp', value: 75 },
    requirements: [{ type: 'purchase-count', threshold: 1 }],
    maxProgress: 1,
  },

  // Social Missions
  {
    id: 'first-share',
    title: 'Style Ambassador',
    description: 'Share your first Style Report to social media',
    category: 'social',
    icon: 'Share2',
    reward: { type: 'xp', value: 50 },
    requirements: [{ type: 'share-count', threshold: 1 }],
    maxProgress: 1,
  },

  // Web Agent Missions
  {
    id: 'web-explorer',
    title: 'Internet Pioneer',
    description: 'Have your agent find a matching item on the global web',
    category: 'explorer',
    icon: 'Globe',
    reward: { type: 'badge', value: 'web-pioneer' },
    requirements: [{ type: 'external-search-count', threshold: 1 }],
    maxProgress: 1,
  },
];

// ── Redis-backed user state store ──

const { cacheGet, cacheSet } = require('./cache');
const STATE_PREFIX = 'mission:state:';
const STATE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — long-lived gamification
const localStates = new Map();

function pruneLocalStates() {
  const now = Date.now();
  for (const [userId, state] of localStates) {
    if (now - state.lastUpdated > STATE_TTL_MS) localStates.delete(userId);
  }
}
setInterval(pruneLocalStates, 60 * 60 * 1000).unref();

function defaultState(userId) {
  return {
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
}

async function getUserMissionState(userId) {
  const stored = await cacheGet(STATE_PREFIX + userId);
  if (stored) {
    localStates.set(userId, stored);
    return stored;
  }
  const local = localStates.get(userId);
  if (local) return local;
  const state = defaultState(userId);
  localStates.set(userId, state);
  await cacheSet(STATE_PREFIX + userId, state, STATE_TTL_MS);
  return state;
}

async function persistState(state) {
  state.lastUpdated = Date.now();
  localStates.set(state.userId, state);
  await cacheSet(STATE_PREFIX + state.userId, state, STATE_TTL_MS);
  return state;
}

// ── Core Functions ──

function getAllMissions() {
  return MISSIONS.filter((m) => !m.isHidden);
}

function getMissionsByCategory(category) {
  return MISSIONS.filter((m) => m.category === category && !m.isHidden);
}

async function updateMissionProgress(userId, eventType, metadata) {
  const state = await getUserMissionState(userId);
  const updates = [];

  for (const mission of MISSIONS) {
    const progress = state.missions.find((m) => m.missionId === mission.id);
    if (!progress || progress.completed) continue;

    const matchingReq = mission.requirements.find((r) => r.type === eventType);
    if (!matchingReq) continue;

    if (matchingReq.target && metadata?.persona) {
      if (matchingReq.target !== metadata.persona) continue;
    }
    if (matchingReq.threshold && metadata?.score != null) {
      if (eventType === 'score-threshold' && metadata.score < matchingReq.threshold) {
        continue;
      }
    }

    progress.currentProgress = Math.min(progress.currentProgress + 1, mission.maxProgress);

    if (progress.currentProgress >= mission.maxProgress) {
      progress.completed = true;
      progress.completedAt = Date.now();

      if (mission.reward.type === 'xp') {
        state.totalXp += mission.reward.value;
      } else if (mission.reward.type === 'badge') {
        if (!state.badges.includes(mission.reward.value)) {
          state.badges.push(mission.reward.value);
        }
      }
    }

    updates.push({
      missionId: mission.id,
      newProgress: progress.currentProgress,
      completed: progress.completed,
    });
  }

  await persistState(state);
  return updates;
}

async function claimMissionReward(userId, missionId) {
  const state = await getUserMissionState(userId);
  const progress = state.missions.find((m) => m.missionId === missionId);

  if (!progress || !progress.completed || progress.claimedReward) {
    return { success: false };
  }

  progress.claimedReward = true;
  await persistState(state);

  const mission = MISSIONS.find((m) => m.id === missionId);
  return { success: true, reward: mission?.reward };
}

async function getCompletedMissions(userId) {
  const state = await getUserMissionState(userId);
  return state.missions.filter((m) => m.completed);
}

async function getInProgressMissions(userId) {
  const state = await getUserMissionState(userId);
  return state.missions.filter((m) => !m.completed && m.currentProgress > 0);
}

const MissionService = {
  getAllMissions,
  getMissionsByCategory,
  getUserMissionState,
  updateMissionProgress,
  claimMissionReward,
  getCompletedMissions,
  getInProgressMissions,
};

module.exports = { MissionService, MISSIONS };
