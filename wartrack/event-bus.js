/**
 * @module event-bus
 * Lightweight typed event emitter for cross-module communication.
 * Replaces scattered `window.dispatchEvent(new CustomEvent('wartrack-*'))` calls
 * with a centralized, testable event bus.
 *
 * Event naming convention: `domain:action` (e.g. 'flight:data', 'layer:activated')
 */

/** @type {Map<string, Set<Function>>} Event name → listener set */
const listeners = new Map();

/**
 * Subscribe to an event. Returns an unsubscribe function.
 * @param {string} event - Event name (e.g. 'flight:data')
 * @param {Function} fn - Callback receiving the event payload
 * @returns {Function} Unsubscribe function
 */
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

/**
 * Emit an event to all subscribers.
 * @param {string} event - Event name
 * @param {*} data - Payload passed to each listener
 */
export function emit(event, data) {
  const fns = listeners.get(event);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(data); } catch (err) { console.warn(`[event-bus] Error in '${event}' listener:`, err); }
  }
}

/**
 * Remove a specific listener from an event.
 * @param {string} event - Event name
 * @param {Function} fn - The listener to remove
 */
export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

/**
 * Remove all listeners. Useful for testing.
 */
export function clearAll() {
  listeners.clear();
}
