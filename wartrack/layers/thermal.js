/**
 * @module thermal
 * @description Thermal view layer — applies a white-hot FLIR / thermal optic post-processing
 * effect to the Cesium globe. Desaturates and dims base tiles, adds a green-tint overlay
 * and vignette, and switches tracked objects (flights, satellites) to white-hot rendering.
 */

// ============================================
// THERMAL VIEW — White-Hot FLIR / Thermal Optic Mode
// Globe stays visible with readable labels and borders
// ============================================

import { appState } from '../main.js';
import { setFlightsThermal } from './flights.js';
import { setSatellitesThermal } from './satellites.js';

/** @type {boolean} Whether thermal mode is currently active */
let thermalActive = false;

// ============================================
// INIT
// ============================================
/**
 * Initialize the thermal layer by creating the color overlay DOM element.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 */
export function initThermal(viewer) {
  const overlay = document.createElement('div');
  overlay.id = 'thermal-color-overlay';
  overlay.className = 'hidden';
  document.body.appendChild(overlay);
}

// ============================================
// TOGGLE THERMAL VIEW
// ============================================
/**
 * Toggle thermal (white-hot FLIR) view on or off. Adjusts globe tile layers,
 * atmosphere settings, overlay elements, and tracked-object rendering.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @param {boolean} active - Whether to enable (true) or disable (false) thermal mode
 * @returns {Promise<void>}
 */
export async function toggleThermal(viewer, active) {
  thermalActive = active;
  appState.thermalActive = active;

  const vignette = document.getElementById('vignette-overlay');
  const thermalOverlay = document.getElementById('thermal-color-overlay');

  // Access the separate base and label tile layers
  const baseLayer = window._baseTileLayer;
  const labelLayer = window._labelTileLayer;

  if (active) {
    // === ENABLE WHITE-HOT FLIR MODE ===
    document.body.classList.add('thermal-active');

    // Scope vignette
    vignette.classList.remove('hidden');
    vignette.classList.add('active');

    // Green tint overlay
    if (thermalOverlay) {
      thermalOverlay.classList.remove('hidden');
      thermalOverlay.classList.add('active');
    }

    // Dark globe base
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#080c10');

    // Dim atmosphere but keep faint edge glow
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.brightnessShift = -0.6;
      viewer.scene.skyAtmosphere.saturationShift = -1.0;
    }
    viewer.scene.globe.showGroundAtmosphere = false;

    // BASE TILES: dim and desaturated — terrain visible as dark shapes
    if (baseLayer) {
      baseLayer.brightness = 0.5;
      baseLayer.contrast = 1.8;
      baseLayer.saturation = 0.0;
      baseLayer.hue = 0.0;
    }

    // LABEL TILES: keep bright so country/city names and borders are readable
    if (labelLayer) {
      labelLayer.brightness = 1.2;   // brighter than normal — labels pop in thermal
      labelLayer.contrast = 1.5;
      labelLayer.saturation = 0.0;   // monochrome
      labelLayer.hue = 0.0;
    }

    // White-hot tracked objects
    setFlightsThermal(true);
    try { setSatellitesThermal(true); } catch { /* optional */ }

  } else {
    // === DISABLE THERMAL MODE ===
    document.body.classList.remove('thermal-active');

    vignette.classList.add('hidden');
    vignette.classList.remove('active');
    if (thermalOverlay) {
      thermalOverlay.classList.add('hidden');
      thermalOverlay.classList.remove('active');
    }

    // Restore globe
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1220');

    // Restore atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.brightnessShift = -0.15;
      viewer.scene.skyAtmosphere.saturationShift = -0.3;
    }
    viewer.scene.globe.showGroundAtmosphere = true;

    // Restore base tiles (satellite defaults)
    if (baseLayer) {
      baseLayer.brightness = 0.85;
      baseLayer.contrast = 1.1;
      baseLayer.saturation = 0.8;
      baseLayer.hue = 0.0;
    }

    // Restore label tiles
    if (labelLayer) {
      labelLayer.brightness = 1.0;
      labelLayer.contrast = 1.0;
      labelLayer.saturation = 0.0;
      labelLayer.hue = 0.0;
    }

    // Restore tracked object visuals
    setFlightsThermal(false);
    try { setSatellitesThermal(false); } catch { /* optional */ }
  }

  viewer.scene.requestRender();
}

/** @type {boolean} Exported reactive flag indicating whether thermal mode is active */
export { thermalActive };
