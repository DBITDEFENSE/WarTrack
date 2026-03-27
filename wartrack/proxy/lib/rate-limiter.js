/**
 * @module rate-limiter
 * Server-side API budget tracker and adaptive cache TTL manager.
 *
 * Tracks how many requests have been made to each rate-limited API per day,
 * and dynamically extends cache TTLs as the budget depletes. When budget is
 * exhausted, returns cached data only (no upstream requests).
 *
 * Usage:
 *   import { apiTracker } from './lib/rate-limiter.js';
 *   if (apiTracker.canRequest('gnews')) {
 *     apiTracker.recordRequest('gnews');
 *     // ... make upstream request
 *   } else {
 *     // return cached data or fallback
 *   }
 */

/**
 * @typedef {Object} ApiConfig
 * @property {number} dailyLimit - Max requests per day
 * @property {number} baseCacheTTL - Base cache TTL in ms when budget is healthy
 * @property {number} maxCacheTTL - Maximum cache TTL when budget is nearly depleted
 * @property {string} [fallbackSource] - Optional fallback API name to try when budget exhausted
 */

/** @type {Object<string, ApiConfig>} */
const API_CONFIGS = {
  gnews: {
    dailyLimit: 100,
    baseCacheTTL: 10 * 60 * 1000,    // 10 min when budget healthy
    maxCacheTTL: 4 * 60 * 60 * 1000, // 4 hours when nearly depleted
    fallbackSource: 'google-rss',
  },
  opensky: {
    dailyLimit: 400,
    baseCacheTTL: 15 * 1000,          // 15s
    maxCacheTTL: 5 * 60 * 1000,       // 5 min when nearly depleted
    fallbackSource: 'adsbx',
  },
  'opensky-bbox': {
    dailyLimit: 400,                   // shared with opensky global
    baseCacheTTL: 30 * 1000,           // 30s
    maxCacheTTL: 5 * 60 * 1000,        // 5 min
    fallbackSource: 'adsbx',
  },
  adsbx: {
    dailyLimit: 500,                   // RapidAPI free tier
    baseCacheTTL: 15 * 1000,
    maxCacheTTL: 2 * 60 * 1000,
  },
  windy: {
    dailyLimit: 1000,
    baseCacheTTL: 10 * 60 * 1000,
    maxCacheTTL: 60 * 60 * 1000,
  },
  celestrak: {
    dailyLimit: 200,
    baseCacheTTL: 2 * 60 * 60 * 1000, // 2 hours
    maxCacheTTL: 12 * 60 * 60 * 1000, // 12 hours
  },
  // Free APIs with generous limits — track but don't restrict
  digitraffic: {
    dailyLimit: 5000,
    baseCacheTTL: 30 * 1000,
    maxCacheTTL: 60 * 1000,
  },
  'google-rss': {
    dailyLimit: 1000,
    baseCacheTTL: 10 * 60 * 1000,
    maxCacheTTL: 30 * 60 * 1000,
  },
  gdelt: {
    dailyLimit: 2000,
    baseCacheTTL: 15 * 60 * 1000,
    maxCacheTTL: 60 * 60 * 1000,
  },
};

/**
 * @typedef {Object} BudgetEntry
 * @property {number} count - Requests made today
 * @property {number} resetAt - Epoch ms when the counter resets (midnight UTC)
 * @property {number} lastRequest - Epoch ms of last upstream request
 * @property {number} errors - Consecutive error count (for backoff)
 */

/** @type {Map<string, BudgetEntry>} */
const budgets = new Map();

/**
 * Get or create the budget entry for an API, resetting if the day has changed.
 * @param {string} api
 * @returns {BudgetEntry}
 */
function getBudget(api) {
  const now = Date.now();
  let entry = budgets.get(api);

  if (!entry || now >= entry.resetAt) {
    // New day — reset counter
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    entry = { count: 0, resetAt: tomorrow.getTime(), lastRequest: 0, errors: 0 };
    budgets.set(api, entry);
  }

  return entry;
}

/**
 * Check if we have remaining budget for this API today.
 * @param {string} api - API name (e.g. 'gnews', 'opensky')
 * @returns {boolean}
 */
function canRequest(api) {
  const config = API_CONFIGS[api];
  if (!config) return true; // unknown API — allow
  const budget = getBudget(api);
  return budget.count < config.dailyLimit;
}

/**
 * Record that a request was made to this API.
 * @param {string} api
 */
function recordRequest(api) {
  const budget = getBudget(api);
  budget.count++;
  budget.lastRequest = Date.now();
  budget.errors = 0; // reset error streak on successful request
}

/**
 * Record an error for this API (for exponential backoff).
 * @param {string} api
 */
function recordError(api) {
  const budget = getBudget(api);
  budget.errors++;
}

/**
 * Get the adaptive cache TTL for this API based on remaining budget.
 * As budget depletes, TTL smoothly increases from baseCacheTTL to maxCacheTTL.
 *
 * Budget %  → TTL multiplier:
 *   >80%   → 1x (base TTL)
 *   50-80% → 1.5x
 *   20-50% → 3x
 *   5-20%  → 6x
 *   <5%    → max TTL
 *
 * @param {string} api
 * @returns {number} Cache TTL in milliseconds
 */
function getAdaptiveTTL(api) {
  const config = API_CONFIGS[api];
  if (!config) return 30000; // 30s default
  const budget = getBudget(api);
  const remaining = Math.max(0, config.dailyLimit - budget.count);
  const pct = remaining / config.dailyLimit;

  // Add backoff for consecutive errors (doubles TTL per error, up to 8x)
  const errorMultiplier = Math.min(8, Math.pow(2, budget.errors));

  let ttl;
  if (pct > 0.8) ttl = config.baseCacheTTL;
  else if (pct > 0.5) ttl = config.baseCacheTTL * 1.5;
  else if (pct > 0.2) ttl = config.baseCacheTTL * 3;
  else if (pct > 0.05) ttl = config.baseCacheTTL * 6;
  else ttl = config.maxCacheTTL;

  return Math.min(config.maxCacheTTL, ttl * errorMultiplier);
}

/**
 * Get the remaining request budget for an API.
 * @param {string} api
 * @returns {{ used: number, limit: number, remaining: number, pct: number, ttl: number, fallback: string|null }}
 */
function getBudgetInfo(api) {
  const config = API_CONFIGS[api] || { dailyLimit: 0, baseCacheTTL: 0, maxCacheTTL: 0 };
  const budget = getBudget(api);
  const remaining = Math.max(0, config.dailyLimit - budget.count);
  return {
    used: budget.count,
    limit: config.dailyLimit,
    remaining,
    pct: Math.round((remaining / config.dailyLimit) * 100),
    ttl: getAdaptiveTTL(api),
    fallback: config.fallbackSource || null,
  };
}

/**
 * Get a summary of all API budgets (for debugging / monitoring endpoint).
 * @returns {Object<string, object>}
 */
function getAllBudgets() {
  const summary = {};
  for (const api of Object.keys(API_CONFIGS)) {
    summary[api] = getBudgetInfo(api);
  }
  return summary;
}

/**
 * Get the fallback source for an API (if configured).
 * @param {string} api
 * @returns {string|null}
 */
function getFallback(api) {
  return API_CONFIGS[api]?.fallbackSource || null;
}

export const apiTracker = {
  canRequest,
  recordRequest,
  recordError,
  getAdaptiveTTL,
  getBudgetInfo,
  getAllBudgets,
  getFallback,
};
