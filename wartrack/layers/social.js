/**
 * @module social
 * @description Social content layer — aggregates public videos, posts, and media from
 * YouTube, Reddit, and Bluesky. Content is geo-linked to conflict hotspots and rendered
 * as billboard entities on the Cesium globe. Triggers OSINT alerts on keyword spikes.
 */

// ============================================
// SOCIAL CONTENT LAYER — Public videos, posts, media
// Sources: YouTube, Reddit, Bluesky (all public APIs)
// Geo-linked to hotspots and visible regions
// ============================================

import { appState } from '../main.js';
import { getHotspots } from './hotspots.js';
import { apiUrl } from '../config.js';
import { checkOsintAlert } from './events.js';
import { dedupFetch } from '../utils/dedup-fetch.js';
import { on } from '../event-bus.js';

/**
 * @typedef {Object} SocialContentItem
 * @property {string} id - Unique item identifier
 * @property {string} source - Platform name (e.g. 'youtube', 'reddit', 'bluesky')
 * @property {string} type - Content type: 'video', 'post', 'camera', or 'article'
 * @property {string} title - Content title or headline
 * @property {string} [text] - Body text or description
 * @property {string} [author] - Author/poster name
 * @property {string} [timestamp] - ISO timestamp
 * @property {number} [lat] - Latitude if geo-tagged
 * @property {number} [lon] - Longitude if geo-tagged
 * @property {string} [thumbnail] - Thumbnail image URL
 * @property {string} [url] - Link to the original content
 * @property {string} [embedUrl] - Embeddable player URL
 * @property {number} [relevance] - Relevance score
 * @property {string} [region] - Associated region/hotspot name
 */

/** @type {Cesium.CustomDataSource|null} */
let dataSource = null;
/** @type {Map<string, {items: SocialContentItem[], timestamp: number}>} Per-region content cache */
let contentCache = new Map();
/** @type {boolean} Whether the social layer is toggled visible */
let visible = false;
/** @type {number} Current icon scale multiplier */
let socialIconScale = 1.0;
/** @constant {number} Cache time-to-live in milliseconds (15 minutes) */
const CACHE_TTL = 15 * 60 * 1000;
/** @constant {number} Maximum content items rendered per hotspot region */
const MAX_ITEMS_PER_REGION = 12;

// Listen for icon resize events
on('icon:resize', (detail) => {
  if (detail.layer !== 'social' || !dataSource) return;
  socialIconScale = detail.scale;
  for (const entity of dataSource.entities.values) {
    if (entity.billboard) {
      entity.billboard.width = 20 * socialIconScale;
      entity.billboard.height = 20 * socialIconScale;
    }
  }
  window.viewer?.scene?.requestRender();
});

// Content item structure (normalized across all sources)
// { id, source, type, title, text, author, timestamp, lat, lon, thumbnail, url, embedUrl, relevance, region }

// ============================================
// ICON
// ============================================
/**
 * Generate an SVG data-URI icon for a social content type.
 * @param {string} type - Content type: 'video', 'post', 'camera', or 'article'
 * @returns {string} Data URI of the SVG icon
 */
function createContentIcon(type) {
  const icons = {
    video: { color: '#ff4444', symbol: '▶' },
    post: { color: '#3399ff', symbol: '✦' },
    camera: { color: '#00cc88', symbol: '◉' },
    article: { color: '#ffaa00', symbol: '◈' },
  };
  const i = icons[type] || icons.article;
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="${i.color}" opacity="0.15"/>
      <circle cx="12" cy="12" r="7" fill="${i.color}" opacity="0.8"/>
      <text x="12" y="16" text-anchor="middle" font-size="10" fill="white" font-family="monospace">${i.symbol}</text>
    </svg>
  `)}`;
}

// ============================================
// INIT
// ============================================
/**
 * Initialize the social layer. Creates the data source and sets up a debounced
 * camera-move listener that loads content when the camera stops.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 */
export function initSocial(viewer) {
  dataSource = new Cesium.CustomDataSource('social');
  viewer.dataSources.add(dataSource);
  dataSource.show = false;

  // Auto-load content when camera stops moving
  let moveTimeout = null;
  viewer.camera.moveEnd.addEventListener(() => {
    if (!visible) return;
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => loadContentForVisibleRegions(viewer), 1500);
  });
}

// ============================================
// FETCH CONTENT FOR REGION
// ============================================
/**
 * Fetch social content for a named region. Returns cached data when available.
 * @param {string} regionName - Hotspot/region name
 * @param {number} lat - Region center latitude
 * @param {number} lon - Region center longitude
 * @returns {Promise<SocialContentItem[]>}
 */
export async function fetchContentForRegion(regionName, lat, lon, searchQuery) {
  // Check cache
  const cached = contentCache.get(regionName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.items;
  }

  try {
    // Pass searchQuery for better API results (e.g. "Ukraine war Russia" instead of "Ukraine Front")
    const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
    const resp = await dedupFetch(apiUrl(`/api/social?region=${encodeURIComponent(regionName)}&lat=${lat}&lon=${lon}${q}`));
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data.items || [];
    contentCache.set(regionName, { items, timestamp: Date.now() });
    return items;
  } catch {
    return [];
  }
}

// ============================================
// RENDER CONTENT PINS ON MAP
// ============================================
/**
 * Load and render social content for hotspots visible in the current viewport.
 * Only activates when zoomed below 10,000 km. Also triggers OSINT alert checks.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @returns {Promise<void>}
 */
export async function loadContentForVisibleRegions(viewer) {
  if (!visible || !dataSource) return;

  const hotspots = getHotspots();
  const camAlt = viewer.camera.positionCartographic?.height || 18000000;

  // Show content when zoomed below 10,000km (generous — covers most region views)
  if (camAlt > 10000000) {
    dataSource.entities.removeAll();
    return;
  }

  // Find hotspots near current view center
  const camLat = Cesium.Math.toDegrees(viewer.camera.positionCartographic.latitude);
  const camLon = Cesium.Math.toDegrees(viewer.camera.positionCartographic.longitude);

  for (const hs of hotspots) {
    const dlat = Math.abs(hs.lat - camLat);
    const dlon = Math.abs(hs.lon - camLon);
    if (dlat > 15 || dlon > 15) continue; // skip far hotspots

    const items = await fetchContentForRegion(hs.name, hs.lat, hs.lon, hs.searchQuery);
    renderContentItems(items, hs);
    // Check for conflict keyword spikes → fire OSINT alert
    checkOsintAlert(items, hs.name, hs.lat, hs.lon);
  }
}

/**
 * Render social content items as billboard entities spread in a circle around a hotspot.
 * Replaces any existing entities for the same region.
 * @param {SocialContentItem[]} items - Content items to render
 * @param {Object} hotspot - The hotspot object with name, lat, lon
 */
function renderContentItems(items, hotspot) {
  // Remove old items for this region
  const prefix = `social-${hotspot.name}-`;
  const toRemove = [];
  for (const e of dataSource.entities.values) {
    if (e.id?.startsWith(prefix)) toRemove.push(e);
  }
  toRemove.forEach(e => dataSource.entities.remove(e));

  // Add new items spread around the hotspot
  items.slice(0, MAX_ITEMS_PER_REGION).forEach((item, i) => {
    // Spread items in a circle around the hotspot
    const angle = (i / Math.min(items.length, MAX_ITEMS_PER_REGION)) * Math.PI * 2;
    const offsetDeg = 1.5 + Math.random() * 0.5;
    const lat = (item.lat || hotspot.lat) + Math.sin(angle) * offsetDeg;
    const lon = (item.lon || hotspot.lon) + Math.cos(angle) * offsetDeg;

    const entity = dataSource.entities.add({
      id: `${prefix}${i}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      billboard: {
        image: createContentIcon(item.type),
        width: 20,
        height: 20,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1.5, 5e6, 0.3),
      },
      label: {
        text: truncate(item.title || item.source, 25),
        font: '9px Share Tech Mono',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 5e6, 0),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      }
    });
    entity.entityType = 'social-content';
    entity.contentData = item;
    entity.contentRegion = hotspot.name;
  });

  window.viewer?.scene?.requestRender();
}

/**
 * Truncate a string to a maximum length, appending ellipsis if needed.
 * @param {string} s - Input string
 * @param {number} len - Maximum length
 * @returns {string}
 */
function truncate(s, len) {
  if (!s) return '';
  return s.length > len ? s.substring(0, len) + '…' : s;
}

// ============================================
// VISIBILITY
// ============================================
/**
 * Toggle visibility of the social content layer.
 * Triggers a content load when made visible.
 * @param {boolean} v - Whether the layer should be visible
 */
export function setSocialVisible(v) {
  visible = v;
  if (dataSource) dataSource.show = v;
  if (v && window.viewer) {
    loadContentForVisibleRegions(window.viewer);
  }
}

// ============================================
// GET CONTENT FOR NEXUS CONTEXT
// ============================================
/**
 * Get a summary of cached content for a region, suitable for Nexus AI context.
 * Returns up to 5 items with truncated titles.
 * @param {string} regionName - Hotspot/region name
 * @returns {Array<{source: string, type: string, title: string, author: string, url: string}>}
 */
export function getContentForRegion(regionName) {
  const cached = contentCache.get(regionName);
  if (!cached) return [];
  return cached.items.slice(0, 5).map(i => ({
    source: i.source,
    type: i.type,
    title: i.title?.substring(0, 80),
    author: i.author,
    url: i.url,
  }));
}
