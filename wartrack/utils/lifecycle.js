/**
 * @module lifecycle
 * Centralized lifecycle manager for intervals, timeouts, and subscriptions.
 * Tracks all resources so they can be cleaned up on app unmount to prevent memory leaks.
 */

const intervals = new Map();
const timeouts = new Map();
const unsubscribes = [];
let idCounter = 0;

/**
 * Register a setInterval and track it for cleanup.
 * @param {string} name - Human-readable name for debugging
 * @param {Function} fn - Callback
 * @param {number} ms - Interval in milliseconds
 * @returns {string} Tracked interval ID
 */
export function trackInterval(name, fn, ms) {
  const id = `interval-${++idCounter}-${name}`;
  const nativeId = setInterval(fn, ms);
  intervals.set(id, { nativeId, name, ms });
  return id;
}

/**
 * Register a setTimeout and track it for cleanup.
 * @param {string} name
 * @param {Function} fn
 * @param {number} ms
 * @returns {string}
 */
export function trackTimeout(name, fn, ms) {
  const id = `timeout-${++idCounter}-${name}`;
  const nativeId = setTimeout(() => {
    fn();
    timeouts.delete(id);
  }, ms);
  timeouts.set(id, { nativeId, name });
  return id;
}

/**
 * Track an event bus subscription's unsubscribe function.
 * @param {Function} unsub - The unsubscribe function returned by on() or subscribe()
 * @param {string} [name] - Optional label for debugging
 */
export function trackSubscription(unsub, name) {
  unsubscribes.push({ unsub, name: name || 'unnamed' });
}

/**
 * Clear a specific tracked interval by its ID.
 * @param {string} id
 */
export function clearTrackedInterval(id) {
  const entry = intervals.get(id);
  if (entry) {
    clearInterval(entry.nativeId);
    intervals.delete(id);
  }
}

/**
 * Get a summary of all tracked resources (for debugging).
 * @returns {{ intervals: number, timeouts: number, subscriptions: number, details: object[] }}
 */
export function getLifecycleInfo() {
  return {
    intervals: intervals.size,
    timeouts: timeouts.size,
    subscriptions: unsubscribes.length,
    details: [
      ...Array.from(intervals.values()).map(i => ({ type: 'interval', name: i.name, ms: i.ms })),
      ...Array.from(timeouts.values()).map(t => ({ type: 'timeout', name: t.name })),
      ...unsubscribes.map(s => ({ type: 'subscription', name: s.name })),
    ],
  };
}

/**
 * Clean up ALL tracked resources. Call on app unmount/hot reload.
 */
export function cleanup() {
  for (const [id, entry] of intervals) {
    clearInterval(entry.nativeId);
  }
  intervals.clear();
  for (const [id, entry] of timeouts) {
    clearTimeout(entry.nativeId);
  }
  timeouts.clear();
  for (const { unsub } of unsubscribes) {
    try { unsub(); } catch {}
  }
  unsubscribes.length = 0;
  console.log('[lifecycle] All resources cleaned up');
}
