/**
 * @module cameras
 * @description Public cameras layer — renders live webcam feeds from the Windy Webcams API
 * as billboard entities on the Cesium globe. Only fetches/shows markers when zoomed in
 * below a threshold altitude. Click a marker for detail + preview.
 */

// ============================================
// PUBLIC CAMERAS LAYER — Live webcam feeds via Windy Webcams API
// Only shows markers when zoomed in. Click for detail + preview.
// ============================================

import { appState } from '../main.js';
import { apiUrl } from '../config.js';
import { dedupFetch } from '../utils/dedup-fetch.js';
import { on } from '../event-bus.js';

/**
 * @typedef {Object} CameraData
 * @property {string} id - Unique camera identifier
 * @property {string} title - Human-readable camera name
 * @property {string} category - Classified category key (e.g. 'traffic', 'airport')
 * @property {string} categoryLabel - Display label for the category
 * @property {number} lat - Latitude in degrees
 * @property {number} lon - Longitude in degrees
 * @property {string|null} thumbnailUrl - Preview image URL
 * @property {string|null} playerUrl - Embeddable player/stream URL
 * @property {string|null} sourceUrl - Link to the camera's detail page
 * @property {string} city - City name
 * @property {string} region - Region/state name
 * @property {string} country - Country name
 * @property {string} status - Camera status (e.g. 'active')
 * @property {string|null} lastUpdated - ISO timestamp of last update
 * @property {number|null} viewCount - Total views
 */

/** @type {Cesium.CustomDataSource|null} Cesium data source for camera entities */
let dataSource = null;
/** @type {Map<string, Cesium.Entity>} Map of camera ID to Cesium entity */
let cameraEntities = new Map();
/** @type {boolean} Whether the camera layer is toggled visible */
let visible = true;
/** @type {string|null} Bounding-box key of the last successful fetch to avoid duplicate requests */
let lastFetchBbox = null;
/** @type {boolean} Cooldown flag to throttle fetch requests */
let fetchCooldown = false;
/** @type {number} Current icon scale multiplier, adjusted by wartrack-icon-resize events */
let camIconScale = 1.0;

// Listen for icon resize events
on('icon:resize', (detail) => {
  if (detail.layer !== 'cameras') return;
  camIconScale = detail.scale;
  for (const [id, entity] of cameraEntities) {
    entity.billboard.width = 20 * camIconScale;
    entity.billboard.height = 20 * camIconScale;
  }
  window.viewer?.scene?.requestRender();
});

/** @constant {number} Camera altitude threshold in km — cameras are only fetched/shown below this altitude */
const ZOOM_THRESHOLD_KM = 8000; // increased so cameras appear sooner when zooming in

/**
 * @constant {Object<string, {color: string, label: string}>}
 * Camera category definitions mapping category key to display color and label.
 */
const CAMERA_CATEGORIES = {
  traffic: { color: '#ffaa00', label: 'TRAFFIC' },
  airport: { color: '#00ddff', label: 'AIRPORT' },
  harbor: { color: '#0088ff', label: 'HARBOR' },
  city: { color: '#00ff88', label: 'CITY' },
  landscape: { color: '#88cc44', label: 'SCENIC' },
  beach: { color: '#44ddcc', label: 'BEACH' },
  other: { color: '#888899', label: 'CAMERA' },
};

// ============================================
// CAMERA ICON
// ============================================
/**
 * Generate an SVG data-URI icon for a camera category.
 * @param {string} category - Category key from CAMERA_CATEGORIES
 * @returns {string} Data URI of the SVG icon
 */
function createCameraIcon(category) {
  const cat = CAMERA_CATEGORIES[category] || CAMERA_CATEGORIES.other;
  const c = cat.color;
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <rect x="3" y="6" width="11" height="9" rx="1.5" fill="${c}" opacity="0.85"/>
      <polygon points="14,8 19,5 19,16 14,13" fill="${c}" opacity="0.7"/>
      <circle cx="8.5" cy="10.5" r="2.5" fill="none" stroke="#000" stroke-width="0.8" opacity="0.4"/>
      <circle cx="8.5" cy="10.5" r="1" fill="#000" opacity="0.3"/>
    </svg>
  `)}`;
}

/** @type {Map<string, string>} Cache of category -> SVG data URI to avoid regenerating icons */
const iconCache = new Map();

/**
 * Return a cached camera icon for the given category, creating it if needed.
 * @param {string} category - Category key
 * @returns {string} Data URI of the SVG icon
 */
function getCachedIcon(category) {
  if (iconCache.has(category)) return iconCache.get(category);
  const icon = createCameraIcon(category);
  iconCache.set(category, icon);
  return icon;
}

// ============================================
// CLASSIFY CATEGORY from Windy categories array
// ============================================
/**
 * Classify a Windy Webcams categories array into one of our internal category keys.
 * @param {Array<string|{id: string}>} categories - Raw categories from the API
 * @returns {string} Internal category key (e.g. 'traffic', 'airport', 'other')
 */
function classifyCategory(categories) {
  if (!categories || !Array.isArray(categories)) return 'other';
  const cats = categories.map(c => (typeof c === 'string' ? c : c.id || '').toLowerCase());
  if (cats.some(c => c.includes('traffic') || c.includes('road'))) return 'traffic';
  if (cats.some(c => c.includes('airport') || c.includes('aviation'))) return 'airport';
  if (cats.some(c => c.includes('harbor') || c.includes('port') || c.includes('marina'))) return 'harbor';
  if (cats.some(c => c.includes('city') || c.includes('indoor') || c.includes('square'))) return 'city';
  if (cats.some(c => c.includes('beach') || c.includes('coast') || c.includes('water'))) return 'beach';
  if (cats.some(c => c.includes('landscape') || c.includes('mountain') || c.includes('nature'))) return 'landscape';
  return 'other';
}

// ============================================
// INIT
// ============================================
/**
 * Initialize the cameras layer. Creates the data source and attaches a camera-move
 * listener that triggers fetches when zoomed in below the threshold.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 */
export function initCameras(viewer) {
  dataSource = new Cesium.CustomDataSource('cameras');
  viewer.dataSources.add(dataSource);

  // Watch camera movement — fetch cameras when zoomed in enough
  viewer.camera.changed.addEventListener(() => {
    if (!visible) return;
    const altKm = viewer.camera.positionCartographic.height / 1000;
    if (altKm < ZOOM_THRESHOLD_KM) {
      fetchCamerasForView(viewer);
    } else {
      // Zoomed out — hide cameras to reduce clutter
      dataSource.show = false;
    }
  });
}

// ============================================
// FETCH CAMERAS FOR CURRENT VIEW
// ============================================
/**
 * Fetch webcam data from the server for the current viewport bounding box.
 * Skips if on cooldown or the bbox hasn't changed since the last fetch.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @returns {Promise<void>}
 */
async function fetchCamerasForView(viewer) {
  if (fetchCooldown) return;

  // Get current view bounding box
  const rect = viewer.camera.computeViewRectangle();
  if (!rect) return;

  const north = Cesium.Math.toDegrees(rect.north);
  const south = Cesium.Math.toDegrees(rect.south);
  const east = Cesium.Math.toDegrees(rect.east);
  const west = Cesium.Math.toDegrees(rect.west);

  // Check if we already fetched for a similar area
  const bboxKey = `${north.toFixed(1)},${east.toFixed(1)},${south.toFixed(1)},${west.toFixed(1)}`;
  if (bboxKey === lastFetchBbox) {
    dataSource.show = true;
    return;
  }

  fetchCooldown = true;
  setTimeout(() => { fetchCooldown = false; }, 3000); // 3s cooldown between fetches

  try {
    const resp = await dedupFetch(apiUrl(`/api/cameras?bbox=${north},${east},${south},${west}`));
    if (!resp.ok) return;
    const data = await resp.json();

    const webcams = data.webcams || data || [];
    if (!Array.isArray(webcams)) return;

    lastFetchBbox = bboxKey;
    renderCameras(webcams);
    dataSource.show = true;
  } catch (err) {
    console.warn('Camera fetch error:', err);
  }
}

// ============================================
// RENDER CAMERA ENTITIES
// ============================================
/**
 * Render webcam entities on the globe. Adds new cameras and prunes excess
 * off-screen entities to keep the total under 500.
 * @param {Array<Object>} webcams - Array of webcam objects from the API
 */
function renderCameras(webcams) {
  const activeIds = new Set();

  dataSource.entities.suspendEvents();

  for (const cam of webcams) {
    const loc = cam.location || cam;
    const lat = loc.latitude || loc.lat;
    const lon = loc.longitude || loc.lon;
    if (!lat || !lon) continue;

    const id = cam.webcamId || cam.id || `cam-${lat}-${lon}`;
    activeIds.add(id);

    if (cameraEntities.has(id)) continue; // already rendered

    const category = classifyCategory(cam.categories);
    const cat = CAMERA_CATEGORIES[category] || CAMERA_CATEGORIES.other;
    const title = cam.title || cam.name || 'Public Camera';

    const entity = dataSource.entities.add({
      id: `camera-${id}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      billboard: {
        image: getCachedIcon(category),
        width: 20 * camIconScale,
        height: 20 * camIconScale,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1.3, 5e6, 0.3),
      },
      label: {
        text: title.length > 20 ? title.substring(0, 20) + '...' : title,
        font: '9px Share Tech Mono',
        fillColor: Cesium.Color.fromCssColorString(cat.color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 1e6, 0),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      }
    });

    // Store full camera data for detail panel
    entity.entityType = 'camera';
    entity.cameraData = {
      id,
      title,
      category,
      categoryLabel: cat.label,
      lat, lon,
      // Images
      thumbnailUrl: cam.images?.current?.preview || cam.image?.current?.preview || cam.thumbnail || null,
      // Player/stream
      playerUrl: cam.player?.day?.embed || cam.player?.live?.embed || null,
      // Source link
      sourceUrl: cam.urls?.detail || cam.url || null,
      // Location info
      city: loc.city || cam.city || '',
      region: loc.region || cam.region || '',
      country: loc.country || cam.country || '',
      // Meta
      status: cam.status || 'active',
      lastUpdated: cam.lastUpdatedOn || cam.updated || null,
      viewCount: cam.viewCount || null,
    };

    cameraEntities.set(id, entity);
  }

  // Remove cameras no longer in view (keep last 500 to avoid constant churn)
  if (cameraEntities.size > 500) {
    let removeCount = cameraEntities.size - 500;
    for (const [id, entity] of cameraEntities) {
      if (removeCount <= 0) break;
      if (!activeIds.has(id)) {
        dataSource.entities.remove(entity);
        cameraEntities.delete(id);
        removeCount--;
      }
    }
  }

  dataSource.entities.resumeEvents();
  appState.cameraCount = cameraEntities.size;
}

// ============================================
// VISIBILITY
// ============================================
/**
 * Toggle visibility of the cameras layer.
 * @param {boolean} v - Whether the layer should be visible
 */
export function setCamerasVisible(v) {
  visible = v;
  if (!v) {
    dataSource.show = false;
  } else {
    // Re-check zoom level
    const altKm = window.viewer?.camera?.positionCartographic?.height / 1000;
    if (altKm && altKm < ZOOM_THRESHOLD_KM) {
      dataSource.show = true;
    }
  }
}

// ============================================
// CLEAR ALL
// ============================================
/**
 * Remove all camera entities from the globe and reset internal state.
 */
export function clearCameras() {
  dataSource.entities.removeAll();
  cameraEntities.clear();
  lastFetchBbox = null;
}
