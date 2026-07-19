/**
 * Shared frame rate limiter + analysis prompts.
 *
 * Replaces checkFrameRate / PROMPTS_BY_GOAL duplicated across
 * ai-qwen-analyze.js, ai-venice-analyze.js, ai-zerog-analyze.js.
 *
 * Each provider passes its own keyPrefix and max frames.
 */

const { getRedis } = require('./redis');

/**
 * Check if a client IP is within the frame rate limit.
 * Uses Redis INCR with a sliding window (best-effort — falls back
 * to allow-all if Redis is unavailable).
 *
 * @param {string} clientIp
 * @param {string} keyPrefix — e.g. 'qwen-cloud-frames', 'venice-frames'
 * @param {number} max — max frames per window
 * @param {number} [windowSecs=60] — window size in seconds
 * @returns {Promise<{allowed: boolean, count: number, inMemory?: boolean}>}
 */
async function checkFrameRate(clientIp, keyPrefix, max, windowSecs = 60) {
  const r = getRedis();
  if (!r) return { allowed: true, count: 0, inMemory: true };
  try {
    const key = `${keyPrefix}:${clientIp}`;
    const count = await r.incr(key);
    await r.expire(key, windowSecs);
    if (count > max) {
      return { allowed: false, count: max };
    }
    return { allowed: true, count };
  } catch {
    return { allowed: true, count: 0, inMemory: true };
  }
}

/**
 * Shared analysis prompts by goal. All AI providers use the same
 * prompt set so users get consistent feedback regardless of which
 * provider handles their request.
 */
const PROMPTS_BY_GOAL = {
  event: [
    'Analyze this outfit for a formal event. Focus on elegance, appropriateness, and sophistication.',
    'Evaluate if this look works for a special occasion. Check dress code alignment.',
    'Assess the silhouette and fit for evening wear standards.',
  ],
  daily: [
    'Analyze this everyday outfit. Focus on comfort, coordination, and practicality.',
    'Evaluate this casual look for daily wear. Check color harmony and balance.',
    'Assess the overall aesthetic for everyday style.',
  ],
  critique: [
    'Give an honest critique of this outfit. Be direct about what works and what does not.',
    'Analyze this look critically. Point out specific issues and strengths.',
    'Provide blunt fashion feedback. No sugarcoating.',
  ],
  // African Differentiation — pattern-aware prompts for culturally-aware feedback.
  african: [
    'Identify any African textile patterns in this outfit (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print). Note cultural context and styling.',
    'Assess how well African fashion elements are integrated with the rest of the look.',
    'Provide culturally-aware feedback on occasion-appropriateness and pattern coordination.',
  ],
};

module.exports = { checkFrameRate, PROMPTS_BY_GOAL };
