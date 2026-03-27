// ============================================
// LAYER CONTROLS — HUD toggle + icon size management
// ============================================

import { emit } from '../event-bus.js';

// Global icon scale multipliers per layer
export const iconScales = {
  flights: 1.0,
  vessels: 1.0,
  satellites: 1.0,
};

export function initLayerControls(callbacks) {
  // Layer toggles
  document.getElementById('toggle-flights')?.addEventListener('change', (e) => callbacks.onFlightsToggle(e.target.checked));
  document.getElementById('toggle-military')?.addEventListener('change', (e) => callbacks.onMilitaryToggle(e.target.checked));
  document.getElementById('toggle-vessels')?.addEventListener('change', (e) => callbacks.onVesselsToggle(e.target.checked));
  document.getElementById('toggle-hotspots')?.addEventListener('change', (e) => callbacks.onHotspotsToggle(e.target.checked));
  document.getElementById('toggle-thermal')?.addEventListener('change', (e) => callbacks.onThermalToggle(e.target.checked));
  document.getElementById('toggle-cameras')?.addEventListener('change', (e) => callbacks.onCamerasToggle(e.target.checked));
  document.getElementById('toggle-satellites')?.addEventListener('change', (e) => callbacks.onSatellitesToggle(e.target.checked));
  document.getElementById('toggle-solarsystem')?.addEventListener('change', (e) => callbacks.onSolarSystemToggle(e.target.checked));

  // Icon size sliders for all layers
  setupSizer('sizer-flights', 'flights', 10, callbacks.onFlightsResize);
  setupSizer('sizer-vessels', 'vessels', 14, callbacks.onVesselsResize);
  setupSizer('sizer-hotspots', 'hotspots', 48, callbacks.onHotspotsResize);
  setupSizer('sizer-satellites', 'satellites', 8, callbacks.onSatellitesResize);
  setupSizer('sizer-cameras', 'cameras', 20, callbacks.onCamerasResize);
  setupSizer('sizer-social', 'social', 20, callbacks.onSocialResize);

  // Coverage cone toggle
  const toggleCoverage = document.getElementById('toggle-coverage');
  if (toggleCoverage) {
    toggleCoverage.addEventListener('change', (e) => {
      if (callbacks.onCoverageToggle) callbacks.onCoverageToggle(e.target.checked);
    });
  }

  // Social intel toggle
  const toggleSocial = document.getElementById('toggle-social');
  if (toggleSocial) {
    toggleSocial.addEventListener('change', (e) => {
      if (callbacks.onSocialToggle) callbacks.onSocialToggle(e.target.checked);
    });
  }

  // GPS Jamming toggle
  const toggleJamming = document.getElementById('toggle-jamming');
  if (toggleJamming) {
    toggleJamming.addEventListener('change', (e) => {
      if (callbacks.onJammingToggle) callbacks.onJammingToggle(e.target.checked);
    });
  }
}

function setupSizer(sliderId, layerKey, defaultVal, callback) {
  const slider = document.getElementById(sliderId);
  const valEl = document.getElementById(sliderId + '-val');
  if (!slider) return;

  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    const scale = val / defaultVal;
    iconScales[layerKey] = scale;
    if (valEl) valEl.textContent = scale.toFixed(1) + 'x';
    // Dispatch resize event for the layer to pick up
    emit('icon:resize', { layer: layerKey, scale, baseSize: val });
    if (callback) callback(scale);
  });
}
