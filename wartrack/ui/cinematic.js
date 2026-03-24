// ============================================
// CINEMATIC MODE — Auto-tour through global hotspots
// ============================================

import { getHotspots } from '../layers/hotspots.js';

let isActive = false;
let currentStop = 0;
let overlayEl = null;
let timeoutId = null;

const SEVERITY_COLORS = { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' };
const DWELL_TIME = 6000; // 6s at each hotspot

// ============================================
// INIT
// ============================================
export function initCinematic(viewer) {
  const btn = document.getElementById('btn-cinematic');
  btn?.addEventListener('click', () => {
    if (isActive) stopCinematic(viewer);
    else startCinematic(viewer);
  });
}

// ============================================
// START
// ============================================
function startCinematic(viewer) {
  isActive = true;
  currentStop = 0;

  const btn = document.getElementById('btn-cinematic');
  if (btn) btn.textContent = '■ EXIT CINEMATIC';

  // Create overlay
  overlayEl = document.createElement('div');
  overlayEl.id = 'cinematic-overlay';
  overlayEl.innerHTML = `
    <div class="cinematic-info" id="cinematic-info"></div>
    <div class="cinematic-controls">
      <button class="cinematic-btn" id="cinematic-prev">◀ PREV</button>
      <span class="cinematic-progress" id="cinematic-progress"></span>
      <button class="cinematic-btn" id="cinematic-next">NEXT ▸</button>
      <button class="cinematic-btn cinematic-exit" id="cinematic-exit">EXIT</button>
    </div>
  `;
  document.body.appendChild(overlayEl);

  document.getElementById('cinematic-exit').addEventListener('click', () => stopCinematic(viewer));
  document.getElementById('cinematic-next').addEventListener('click', () => {
    clearTimeout(timeoutId);
    currentStop++;
    flyToNextHotspot(viewer);
  });
  document.getElementById('cinematic-prev').addEventListener('click', () => {
    clearTimeout(timeoutId);
    currentStop = Math.max(0, currentStop - 1);
    flyToNextHotspot(viewer);
  });

  // Disable request render mode for smooth animation
  viewer.scene.requestRenderMode = false;

  flyToNextHotspot(viewer);
}

// ============================================
// STOP
// ============================================
function stopCinematic(viewer) {
  isActive = false;
  clearTimeout(timeoutId);
  viewer.scene.requestRenderMode = true;

  const btn = document.getElementById('btn-cinematic');
  if (btn) btn.textContent = '▶ CINEMATIC';

  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

// ============================================
// FLY TO NEXT HOTSPOT
// ============================================
function flyToNextHotspot(viewer) {
  const hotspots = getHotspots();
  if (currentStop >= hotspots.length) {
    // Tour complete — return to globe view
    updateOverlay(null, hotspots.length, hotspots.length);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(30, 30, 18000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 2,
      complete: () => stopCinematic(viewer),
    });
    return;
  }

  const hs = hotspots[currentStop];
  updateOverlay(hs, currentStop, hotspots.length);

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(hs.lon, hs.lat, 2500000),
    orientation: {
      heading: Cesium.Math.toRadians(15),
      pitch: Cesium.Math.toRadians(-40),
      roll: 0,
    },
    duration: 2,
    complete: () => {
      if (!isActive) return;
      // Dwell then advance
      timeoutId = setTimeout(() => {
        if (!isActive) return;
        currentStop++;
        flyToNextHotspot(viewer);
      }, DWELL_TIME);
    },
  });
}

// ============================================
// UPDATE OVERLAY
// ============================================
function updateOverlay(hs, index, total) {
  const info = document.getElementById('cinematic-info');
  const progress = document.getElementById('cinematic-progress');
  if (!info || !progress) return;

  if (!hs) {
    info.innerHTML = '<div class="cinematic-title">TOUR COMPLETE</div>';
    progress.textContent = '';
    return;
  }

  const color = SEVERITY_COLORS[hs.severity] || '#ffdd44';
  info.innerHTML = `
    <div class="cinematic-region" style="color:${color}">${hs.name.toUpperCase()}</div>
    <div class="cinematic-badge" style="border-color:${color};color:${color}">${hs.severity.toUpperCase()}</div>
    <div class="cinematic-summary">${hs.summary}</div>
  `;
  progress.textContent = `${index + 1} / ${total}`;
}
