// ============================================
// WARTRACK — Main Entry Point
// CesiumJS initialization, layer orchestration
// ============================================

import { initFlights, updateFlights, setFlightsVisible } from './layers/flights.js';
import { initVessels, updateVessels, setVesselsVisible } from './layers/vessels.js';
import { initHotspots, setHotspotsVisible, getHotspots } from './layers/hotspots.js';
import { initThermal, toggleThermal } from './layers/thermal.js';
import { initNews, setNewsVisible, fetchAllNews, clearCache } from './layers/news.js';
import { startClock } from './ui/clock.js';
import { initDetailPanel } from './ui/detail-panel.js';
import { initLayerControls } from './ui/layer-controls.js';
import { initNewsFeed } from './ui/news-feed.js';
import { initAuth } from './ui/auth.js';
import { initFavorites } from './ui/favorites.js';
import { initBriefing, showBriefing } from './ui/briefing.js';
import { initMarketPanel } from './ui/market-panel.js';
import { initCinematic } from './ui/cinematic.js';
import { initNexus } from './ui/nexus.js';
import { initAlerts } from './ui/alerts.js';
import { takeSnapshot } from './layers/events.js';
import { initSatellites, updateSatellites, setSatellitesVisible, setCoverageVisible } from './layers/satellites.js';
import { initJamming, updateJamming, setJammingVisible } from './layers/jamming.js';
import { initGlobeStyles } from './ui/globe-styles.js';
import { initTimeline, showTimeline } from './ui/timeline.js';
import { isReplayMode } from './data/snapshot-store.js';
import { initCameras, setCamerasVisible } from './layers/cameras.js';
import { initSolarSystem, setSolarSystemVisible, flyToPlanet, flyToEarth } from './layers/solarsystem.js';

// Cesium Ion token — free tier
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YWMxMWEyMi01Y2QzLTRkNjQtOGZiZi0yNjA1M2I5MmMwYjMiLCJpZCI6MjY1MTM4LCJpYXQiOjE3MzUzMjUxNTJ9.r0OHLB0jVaFEuyOJMhGsG-KBoyXQFMCMBiPBNn9xdYo';

// ============================================
// GLOBE INIT
// ============================================
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  animation: false,
  fullscreenButton: false,
  creditContainer: document.createElement('div'),
  imageryProvider: false,
  terrain: undefined,
  skyBox: false,
  skyAtmosphere: false,
  contextOptions: {
    webgl: {
      alpha: true,
    }
  }
});

// Use free tile imagery — no token needed
// Base layer: dark CartoDB WITHOUT labels (so we can control label brightness separately)
const darkBase = new Cesium.UrlTemplateImageryProvider({
  url: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  credit: 'CartoDB',
  maximumLevel: 18,
});
const baseLayer = viewer.imageryLayers.addImageryProvider(darkBase);
baseLayer.brightness = 0.7;
baseLayer.contrast = 1.2;
baseLayer.saturation = 0.4;

// Label layer: country names, city names, borders — stays bright even in thermal
const labelTiles = new Cesium.UrlTemplateImageryProvider({
  url: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  credit: 'CartoDB Labels',
  maximumLevel: 18,
});
const labelLayer = viewer.imageryLayers.addImageryProvider(labelTiles);
labelLayer.brightness = 1.0;
labelLayer.contrast = 1.0;
labelLayer.saturation = 0.0; // desaturated labels — clean white text

// Export layers so thermal.js can adjust them independently
window._baseTileLayer = baseLayer;
window._labelTileLayer = labelLayer;

// Globe and atmosphere — solid globe with proper depth occlusion
viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1018');
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.globe.enableLighting = false;
viewer.scene.fog.enabled = false;

// Enable depth testing so markers behind the globe are occluded.
// depthTestAgainstTerrain works with the default EllipsoidTerrainProvider
// when combined with disableDepthTestDistance: 0 on all entities.
viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.globe.translucency.enabled = false;

// Atmosphere ring around globe edge
viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
viewer.scene.skyAtmosphere.brightnessShift = -0.3;
viewer.scene.skyAtmosphere.saturationShift = -0.7;
viewer.scene.skyAtmosphere.hueShift = 0.4; // push toward green/cyan tint

// Performance: enable request render mode — only re-render when something changes
viewer.scene.requestRenderMode = true;
viewer.scene.maximumRenderTimeChange = 0.1; // re-render at ~10fps idle, full speed when moving

// Set initial camera to show whole world with slight tilt
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(30, 30, 18000000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-90),
    roll: 0
  },
  duration: 0
});

// ============================================
// EXPORT VIEWER FOR LAYERS
// ============================================
export { viewer };
window.viewer = viewer; // expose for debugging

// ============================================
// APP STATE
// ============================================
export const appState = {
  flightCount: 0,
  militaryCount: 0,
  vesselCount: 0,
  satelliteCount: 0,
  cameraCount: 0,
  jammingCells: 0,
  thermalActive: false,
  lastRefresh: null,
  proxyBase: ''
};

// ============================================
// STATS UPDATER
// ============================================
export function updateStats() {
  const totalEl = document.getElementById('stat-total');
  const milEl = document.getElementById('stat-military');
  const refreshEl = document.getElementById('stat-refresh');
  const altEl = document.getElementById('stat-altitude');

  const total = appState.flightCount + appState.vesselCount + appState.satelliteCount;
  totalEl.textContent = total.toLocaleString();
  milEl.textContent = appState.militaryCount.toLocaleString();

  const satEl = document.getElementById('stat-satellites');
  if (satEl) satEl.textContent = appState.satelliteCount.toLocaleString();

  const satCount = document.getElementById('count-satellites');
  if (satCount) satCount.textContent = appState.satelliteCount;

  const camCount = document.getElementById('count-cameras');
  if (camCount) camCount.textContent = appState.cameraCount || 0;

  const jammingEl = document.getElementById('stat-jamming');
  if (jammingEl) jammingEl.textContent = appState.jammingCells || 0;
  const jammingCount = document.getElementById('count-jamming');
  if (jammingCount) jammingCount.textContent = appState.jammingCells || 0;

  if (appState.lastRefresh) {
    const ago = Math.round((Date.now() - appState.lastRefresh) / 1000);
    refreshEl.textContent = ago < 60 ? `${ago}s AGO` : `${Math.floor(ago / 60)}m AGO`;
  }

  // Camera altitude
  const cartographic = viewer.camera.positionCartographic;
  const altKm = (cartographic.height / 1000).toFixed(0);
  altEl.textContent = `${Number(altKm).toLocaleString()} KM`;

  // Update count badges
  document.getElementById('count-flights').textContent = appState.flightCount;
  document.getElementById('count-military').textContent = appState.militaryCount;
  document.getElementById('count-vessels').textContent = appState.vesselCount;
}

// ============================================
// INITIALIZE ALL LAYERS
// ============================================
async function init() {
  try {
    // Start clock
    startClock();

    // Init UI
    initDetailPanel(viewer);
    initLayerControls({
      onFlightsToggle: setFlightsVisible,
      onMilitaryToggle: (v) => { /* handled inside flights layer */ },
      onVesselsToggle: setVesselsVisible,
      onHotspotsToggle: setHotspotsVisible,
      onThermalToggle: (active) => toggleThermal(viewer, active),
      onSatellitesToggle: setSatellitesVisible,
      onCoverageToggle: setCoverageVisible,
      onCamerasToggle: setCamerasVisible,
      onJammingToggle: (v) => { setJammingVisible(v); if (v) showTimeline(); },
      onSolarSystemToggle: (v) => {
        setSolarSystemVisible(v);
        const nav = document.getElementById('planet-nav');
        if (nav) nav.classList.toggle('hidden', !v);
      },
    });

    // Init layers
    initFlights(viewer);
    initVessels(viewer);
    initHotspots(viewer);
    initThermal(viewer);

    // Init news layer — pins on globe near each hotspot
    const hotspots = getHotspots();
    initNews(viewer, hotspots);

    // Init news feed panel
    initNewsFeed(viewer);

    // Init satellite tracking
    initSatellites(viewer);

    // Init public cameras layer
    initCameras(viewer);

    // Init globe style picker
    initGlobeStyles(viewer);

    // Init GPS jamming / interference layer
    initJamming(viewer);

    // Init timeline / replay
    initTimeline(viewer);

    // Init solar system
    initSolarSystem(viewer);

    // Planet nav buttons
    document.querySelectorAll('.planet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const planet = btn.dataset.planet;
        if (planet === 'Earth') {
          flyToEarth(viewer);
        } else {
          flyToPlanet(viewer, planet);
        }
      });
    });

    // Init auth, favorites, market, cinematic, alerts
    await initAuth();
    initFavorites();
    initMarketPanel();
    initCinematic(viewer);
    initAlerts(viewer);
    initNexus(viewer);

    // First data fetch
    await Promise.all([
      updateFlights(viewer),
      updateVessels(viewer)
    ]);

    // Update stats periodically
    setInterval(updateStats, 3000);

    // Refresh flight data every 60 seconds (skip during replay)
    setInterval(() => { if (!isReplayMode()) updateFlights(viewer); }, 60000);

    // Refresh vessel data every 60 seconds (skip during replay)
    setInterval(() => { if (!isReplayMode()) updateVessels(viewer); }, 60000);

    // Propagate satellite positions every 10 seconds
    setInterval(() => { if (!isReplayMode()) updateSatellites(viewer); }, 10000);

    // GPS jamming layer update every 60 seconds (ADSB-X mode only)
    setInterval(() => { if (!isReplayMode()) updateJamming(viewer); }, 60000);

    // Auto-refresh news every 30 minutes (clears cache, re-fetches)
    setInterval(async () => {
      try {
        const hotspots = getHotspots();
        for (const hs of hotspots) clearCache(hs.name);
        await fetchAllNews(hotspots);
        // News auto-refreshed silently
      } catch { /* ignore */ }
    }, 30 * 60 * 1000);

    // Event detection — snapshot after each data refresh
    setInterval(() => {
      const flightDS = viewer.dataSources.getByName('flights')[0];
      const vesselDS = viewer.dataSources.getByName('vessels')[0];
      if (flightDS && vesselDS) {
        // Build entity maps from datasources
        const flightMap = new Map();
        const vesselMap = new Map();
        for (const e of flightDS.entities.values) {
          if (e.acData) flightMap.set(e.acData.icao24, e);
        }
        for (const e of vesselDS.entities.values) {
          if (e.vesselData) vesselMap.set(e.vesselData.mmsi || e.id, e);
        }
        takeSnapshot(flightMap, vesselMap);
      }
    }, 60000);

    // Detect embedded mode (inside game iframe)
    const params = new URLSearchParams(window.location.search);
    if (params.get('embedded') === '1' || window.parent !== window) {
      const backBtn = document.getElementById('btn-back-to-game');
      if (backBtn) {
        backBtn.style.display = 'block';
        backBtn.addEventListener('click', () => {
          window.parent.postMessage('wartrack-close', '*');
        });
      }
    }

    // Dismiss loading overlay
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 700);

    // Show executive briefing after loading
    setTimeout(() => initBriefing(), 1000);

    // Briefing re-open button
    document.getElementById('btn-briefing')?.addEventListener('click', showBriefing);

    // Collapsible HUD sections
    document.getElementById('intel-section-toggle')?.addEventListener('click', () => {
      const toggle = document.getElementById('intel-section-toggle');
      const body = document.getElementById('intel-section');
      toggle.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });

    // Reset view button — returns globe to default position without affecting layers
    document.getElementById('btn-reset-view')?.addEventListener('click', () => {
      viewer.scene.requestRenderMode = false;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(30, 30, 18000000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5,
        complete: () => { viewer.scene.requestRenderMode = true; },
        cancel: () => { viewer.scene.requestRenderMode = true; },
      });
    });

  } catch (err) {
    console.error('WARTRACK init error:', err);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.querySelector('.loading-text').textContent = 'INIT ERROR — CHECK CONSOLE';
      overlay.querySelector('.loading-text').style.color = '#ff3344';
    }
  }
}

init();
