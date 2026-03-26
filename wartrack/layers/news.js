// ============================================
// NEWS LAYER — Geo-linked news pins + data fetch
// Fetches on-demand, caches per hotspot, renders map pins
// ============================================

import { NEWS_CACHE_TTL, NEWS_MAX_ARTICLES, NEWS_FETCH_DELAY } from '../config.js';

const NEWS_CACHE = {};
window._newsCacheRef = NEWS_CACHE; // expose for correlator
let dataSource = null;

// State-adjacent outlets that get a warning indicator
const STATE_ADJACENT = ['TASS', 'Xinhua', 'RT', 'Sputnik', 'CGTN', 'Global Times', 'Press TV', 'KCNA'];

// ============================================
// CACHE HELPERS
// ============================================
function getCached(name) {
  const cached = NEWS_CACHE[name];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > NEWS_CACHE_TTL) return null;
  return cached;
}

function setCached(name, articles) {
  NEWS_CACHE[name] = { articles, timestamp: Date.now() };
}

export function getCacheAge(name) {
  const cached = NEWS_CACHE[name];
  if (!cached) return null;
  return Date.now() - cached.timestamp;
}

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
export async function fetchNewsForHotspot(hotspot) {
  const cached = getCached(hotspot.name);
  if (cached) return cached.articles;

  try {
    const resp = await fetch(`/api/news?q=${encodeURIComponent(hotspot.searchQuery || hotspot.name)}&max=${NEWS_MAX_ARTICLES}`);
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

let pinIcon = null;

// ============================================
// INIT — add news pins to globe
// ============================================
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
export function setNewsVisible(v) {
  if (dataSource) dataSource.show = v;
}

// ============================================
// TIME AGO HELPER
// ============================================
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
export function severityDot(severity) {
  const colors = { high: '🔴', elevated: '🟠', watch: '🟡' };
  return colors[severity] || '⚪';
}

export function severityColor(severity) {
  return { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' }[severity] || '#888';
}
