/**
 * @module utils/dedup-fetch
 *
 * Request deduplication wrapper around the native `fetch()` API.
 *
 * Prevents duplicate in-flight requests to the same URL and provides a short
 * TTL cache so that rapid repeated calls (e.g. multiple layers requesting the
 * same endpoint within a few seconds) reuse a single response.
 *
 * Usage:
 *   import { dedupFetch, clearDedupCache } from '../utils/dedup-fetch.js';
 *   const resp = await dedupFetch(apiUrl('/api/flights?...'));
 */

/** @type {Map<string, Promise<Response>>} URLs currently being fetched */
const inflight = new Map();

/**
 * @typedef {Object} CacheEntry
 * @property {Response} response  - Cloned response object
 * @property {number}   timestamp - Time the entry was stored (ms since epoch)
 */

/** @type {Map<string, CacheEntry>} Recently resolved responses keyed by URL */
const cache = new Map();

/** Default time-to-live for cached responses, in milliseconds. */
const DEFAULT_TTL = 5000;

/**
 * Fetch a URL with automatic request deduplication and short-lived caching.
 *
 * - If a cached response for `url` exists and is younger than `ttl` ms, a
 *   clone of that response is returned immediately (no network request).
 * - If an identical request is already in-flight, the same Promise is returned
 *   so only one network call is made.
 * - Otherwise a fresh `fetch()` is issued. The response is cached (cloned) for
 *   subsequent callers within the TTL window.
 *
 * @param {string}      url            - The URL to fetch.
 * @param {RequestInit}  [options={}]   - Standard `fetch()` options (method, headers, etc.).
 * @param {number}       [ttl=DEFAULT_TTL] - Cache time-to-live in milliseconds.
 * @returns {Promise<Response>} A `Response` object (may be a cache clone).
 */
export async function dedupFetch(url, options = {}, ttl = DEFAULT_TTL) {
  // Only deduplicate GET-like requests (no body, or explicitly GET)
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return fetch(url, options);
  }

  // 1. Check the TTL cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.response.clone();
  }

  // 2. Check for an in-flight request to the same URL
  if (inflight.has(url)) {
    // Wait for the existing request, then return a clone
    const resp = await inflight.get(url);
    return resp.clone();
  }

  // 3. Issue a new request and register it as in-flight
  const request = fetch(url, options)
    .then((resp) => {
      // Store a clone in the cache so the original can still be consumed
      cache.set(url, { response: resp.clone(), timestamp: Date.now() });
      return resp;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);

  const resp = await request;
  return resp.clone();
}

/**
 * Clear every entry from both the in-flight tracker and the response cache.
 *
 * Useful when the user triggers a hard refresh or when authentication state
 * changes and stale responses should be discarded.
 */
export function clearDedupCache() {
  inflight.clear();
  cache.clear();
}
