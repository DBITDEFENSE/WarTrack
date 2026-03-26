// ============================================
// GLOBE STYLES — User-selectable globe themes
// Swaps tile providers + atmosphere without resetting camera
// ============================================

const GLOBE_STYLES = {
  'dark-tactical': {
    name: 'Dark Tactical',
    baseUrl: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    labelUrl: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
    base: { brightness: 0.7, contrast: 1.2, saturation: 0.4 },
    labels: { brightness: 1.0, contrast: 1.0, saturation: 0.0 },
    globeColor: '#0a1018',
    atmosphere: { brightness: -0.3, saturation: -0.7, hue: 0.4 },
    showAtmosphere: true,
  },
  'satellite': {
    name: 'Satellite',
    baseUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
    base: { brightness: 0.85, contrast: 1.1, saturation: 0.8 },
    labels: { brightness: 1.0, contrast: 1.0, saturation: 0.0 },
    globeColor: '#0a1220',
    atmosphere: { brightness: -0.15, saturation: -0.3, hue: 0.1 },
    showAtmosphere: true,
  },
  'minimal': {
    name: 'Minimal',
    baseUrl: 'https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
    labelUrl: 'https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
    base: { brightness: 0.3, contrast: 1.5, saturation: 0.0 },
    labels: { brightness: 0.5, contrast: 1.2, saturation: 0.0 },
    globeColor: '#101418',
    atmosphere: { brightness: -0.4, saturation: -0.8, hue: 0.0 },
    showAtmosphere: true,
  },
  'night': {
    name: 'Night Vision',
    baseUrl: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    labelUrl: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
    base: { brightness: 0.4, contrast: 1.6, saturation: 0.0 },
    labels: { brightness: 0.8, contrast: 1.0, saturation: 0.0 },
    globeColor: '#040808',
    atmosphere: { brightness: -0.5, saturation: -1.0, hue: 0.6 },
    showAtmosphere: true,
  },
  'osm': {
    name: 'OpenStreetMap',
    baseUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelUrl: null, // OSM includes labels
    base: { brightness: 0.6, contrast: 1.3, saturation: 0.3 },
    labels: null,
    globeColor: '#0c1018',
    atmosphere: { brightness: -0.2, saturation: -0.5, hue: 0.2 },
    showAtmosphere: true,
  },
};

let currentStyle = 'satellite';
let viewer = null;

export function initGlobeStyles(v) {
  viewer = v;

  // Build style picker UI
  const container = document.getElementById('globe-style-picker');
  if (!container) return;

  container.innerHTML = Object.entries(GLOBE_STYLES).map(([key, style]) => `
    <button class="globe-style-btn ${key === currentStyle ? 'active' : ''}" data-style="${key}" title="${style.name}">
      ${style.name.toUpperCase()}
    </button>
  `).join('');

  container.querySelectorAll('.globe-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const styleKey = btn.dataset.style;
      if (styleKey === currentStyle) return;
      applyGlobeStyle(styleKey);
      container.querySelectorAll('.globe-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function applyGlobeStyle(styleKey) {
  const style = GLOBE_STYLES[styleKey];
  if (!style || !viewer) return;

  currentStyle = styleKey;

  // Save camera state
  const cameraPos = viewer.camera.position.clone();
  const cameraDir = viewer.camera.direction.clone();
  const cameraUp = viewer.camera.up.clone();

  // Remove existing imagery layers
  viewer.imageryLayers.removeAll();

  // Add new base layer
  const baseProvider = new Cesium.UrlTemplateImageryProvider({
    url: style.baseUrl,
    credit: 'WarTrack',
    maximumLevel: 18,
  });
  const baseLayer = viewer.imageryLayers.addImageryProvider(baseProvider);
  baseLayer.brightness = style.base.brightness;
  baseLayer.contrast = style.base.contrast;
  baseLayer.saturation = style.base.saturation;

  // Add label layer if separate
  let labelLayer = null;
  if (style.labelUrl) {
    const labelProvider = new Cesium.UrlTemplateImageryProvider({
      url: style.labelUrl,
      credit: 'Labels',
      maximumLevel: 18,
    });
    labelLayer = viewer.imageryLayers.addImageryProvider(labelProvider);
    labelLayer.brightness = style.labels.brightness;
    labelLayer.contrast = style.labels.contrast;
    labelLayer.saturation = style.labels.saturation;
  }

  // Update global refs for thermal.js
  window._baseTileLayer = baseLayer;
  window._labelTileLayer = labelLayer;

  // Globe color
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(style.globeColor);

  // Atmosphere
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = style.showAtmosphere;
    viewer.scene.skyAtmosphere.brightnessShift = style.atmosphere.brightness;
    viewer.scene.skyAtmosphere.saturationShift = style.atmosphere.saturation;
    viewer.scene.skyAtmosphere.hueShift = style.atmosphere.hue;
  }
  viewer.scene.globe.showGroundAtmosphere = style.showAtmosphere;

  // Restore camera state (prevent globe reset)
  viewer.camera.position = cameraPos;
  viewer.camera.direction = cameraDir;
  viewer.camera.up = cameraUp;

  viewer.scene.requestRender();
}

export function getCurrentStyle() { return currentStyle; }
export function getStyleConfig() { return GLOBE_STYLES[currentStyle]; }
