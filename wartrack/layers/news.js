/**
 * @module news
 * @description News layer — fetches geo-linked news articles per hotspot, caches them,
 * and renders "NEWS" pin entities on the Cesium globe. Provides helpers for
 * time formatting and severity coloring used by the UI panels.
 */

// ============================================
// NEWS LAYER — Geo-linked news pins + data fetch
// Fetches on-demand, caches per hotspot, renders map pins
// ============================================

import { NEWS_CACHE_TTL, NEWS_MAX_ARTICLES, NEWS_FETCH_DELAY } from '../config.js';
import { apiUrl } from '../config.js';
import { dedupFetch } from '../utils/dedup-fetch.js';

/**
 * @typedef {Object} NewsArticle
 * @property {string} title - Article headline
 * @property {string} [description] - Article summary
 * @property {string} [url] - Link to the full article
 * @property {string} [publishedAt] - ISO timestamp of publication
 * @property {{name: string}} [source] - Source outlet info
 * @property {string} hotspot - Name of the associated hotspot
 * @property {number} lat - Hotspot latitude
 * @property {number} lon - Hotspot longitude
 * @property {string} severity - Hotspot severity level
 * @property {boolean} isStateAdjacent - Whether the source is a state-adjacent outlet
 */

/** @type {Object<string, {articles: NewsArticle[], timestamp: number}>} Per-hotspot article cache */
const NEWS_CACHE = {};
window._newsCacheRef = NEWS_CACHE; // expose for correlator
/** @type {Cesium.CustomDataSource|null} */
let dataSource = null;

/**
 * @constant {string[]} List of state-adjacent media outlet names that receive a warning indicator.
 */
const STATE_ADJACENT = ['TASS', 'Xinhua', 'RT', 'Sputnik', 'CGTN', 'Global Times', 'Press TV', 'KCNA'];

// ============================================
// CACHE HELPERS
// ============================================
/**
 * Retrieve cached articles for a hotspot if still within TTL.
 * @param {string} name - Hotspot name
 * @returns {{articles: NewsArticle[], timestamp: number}|null}
 */
function getCached(name) {
  const cached = NEWS_CACHE[name];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > NEWS_CACHE_TTL) return null;
  return cached;
}

/**
 * Store articles in the cache for a hotspot.
 * @param {string} name - Hotspot name
 * @param {NewsArticle[]} articles - Articles to cache
 */
function setCached(name, articles) {
  NEWS_CACHE[name] = { articles, timestamp: Date.now() };
}

/**
 * Get the age of a cached entry in milliseconds.
 * @param {string} name - Hotspot name
 * @returns {number|null} Age in ms, or null if not cached
 */
export function getCacheAge(name) {
  const cached = NEWS_CACHE[name];
  if (!cached) return null;
  return Date.now() - cached.timestamp;
}

/**
 * Clear the news cache for a specific hotspot, or all hotspots if no name given.
 * @param {string} [name] - Hotspot name; omit to clear entire cache
 */
export function clearCache(name) {
  if (name) {
    delete NEWS_CACHE[name];
  } else {
    Object.keys(NEWS_CACHE).forEach(k => delete NEWS_CACHE[k]);
  }
}

// ============================================
// FETCH NEWS FOR A SINGLE HOTSPOT
// ============================================
/**
 * Fetch news articles for a single hotspot. Returns cached data when available.
 * Marks articles from state-adjacent outlets with a flag.
 * @param {{name: string, searchQuery?: string, lat: number, lon: number, severity: string}} hotspot
 * @returns {Promise<NewsArticle[]>}
 */
export async function fetchNewsForHotspot(hotspot) {
  const cached = getCached(hotspot.name);
  if (cached) return cached.articles;

  try {
    const resp = await dedupFetch(apiUrl(`/api/news?q=${encodeURIComponent(hotspot.searchQuery || hotspot.name)}&max=${NEWS_MAX_ARTICLES}`));
    if (!resp.ok) {
      console.warn(`News fetch failed for ${hotspot.name}: ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const articles = (data.articles || []).map(a => ({
      ...a,
      hotspot: hotspot.name,
      lat: hotspot.lat,
      lon: hotspot.lon,
      severity: hotspot.severity,
      isStateAdjacent: a.source && STATE_ADJACENT.some(s =>
        (a.source.name || '').toUpperCase().includes(s.toUpperCase())
      )
    }));

    setCached(hotspot.name, articles);
    return articles;
  } catch (err) {
    console.warn(`News fetch error for ${hotspot.name}:`, err);
    return [];
  }
}

// ============================================
// FETCH NEWS FOR ALL HOTSPOTS (sequential with delay)
// ============================================
/**
 * Fetch news for all hotspots sequentially with a delay between uncached requests.
 * Returns all articles sorted by publish date descending.
 * @param {Array<Object>} hotspots - Array of hotspot objects
 * @returns {Promise<NewsArticle[]>}
 */
export async function fetchAllNews(hotspots) {
  const allArticles = [];
  for (let i = 0; i < hotspots.length; i++) {
    const articles = await fetchNewsForHotspot(hotspots[i]);
    allArticles.push(...articles);
    // Delay between requests to avoid burst limits (skip if cached)
    if (i < hotspots.length - 1 && !getCached(hotspots[i].name)) {
      await new Promise(r => setTimeout(r, NEWS_FETCH_DELAY));
    }
  }
  // Sort by publish date descending
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return allArticles;
}

// ============================================
// NEWS PIN ICON
// ============================================
/**
 * Create a canvas-based amber circle icon with an "N" letter for news pins.
 * @returns {string} Base64 data URL of the icon
 */
function createNewsPinIcon() {
  const c = document.createElement('canvas');
  c.width = 20;
  c.height = 20;
  const ctx = c.getContext('2d');
  // Amber circle
  ctx.fillStyle = '#FFB300';
  ctx.beginPath();
  ctx.arc(10, 10, 8, 0, Math.PI * 2);
  ctx.fill();
  // Dark "N" letter
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 10, 10);
  return c.toDataURL();
}

/** @type {string|null} Cached news pin icon data URL */
let pinIcon = null;

// ============================================
// INIT — add news pins to globe
// ============================================
/**
 * Initialize the news layer. Creates the data source and adds a news pin
 * entity near each hotspot.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @param {Array<Object>} hotspots - Array of hotspot objects to place pins for
 */
export function initNews(viewer, hotspots) {
  dataSource = new Cesium.CustomDataSource('news');
  viewer.dataSources.add(dataSource);
  pinIcon = createNewsPinIcon();

  for (const hs of hotspots) {
    // Offset slightly from the conflict hotspot pin
    const offsetLon = hs.lon + 1.2;
    const offsetLat = hs.lat + 1.2;

    dataSource.entities.add({
      id: `news-pin-${hs.name}`,
      position: Cesium.Cartesian3.fromDegrees(offsetLon, offsetLat),
      billboard: {
        image: pinIcon,
        width: 18,
        height: 18,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1.3, 2e7, 0.4),
      },
      label: {
        text: 'NEWS',
        font: '9px Share Tech Mono',
        fillColor: Cesium.Color.fromCssColorString('#FFB300'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 2e7, 0.3),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      }
    });

    // Store hotspot ref on the entity for click handling
    const entity = dataSource.entities.getById(`news-pin-${hs.name}`);
    if (entity) {
      entity.hotspotData = hs;
      entity.entityType = 'news-pin';
    }
  }
}

// ============================================
// VISIBILITY
// ============================================
/**
 * Toggle visibility of news pin entities.
 * @param {boolean} v - Whether the layer should be visible
 */
export function setNewsVisible(v) {
  if (dataSource) dataSource.show = v;
}

// ============================================
// TIME AGO HELPER
// ============================================
/**
 * Convert an ISO date string to a human-readable relative time string.
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time (e.g. '5 min ago', '2hr ago', '3d ago')
 */
export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================
// SEVERITY COLOR HELPER
// ============================================
/**
 * Return a colored emoji dot for a severity level.
 * @param {string} severity - 'high', 'elevated', or 'watch'
 * @returns {string} Emoji dot character
 */
export function severityDot(severity) {
  const colors = { high: '🔴', elevated: '🟠', watch: '🟡' };
  return colors[severity] || '⚪';
}

/**
 * Return a hex color string for a severity level.
 * @param {string} severity - 'high', 'elevated', or 'watch'
 * @returns {string} CSS hex color
 */
export function severityColor(severity) {
  return { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' }[severity] || '#888';
}
