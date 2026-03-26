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
import { runCorrelation, getRegionIntel, getGlobalIntelSummary } from './layers/correlator.js';
import { initSocial, setSocialVisible, loadContentForVisibleRegions } from './layers/social.js';
import { initSettings } from './ui/settings.js';
import { initGroundView } from './ui/ground-view.js';

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

// Default globe style: Satellite imagery
const darkBase = new Cesium.UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  credit: 'ArcGIS World Imagery',
  maximumLevel: 18,
});
const baseLayer = viewer.imageryLayers.addImageryProvider(darkBase);
baseLayer.brightness = 0.85;
baseLayer.contrast = 1.1;
baseLayer.saturation = 0.8;

// Label layer: country names, city names, borders
const labelTiles = new Cesium.UrlTemplateImageryProvider({
  url: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  credit: 'CartoDB Labels',
  maximumLevel: 18,
});
const labelLayer = viewer.imageryLayers.addImageryProvider(labelTiles);
labelLayer.brightness = 1.0;
labelLayer.contrast = 1.0;
labelLayer.saturation = 0.0;

// Export layers so thermal.js can adjust them independently
window._baseTileLayer = baseLayer;
window._labelTileLayer = labelLayer;

// Globe and atmosphere — solid globe with proper depth occlusion
viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1220');
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
viewer.scene.skyAtmosphere.brightnessShift = -0.15;
viewer.scene.skyAtmosphere.saturationShift = -0.3;
viewer.scene.skyAtmosphere.hueShift = 0.1;

// Performance: enable request render mode — only re-render when something changes
viewer.scene.requestRenderMode = true;
viewer.scene.maximumRenderTimeChange = 0.1;

// Mobile + touch optimization
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const sscc = viewer.scene.screenSpaceCameraController;

// Improve touch controls for ALL devices (helps desktop trackpads too)
sscc.minimumZoomDistance = 500;       // don't zoom through the globe
sscc.maximumZoomDistance = 50000000;  // can zoom out to see whole Earth

if (isMobile) {
  // Single-finger drag = rotate globe (default, keep)
  // Two-finger pinch = zoom (keep as primary)
  // Disable tilt from pinch — confusing on mobile, rotate is enough
  sscc.tiltEventTypes = [];
  sscc.lookEventTypes = [];

  // Make zoom much more responsive on mobile
  sscc.zoomEventTypes = [
    Cesium.CameraEventType.PINCH,
    Cesium.CameraEventType.WHEEL,
  ];

  // Increase zoom sensitivity
  sscc._zoomFactor = 5.0;
  sscc.minimumZoomDistance = 1000;

  // Disable inertia for snappier feel
  sscc.inertiaSpin = 0.5;   // some spin inertia (feels natural)
  sscc.inertiaZoom = 0;     // no zoom inertia (prevents over-zoom)
  sscc.inertiaTranslate = 0;

  // Lower tile detail on mobile for performance
  viewer.scene.globe.maximumScreenSpaceError = 4;
  // Reduce max entities
  window._wartracMaxCivilian = 500;
}

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
  if (totalEl) totalEl.textContent = total.toLocaleString();
  if (milEl) milEl.textContent = appState.militaryCount.toLocaleString();

  // Global threat level from correlation engine
  const threatEl = document.getElementById('stat-threat');
  if (threatEl) {
    try {
      const summary = getGlobalIntelSummary();
      if (summary.length > 0) {
        const topThreat = summary[0]; // highest score region
        const level = topThreat.threatLevel;
        threatEl.textContent = level;
        threatEl.className = `stat-value threat-badge ${level.toLowerCase()}`;
      }
    } catch { /* correlator not ready */ }
  }

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
      onFlightsToggle: (v) => {
        setFlightsVisible(v);
        if (v) window.dispatchEvent(new CustomEvent('wartrack-layer-activated', { detail: { layer: 'flights' } }));
      },
      onMilitaryToggle: (v) => { /* handled inside flights layer */ },
      onVesselsToggle: (v) => {
        setVesselsVisible(v);
        if (v) window.dispatchEvent(new CustomEvent('wartrack-layer-activated', { detail: { layer: 'vessels' } }));
      },
      onHotspotsToggle: setHotspotsVisible,
      onThermalToggle: (active) => toggleThermal(viewer, active),
      onSatellitesToggle: (v) => {
        setSatellitesVisible(v);
        if (v) window.dispatchEvent(new CustomEvent('wartrack-layer-activated', { detail: { layer: 'satellites' } }));
      },
      onCoverageToggle: setCoverageVisible,
      onCamerasToggle: setCamerasVisible,
      onSocialToggle: (v) => { setSocialVisible(v); if (v) loadContentForVisibleRegions(viewer); },
      onJammingToggle: (v) => { setJammingVisible(v); if (v) { updateJamming(viewer); showTimeline(); } },
      onSolarSystemToggle: (v) => {
        setSolarSystemVisible(v);
        const nav = document.getElementById('planet-nav');
        if (nav) nav.classList.toggle('hidden', !v);
      },
    });

    // Init layers (await async ones that load data before rendering)
    await initFlights(viewer);
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

    // Init social content layer
    initSocial(viewer);

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

    // Init settings + ground view
    initSettings();
    initGroundView();

    // Listen for settings changes to apply maxAircraft + refreshRate dynamically
    window.addEventListener('wartrack-settings-changed', (e) => {
      const s = e.detail;
      // Max aircraft is read by flights.js on next update cycle
      if (s.maxAircraft) {
        window._wartracMaxCivilian = parseInt(s.maxAircraft) || 1500;
      }
    });

    // Init auth, favorites, market, cinematic, alerts
    await initAuth();
    initFavorites();
    initMarketPanel();
    initCinematic(viewer);
    initAlerts(viewer);
    initNexus(viewer);

    // Data layers are NOT fetched on load — user toggles them on
    // Track which layers have been loaded at least once
    const layersLoaded = { flights: false, vessels: false, satellites: false };

    // When user toggles a layer ON, fetch data if not yet loaded
    window.addEventListener('wartrack-layer-activated', (e) => {
      const layer = e.detail?.layer;
      if (layer === 'flights' && !layersLoaded.flights) {
        layersLoaded.flights = true;
        updateFlights(viewer).catch(e => console.warn('Flight fetch:', e.message));
      }
      if (layer === 'vessels' && !layersLoaded.vessels) {
        layersLoaded.vessels = true;
        updateVessels(viewer).catch(e => console.warn('Vessel fetch:', e.message));
      }
      if (layer === 'satellites' && !layersLoaded.satellites) {
        layersLoaded.satellites = true;
        // Satellites init already fetches TLEs — just propagate
        updateSatellites(viewer);
      }
    });

    // Update stats periodically
    setInterval(updateStats, 3000);

    // Refresh active layers every 60 seconds (skip during replay)
    setInterval(() => {
      if (isReplayMode()) return;
      if (layersLoaded.flights) updateFlights(viewer);
      if (layersLoaded.vessels) updateVessels(viewer);
    }, 60000);

    // Propagate satellite positions every 10 seconds (only if loaded)
    setInterval(() => {
      if (!isReplayMode() && layersLoaded.satellites) updateSatellites(viewer);
    }, 10000);

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

    // Correlation engine — runs every 15 seconds, fuses all layer data
    setInterval(() => {
      if (!isReplayMode()) runCorrelation(viewer);
    }, 15000);
    // First correlation after data loads
    setTimeout(() => runCorrelation(viewer), 5000);

    // Expose correlator for Nexus
    window._getGlobalIntelSummary = getGlobalIntelSummary;
    window._getRegionIntel = getRegionIntel;

    // Event detection + position snapshots — every 60 seconds
    setInterval(() => {
      const flightDS = viewer.dataSources.getByName('flights')[0];
      const vesselDS = viewer.dataSources.getByName('vessels')[0];
      if (flightDS && vesselDS) {
        const flightMap = new Map();
        const vesselMap = new Map();
        for (const e of flightDS.entities.values) {
          if (e.acData) flightMap.set(e.acData.icao24, e);
        }
        for (const e of vesselDS.entities.values) {
          if (e.vesselData) vesselMap.set(e.vesselData.mmsi || e.id, e);
        }
        takeSnapshot(flightMap, vesselMap);

        // Also store entity positions for replay
        const positionSnapshot = {
          timestamp: Date.now(),
          flights: [],
          vessels: [],
        };
        for (const [id, e] of flightMap) {
          const ac = e.acData;
          if (ac) positionSnapshot.flights.push({ icao24: ac.icao24, lat: ac.latitude, lon: ac.longitude, alt: ac.altitude, heading: ac.heading, isMil: ac.isMilitary, callsign: ac.callsign });
        }
        for (const [id, e] of vesselMap) {
          const v = e.vesselData;
          if (v) positionSnapshot.vessels.push({ mmsi: v.mmsi, lat: v.lat, lon: v.lon, name: v.name, heading: v.heading });
        }
        // Store in snapshot-store for replay
        pushSnapshot(positionSnapshot);
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

    // Collapsible HUD sections — all section titles toggle their body
    document.querySelectorAll('.hud-section-title[data-section]').forEach(title => {
      title.addEventListener('click', () => {
        const sectionId = title.dataset.section;
        const body = document.getElementById(`section-${sectionId}`);
        if (body) {
          title.classList.toggle('collapsed');
          body.classList.toggle('collapsed');
          // Update arrow
          const arrow = title.querySelector('.section-arrow');
          if (arrow) arrow.textContent = title.classList.contains('collapsed') ? '▸' : '▾';
        }
      });
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
