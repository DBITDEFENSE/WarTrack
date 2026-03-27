/**
 * @module store
 * Centralized reactive state store for WarTrack.
 * Consolidates layer visibility, app counters, display modes, icon scales,
 * and shared references that were previously scattered across module-level
 * variables and window globals.
 *
 * Usage:
 *   import { getState, setState, subscribe } from '../store.js';
 *   setState('counts.flights', 42);
 *   const unsub = subscribe('counts', (counts) => updateHUD(counts));
 */

/**
 * @typedef {Object} WarTrackState
 * @property {Object<string, boolean>} layers - Layer visibility flags
 * @property {Object<string, number>} counts - Entity count metrics
 * @property {boolean} thermalActive - FLIR/thermal view mode
 * @property {boolean} globalFlightMode - Fetch all flights globally vs viewport
 * @property {Object<string, number>} iconScales - Per-layer icon scale multipliers
 * @property {*} selectedEntity - Currently selected Cesium entity (or null)
 * @property {*} viewer - Cesium Viewer instance
 * @property {*} baseTileLayer - Base satellite imagery layer
 * @property {*} labelTileLayer - Label overlay layer
 * @property {number} lastRefresh - Last data refresh timestamp (epoch ms)
 */

const state = {
  layers: {
    flights: false,
    vessels: false,
    satellites: false,
    cameras: false,
    hotspots: true,
    jamming: false,
    news: true,
    social: false,
    solarsystem: false,
  },
  counts: {
    flights: 0,
    military: 0,
    vessels: 0,
    satellites: 0,
    cameras: 0,
    jammingCells: 0,
  },
  thermalActive: false,
  globalFlightMode: false,
  iconScales: {
    flights: 1,
    vessels: 1,
    satellites: 1,
    cameras: 1,
    hotspots: 1,
    social: 1,
  },
  selectedEntity: null,
  viewer: null,
  baseTileLayer: null,
  labelTileLayer: null,
  lastRefresh: 0,
};

/** @type {Map<string, Set<Function>>} Path prefix → subscriber set */
const subscribers = new Map();

/**
 * Get the value at a dot-path in the state tree.
 * @param {string} [path] - Dot-separated path (e.g. 'counts.flights'). Omit for full state.
 * @returns {*} The value at that path, or the full state object
 */
export function getState(path) {
  if (!path) return state;
  const keys = path.split('.');
  let obj = state;
  for (const k of keys) {
    if (obj == null) return undefined;
    obj = obj[k];
  }
  return obj;
}

/**
 * Set a value at a dot-path in the state tree and notify subscribers.
 * @param {string} path - Dot-separated path (e.g. 'layers.flights')
 * @param {*} value - New value
 */
export function setState(path, value) {
  const keys = path.split('.');
  let obj = state;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] == null) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  const oldValue = obj[lastKey];
  if (oldValue === value) return; // no-op if unchanged
  obj[lastKey] = value;

  // Notify subscribers — match any prefix of the path
  // e.g. setting 'counts.flights' notifies 'counts.flights', 'counts', and '' (root)
  for (const [subPath, fns] of subscribers) {
    if (path === subPath || path.startsWith(subPath + '.') || subPath.startsWith(path + '.') || subPath === '') {
      const payload = getState(subPath || undefined);
      for (const fn of fns) {
        try { fn(payload, path, value); } catch (err) { console.warn(`[store] Subscriber error for '${subPath}':`, err); }
      }
    }
  }
}

/**
 * Subscribe to changes at a state path. Callback fires when the path
 * or any child of it changes.
 * @param {string} path - State path to watch (e.g. 'counts', 'layers.flights')
 * @param {Function} fn - Callback: (currentValue, changedPath, newValue) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribe(path, fn) {
  if (!subscribers.has(path)) subscribers.set(path, new Set());
  subscribers.get(path).add(fn);
  return () => subscribers.get(path)?.delete(fn);
}

/**
 * Reset all state to initial values. Useful for testing.
 */
export function resetState() {
  state.layers = {
    flights: false, vessels: false, satellites: false,
    cameras: false, hotspots: true, jamming: false,
    news: true, social: false, solarsystem: false,
  };
  state.counts = { flights: 0, military: 0, vessels: 0, satellites: 0, cameras: 0, jammingCells: 0 };
  state.thermalActive = false;
  state.globalFlightMode = false;
  state.iconScales = { flights: 1, vessels: 1, satellites: 1, cameras: 1, hotspots: 1, social: 1 };
  state.selectedEntity = null;
  state.viewer = null;
  state.baseTileLayer = null;
  state.labelTileLayer = null;
  state.lastRefresh = 0;
  subscribers.clear();
}
