/**
 * Runway judge (ADR 0022). Wraps lib/vision's provider chain with the
 * persona judging prompts, normalises scores, and maps failures onto the
 * game's outcomes: refused | unavailable | ok.
 */

const vision = require('../vision');
const prompts = require('./prompts');
const state = require('./state');

const clampScore = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(1, v));
};

const trim = (s, max) => String(s || '').trim().slice(0, max);

function normaliseTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => /^[a-z-]+$/.test(t))
    .slice(0, 3);
}

function validate(json) {
  if (!json || typeof json !== 'object') return false;
  if (json.refused === true) return true;
  const s = json.scores;
  return (
    s &&
    typeof s === 'object' &&
    typeof s.theme === 'number' &&
    typeof s.cohesion === 'number' &&
    typeof s.styling === 'number'
  );
}

/**
 * @returns {Promise<{ok:true, scores, total, verdict, fixHint, fixTags, provider, model}
 *                  | {ok:false, reason:'refused'|'unavailable'}>}
 */
async function judgeOutfit({ imageDataUrl, theme, persona, late }) {
  if ((await state.incrVisionCalls()) > state.DAILY_VISION_CAP) {
    return { ok: false, reason: 'unavailable' };
  }

  let result;
  try {
    result = await vision.completeVision({
      system: prompts.judgeSystemPrompt(persona),
      prompt: prompts.judgeUserPrompt(theme, { late }),
      imageDataUrl,
      validate,
    });
  } catch (err) {
    if (err.code === 'VISION_UNAVAILABLE') return { ok: false, reason: 'unavailable' };
    throw err;
  }

  const { json, provider, model } = result;
  if (json.refused === true) return { ok: false, reason: 'refused' };

  const scores = {
    theme: clampScore(json.scores.theme),
    cohesion: clampScore(json.scores.cohesion),
    styling: clampScore(json.scores.styling),
  };
  const total = Math.round(((scores.theme + scores.cohesion + scores.styling) / 3) * 10) / 10;

  return {
    ok: true,
    scores,
    total,
    verdict: trim(json.verdict, 240),
    fixHint: trim(json.fixHint, 80),
    fixTags: normaliseTags(json.fixTags),
    provider,
    model,
  };
}

module.exports = { judgeOutfit };
