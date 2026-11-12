/**
 * Sandbase — OpenAI-compatible model gateway (https://api.sandbase.ai).
 *
 * Carries the platform-funded inference spend. Otari stays in the chain
 * behind it, and first for any call where the agent sent its own
 * `x-otari-key` — that spend belongs in the agent's workspace, not ours.
 *
 * Unlike Otari, Sandbase answers with plain OpenAI `usage` and no cost
 * field, so the USD figure is computed from the per-1M-token prices each
 * model card publishes. Prices are read once per model and cached; when
 * they cannot be read, costUsd() returns null and callers report no cost
 * rather than a guess.
 *
 * Env:
 *   SANDBASE_API_KEY     sk-… (required to enable the provider at all)
 *   SANDBASE_BASE_URL    default https://api.sandbase.ai/v1
 *   SANDBASE_VISION_MODEL / VISION_SANDBASE_MODEL   `vendor/model`
 *   SANDBASE_CHAT_MODEL                             `vendor/model`
 *   SANDBASE_TIMEOUT_MS  per-request timeout (default 20s)
 *   SANDBASE_KILL_SWITCH=1  disable all Sandbase calls
 */

const DEFAULT_BASE_URL = 'https://api.sandbase.ai/v1';
const DEFAULT_TIMEOUT_MS = 20_000;
const PRICE_TTL_MS = 6 * 60 * 60 * 1000;

function baseURL() {
  return (process.env.SANDBASE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function apiKey() {
  const key = process.env.SANDBASE_API_KEY;
  return key && !key.startsWith('your_') ? key : null;
}

const configured = () => apiKey() !== null && process.env.SANDBASE_KILL_SWITCH !== '1';

function timeoutMs() {
  const ms = Number(process.env.SANDBASE_TIMEOUT_MS);
  return Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
}

function visionModel() {
  return process.env.VISION_SANDBASE_MODEL || process.env.SANDBASE_VISION_MODEL || '';
}

function chatModel() {
  return process.env.SANDBASE_CHAT_MODEL || '';
}

/** OpenAI client for Sandbase, or null when unconfigured / killed / no model. */
function client(kind) {
  if (!configured()) return null;
  const model = kind === 'vision' ? visionModel() : chatModel();
  if (!model) return null;
  const OpenAI = require('openai');
  return new OpenAI({
    apiKey: apiKey(),
    baseURL: baseURL(),
    timeout: timeoutMs(),
    maxRetries: 0,
  });
}

// ── Cost readback ──────────────────────────────────────────────

/** model -> { promptPerMillion, completionPerMillion, readAt } | null */
const _priceCache = new Map();

/**
 * GET /v1/models/{id} -> { prompt_token_price, completion_token_price } in
 * USD per 1M tokens. Cached per model (including failures) for PRICE_TTL_MS.
 */
async function modelPrices(model) {
  const key = apiKey();
  if (!model || !key) return null;
  const hit = _priceCache.get(model);
  if (hit && hit.readAt > Date.now() - PRICE_TTL_MS) return hit.prices;

  let prices = null;
  try {
    const response = await fetch(`${baseURL()}/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (response.ok) {
      const card = (await response.json()).model_card || {};
      const promptPerMillion = Number(card.prompt_token_price);
      const completionPerMillion = Number(card.completion_token_price);
      if (Number.isFinite(promptPerMillion) && Number.isFinite(completionPerMillion)) {
        prices = { promptPerMillion, completionPerMillion };
      }
    }
  } catch {
    prices = null;
  }
  _priceCache.set(model, { prices, readAt: Date.now() });
  return prices;
}

/**
 * USD for a completed Sandbase call, or null when the price is unknown.
 * @param {string} model
 * @param {{prompt_tokens?: number, completion_tokens?: number}} [usage]
 */
async function costUsd(model, usage) {
  if (!usage) return null;
  const prices = await modelPrices(model);
  if (!prices) return null;
  return (
    ((usage.prompt_tokens || 0) * prices.promptPerMillion +
      (usage.completion_tokens || 0) * prices.completionPerMillion) /
    1_000_000
  );
}

/** Test seam — clear the cached model prices. */
function _resetPriceCache() {
  _priceCache.clear();
}

module.exports = {
  configured,
  client,
  apiKey,
  baseURL,
  timeoutMs,
  visionModel,
  chatModel,
  costUsd,
  modelPrices,
  _resetPriceCache,
};
