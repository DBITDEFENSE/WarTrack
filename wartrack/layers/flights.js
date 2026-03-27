/**
 * @module flights
 * @description Flights layer — OpenSky Network integration with type-differentiated
 * icons, nation flags, and military trail rendering on CesiumJS globe.
 */

/**
 * @typedef {Object} AircraftData
 * @property {string} icao24 - ICAO 24-bit transponder address (hex, uppercased)
 * @property {string} callsign - ATC callsign or 'UNKNOWN'
 * @property {boolean} isMilitary - Whether the aircraft is classified as military
 * @property {string} origin - ICAO country code of aircraft origin
 * @property {number} longitude - Longitude in degrees
 * @property {number} latitude - Latitude in degrees
 * @property {number} altitude - Altitude in meters (baro or geo)
 * @property {number|null} baroAlt - Barometric altitude in meters
 * @property {number|null} geoAlt - Geometric (GPS) altitude in meters
 * @property {number} velocity - Ground speed in m/s
 * @property {number} heading - True heading in degrees clockwise from north
 * @property {number} verticalRate - Vertical rate in m/s
 * @property {boolean} onGround - Whether the aircraft is on the ground
 * @property {string} squawk - Transponder squawk code
 * @property {string|null} typeCode - ICAO aircraft type designator
 * @property {string|null} sizeCategory - ADS-B size category
 * @property {Object|null} typeInfo - Resolved aircraft type metadata
 * @property {string} iconClass - Resolved icon class (e.g. 'widebody', 'helicopter')
 * @property {Object|null} nation - Resolved nation info with flag and name
 */

// ============================================
// FLIGHTS LAYER — OpenSky Network Integration
// Type-differentiated icons, nation flags, military trails
// ============================================

import { appState, updateStats } from '../main.js';
import { getAircraftIcon, getThermalIcon, AIRCRAFT_COLORS, resolveIconClass } from '../data/icons.js';
import { resolveNation } from '../data/classify.js';
import { apiUrl } from '../config.js';
import { dedupFetch } from '../utils/dedup-fetch.js';
import { emit, on } from '../event-bus.js';
import { getState } from '../store.js';

/** @type {Map<string, Cesium.Entity>} Active flight entities keyed by ICAO24 hex */
let flightEntities = new Map();
/** @type {Map<string, {positions: Cesium.Cartesian3[], entity: Cesium.Entity}>} Military trail polylines keyed by ICAO24 */
let flightTrails = new Map();
/** @type {Cesium.CustomDataSource|null} Cesium data source for all flight entities */
let dataSource = null;
/** @type {boolean} Whether the flights layer is currently visible */
let visible = true;
/** @type {Object|null} Loaded military hex prefix and callsign pattern data */
let militaryData = null;
/** @type {Object|null} Loaded aircraft type code lookup table */
let aircraftTypes = null;

/** @type {string|null} Pre-cached thermal-mode icon data URI */
let ICON_THERMAL = null;

/**
 * Returns the maximum number of civilian aircraft to render.
 * @returns {number} Configurable via store 'maxCivilian', defaults to 1500
 */
function getMaxCivilian() { return getState('maxCivilian') || 1500; }
/** @constant {number} Maximum number of positions retained per military trail */
const MAX_TRAIL_POINTS = 15;
/** @type {number} Current icon scale factor, adjustable via resize events */
let iconScale = 1.0;
/** @type {boolean} When true, fetches flights globally instead of viewport-only */
let globalMode = false;

// Global flights toggle
document.getElementById('toggle-global-flights')?.addEventListener('change', (e) => {
  globalMode = e.target.checked;
});

// Listen for icon resize events
on('icon:resize', (detail) => {
  if (detail.layer !== 'flights') return;
  iconScale = detail.scale;
  // Update all existing entity billboard sizes
  for (const [icao, entity] of flightEntities) {
    const ac = entity.acData;
    if (!ac) continue;
    const size = getIconSize(ac);
    entity.billboard.width = size.w;
    entity.billboard.height = size.h;
  }
  window.viewer?.scene?.requestRender();
});

// ============================================
// LOAD DATA
// ============================================
/**
 * Loads military hex/callsign data and aircraft type lookup tables.
 * Fetches from local JSON files; results are cached after first call.
 * @returns {Promise<void>}
 */
async function loadData() {
  if (militaryData) return;
  const [milResp, typesResp] = await Promise.all([
    fetch('./data/military-hex.json'),
    fetch('./data/aircraft-types.json')
  ]);
  militaryData = await milResp.json();
  aircraftTypes = await typesResp.json();
}

// ============================================
// MILITARY DETECTION
// ============================================
/**
 * Checks if an ICAO24 hex address belongs to a known military allocation.
 * @param {string} icao24 - ICAO 24-bit hex address
 * @returns {boolean}
 */
function isMilitaryHex(icao24) {
  if (!icao24) return false;
  const upper = icao24.toUpperCase();
  for (const prefix of militaryData.prefixes) {
    if (upper.startsWith(prefix)) return true;
  }
  return !!militaryData.knownHex[upper];
}

/**
 * Checks if a callsign matches known military callsign patterns.
 * @param {string} callsign - ATC callsign string
 * @returns {boolean}
 */
function isMilitaryCallsign(callsign) {
  if (!callsign) return false;
  const upper = callsign.trim().toUpperCase();
  return militaryData.callsignPatterns.some(p => upper.startsWith(p));
}

/**
 * Classifies a raw OpenSky state vector into a structured AircraftData object.
 * Determines military status, aircraft type, icon class, and nation.
 * @param {Array} state - Raw OpenSky state vector array
 * @returns {AircraftData} Classified aircraft data
 */
function classifyAircraft(state) {
  const icao24 = (state[0] || '').toUpperCase();
  const callsign = (state[1] || '').trim();
  const isMil = isMilitaryHex(icao24) || isMilitaryCallsign(callsign);

  // Type lookup: try ICAO type code patterns in callsign (limited but better than nothing)
  // OpenSky doesn't return aircraft type directly — this is a best-effort lookup
  let typeInfo = null;
  if (aircraftTypes) {
    // Try 4-char, 3-char, 2-char prefix matches
    typeInfo = aircraftTypes[callsign.substring(0, 4)]
            || aircraftTypes[callsign.substring(0, 3)]
            || null;
  }

  // ICAO type code from ADSB-X (index 15) and size category (index 16)
  const typeCode = state[15] || null;
  const sizeCategory = state[16] || null;

  const ac = {
    icao24,
    callsign: callsign || 'UNKNOWN',
    isMilitary: isMil,
    origin: state[2] || '--',
    longitude: state[5],
    latitude: state[6],
    altitude: state[7] || state[13] || 0,
    baroAlt: state[7],
    geoAlt: state[13],
    velocity: state[9] || 0,
    heading: state[10] || 0,
    verticalRate: state[11] || 0,
    onGround: state[8],
    squawk: state[14] || '--',
    typeCode,
    sizeCategory,
    typeInfo
  };

  // Resolve icon class: use ICAO type code first, then category, then heuristics
  ac.iconClass = resolveIconClass(typeCode, sizeCategory, isMil);
  ac.nation = resolveNation(ac);

  return ac;
}

// ============================================
// ICON RESOLVER — returns correct icon for aircraft state
// ============================================
/**
 * Resolves the billboard icon for an aircraft based on current display mode.
 * Returns thermal icon when thermal mode is active, otherwise type-colored icon.
 * @param {AircraftData} ac - Classified aircraft data
 * @returns {string} Data URI for the SVG icon
 */
function getIconForAircraft(ac) {
  if (appState.thermalActive) return ICON_THERMAL;
  const color = ac.isMilitary ? AIRCRAFT_COLORS.military : AIRCRAFT_COLORS.civilian;
  return getAircraftIcon(ac.iconClass, color);
}

/**
 * Returns pixel dimensions for an aircraft billboard based on type and scale.
 * @param {AircraftData} ac - Classified aircraft data
 * @returns {{w: number, h: number}} Width and height in pixels
 */
function getIconSize(ac) {
  if (appState.thermalActive) return { w: 8 * iconScale, h: 8 * iconScale };
  const s = iconScale;
  if (ac.isMilitary) return { w: 22 * s, h: 22 * s };
  switch (ac.iconClass) {
    case 'widebody': return { w: 18 * s, h: 18 * s };
    case 'airliner': return { w: 15 * s, h: 15 * s };
    case 'regional': return { w: 12 * s, h: 12 * s };
    case 'helicopter': return { w: 14 * s, h: 14 * s };
    case 'light': return { w: 10 * s, h: 10 * s };
    default: return { w: 13 * s, h: 13 * s };
  }
}

// ============================================
// LABEL TEXT — callsign + flag for military
// ============================================
/**
 * Builds label text for military aircraft (flag + callsign). Returns null for civilians.
 * @param {AircraftData} ac - Classified aircraft data
 * @returns {string|null} Label string or null if not military
 */
function buildLabelText(ac) {
  if (!ac.isMilitary) return null;
  const flag = ac.nation?.flag || '';
  return `${flag} ${ac.callsign}`;
}

// ============================================
// INIT
// ============================================
/**
 * Initializes the flights layer: loads reference data, creates the Cesium data source.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @returns {Promise<void>}
 */
export async function initFlights(viewer) {
  await loadData();
  ICON_THERMAL = getThermalIcon();
  dataSource = new Cesium.CustomDataSource('flights');
  dataSource.show = false; // hidden until user enables
  viewer.dataSources.add(dataSource);
}

// ============================================
// HOTSPOT REGIONS — fetch these on initial load for quick data
// ============================================
/**
 * @constant {Array<{lamin:number,lamax:number,lomin:number,lomax:number}>}
 * Predefined bounding boxes for geopolitical hotspot regions fetched on initial load.
 */
const HOTSPOT_BBOXES = [
  { lamin: 44, lamax: 53, lomin: 24, lomax: 40 },   // Ukraine
  { lamin: 20, lamax: 27, lomin: 118, lomax: 123 },  // Taiwan Strait
  { lamin: 10, lamax: 20, lomin: 38, lomax: 48 },    // Red Sea
  { lamin: 23, lamax: 30, lomin: 51, lomax: 60 },    // Strait of Hormuz
  { lamin: 29, lamax: 33, lomin: 32, lomax: 37 },    // Gaza
  { lamin: 5, lamax: 18, lomin: 108, lomax: 120 },   // South China Sea
  { lamin: 35, lamax: 42, lomin: 124, lomax: 130 },  // Korea DMZ
];

/**
 * Computes a lat/lon bounding box from the current camera viewport.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @returns {{lamin:string,lamax:string,lomin:string,lomax:string}|null} Bbox or null if globe edges not visible
 */
function getViewportBbox(viewer) {
  try {
    const canvas = viewer.scene.canvas;
    const corners = [
      new Cesium.Cartesian2(0, 0),
      new Cesium.Cartesian2(canvas.width, 0),
      new Cesium.Cartesian2(0, canvas.height),
      new Cesium.Cartesian2(canvas.width, canvas.height),
      new Cesium.Cartesian2(canvas.width / 2, canvas.height / 2),
    ];
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    let valid = 0;
    for (const c of corners) {
      const ray = viewer.camera.getPickRay(c);
      if (!ray) continue;
      const pos = viewer.scene.globe.pick(ray, viewer.scene);
      if (!pos) continue;
      const carto = Cesium.Cartographic.fromCartesian(pos);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      valid++;
    }
    if (valid < 2) return null; // zoomed out too far, globe edges not hitting
    // Clamp and add padding
    const pad = Math.max(2, (maxLat - minLat) * 0.1);
    return {
      lamin: Math.max(-90, minLat - pad).toFixed(1),
      lamax: Math.min(90, maxLat + pad).toFixed(1),
      lomin: Math.max(-180, minLon - pad).toFixed(1),
      lomax: Math.min(180, maxLon + pad).toFixed(1),
    };
  } catch { return null; }
}

/**
 * Fetches flight state vectors for a geographic bounding box from the server proxy.
 * @param {{lamin:number,lamax:number,lomin:number,lomax:number}} bbox - Bounding box
 * @returns {Promise<Array>} Array of OpenSky state vectors, or empty on error
 */
async function fetchRegion(bbox) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s client timeout
    const resp = await dedupFetch(
      apiUrl(`/api/flights?lamin=${bbox.lamin}&lamax=${bbox.lamax}&lomin=${bbox.lomin}&lomax=${bbox.lomax}`),
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      return data?.states || [];
    }
  } catch { /* ignore */ }
  return [];
}

// ============================================
// FETCH & UPDATE — viewport + hotspot based
// ============================================
/**
 * Main update loop: fetches flight data (global or viewport+hotspot) and renders entities.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @returns {Promise<void>}
 */
export async function updateFlights(viewer) {
  if (!dataSource) return;
  try {
    let allStates = [];

    // GLOBAL MODE — fetch everything from all regions worldwide
    if (globalMode) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const resp = await dedupFetch(apiUrl('/api/flights?global=1'), { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          allStates = data?.states || [];
        }
      } catch { /* timeout */ }
      if (allStates.length > 0) {
        processStates(viewer, allStates, true);
        return;
      }
    }

    // VIEWPORT MODE — fetch hotspot regions first, then viewport
    if (flightEntities.size === 0) {
      const initialBatch = HOTSPOT_BBOXES.slice(0, 3);
      const results = await Promise.all(initialBatch.map(fetchRegion));
      for (const states of results) allStates.push(...states);

      // Fetch remaining hotspots in background (don't block)
      Promise.all(HOTSPOT_BBOXES.slice(3).map(fetchRegion)).then(results => {
        const extraStates = results.flat();
        if (extraStates.length > 0) {
          processStates(viewer, extraStates, false); // merge, don't clear
        }
      }).catch(() => {});
    }

    // Also fetch current viewport
    const bbox = getViewportBbox(viewer);
    if (bbox) {
      const viewStates = await fetchRegion(bbox);
      allStates.push(...viewStates);
    }

    if (allStates.length === 0 && flightEntities.size > 0) return; // keep existing
    if (allStates.length === 0) return;

    processStates(viewer, allStates, true);

  } catch (err) {
    console.warn('Flight data fetch error:', err);
  }
}

/**
 * Processes raw state vectors: classifies, creates/updates Cesium entities, removes stale ones.
 * Military aircraft always rendered; civilians capped at getMaxCivilian().
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @param {Array} states - Raw OpenSky state vector arrays
 * @param {boolean} clearStale - If true, removes entities not present in this batch
 */
function processStates(viewer, states, clearStale) {
    const activeIcaos = new Set();
    let totalFlights = 0;
    let milCount = 0;

    const militaryAc = [];
    const civilianAc = [];

    for (const state of states) {
      if (!state[5] || !state[6]) continue;
      if (state[8]) continue;

      const ac = classifyAircraft(state);
      totalFlights++;
      if (ac.isMilitary) {
        milCount++;
        militaryAc.push(ac);
      } else {
        civilianAc.push(ac);
      }
    }

    const cappedCiv = civilianAc.slice(0, getMaxCivilian());

    dataSource.entities.suspendEvents();

    const toRender = [...militaryAc, ...cappedCiv];
    for (const ac of toRender) {
      activeIcaos.add(ac.icao24);

      const icon = getIconForAircraft(ac);
      const size = getIconSize(ac);

      const existing = flightEntities.get(ac.icao24);
      if (existing) {
        existing.position = Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, ac.altitude);
        existing.billboard.rotation = Cesium.Math.toRadians(-(ac.heading || 0));
        // Update icon if classification changed
        if (!appState.thermalActive) {
          existing.billboard.image = icon;
          existing.billboard.width = size.w;
          existing.billboard.height = size.h;
        }
        existing.acData = ac;

        if (ac.isMilitary) {
          addTrailPoint(ac.icao24, ac.longitude, ac.latitude, ac.altitude);
        }
      } else {
        const labelText = buildLabelText(ac);
        const entity = dataSource.entities.add({
          id: `flight-${ac.icao24}`,
          position: Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, ac.altitude),
          billboard: {
            image: icon,
            width: size.w,
            height: size.h,
            rotation: Cesium.Math.toRadians(-(ac.heading || 0)),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: 0,
            scaleByDistance: new Cesium.NearFarScalar(5e5, 1.2, 1.5e7, 0.3),
          },
          label: labelText ? {
            text: labelText,
            font: '11px Share Tech Mono',
            fillColor: Cesium.Color.fromCssColorString('#ff3344'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: 0,
            scaleByDistance: new Cesium.NearFarScalar(5e5, 1, 1.5e7, 0.25),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
          } : undefined
        });
        entity.acData = ac;
        entity.entityType = 'flight';
        flightEntities.set(ac.icao24, entity);

        if (ac.isMilitary) {
          initTrail(ac.icao24, ac.longitude, ac.latitude, ac.altitude);
        }
      }
    }

    // Remove stale entities only on full refresh (not incremental merge)
    if (clearStale) {
      for (const [icao, entity] of flightEntities) {
        if (!activeIcaos.has(icao)) {
          dataSource.entities.remove(entity);
          flightEntities.delete(icao);
          removeTrail(icao);
        }
      }
    }

    dataSource.entities.resumeEvents();

    appState.flightCount = flightEntities.size;
    appState.militaryCount = milCount;
    appState.lastRefresh = Date.now();
    updateStats();
    viewer.scene.requestRender();

    // Share raw states with jamming layer
    if (states.length > 0) {
      emit('flight:data', { states, timestamp: Math.floor(Date.now() / 1000) });
    }
}

// ============================================
// TRAIL MANAGEMENT
// ============================================
/**
 * Creates a new glowing polyline trail entity for a military aircraft.
 * @param {string} icao - ICAO24 hex identifier
 * @param {number} lon - Longitude in degrees
 * @param {number} lat - Latitude in degrees
 * @param {number} alt - Altitude in meters
 */
function initTrail(icao, lon, lat, alt) {
  const trail = {
    positions: [Cesium.Cartesian3.fromDegrees(lon, lat, alt)],
    entity: null,
  };
  trail.entity = dataSource.entities.add({
    id: `trail-${icao}`,
    polyline: {
      positions: new Cesium.CallbackProperty(() => trail.positions, false),
      width: appState.thermalActive ? 3 : 2,
      material: appState.thermalActive
        ? new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.25, color: Cesium.Color.fromCssColorString('#ffffffaa') })
        : new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.1, color: Cesium.Color.fromCssColorString('#ff334488') }),
      clampToGround: false,
    }
  });
  flightTrails.set(icao, trail);
}

/**
 * Appends a position to an existing trail, trimming to MAX_TRAIL_POINTS.
 * @param {string} icao - ICAO24 hex identifier
 * @param {number} lon - Longitude in degrees
 * @param {number} lat - Latitude in degrees
 * @param {number} alt - Altitude in meters
 */
function addTrailPoint(icao, lon, lat, alt) {
  const trail = flightTrails.get(icao);
  if (!trail) { initTrail(icao, lon, lat, alt); return; }
  trail.positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
  if (trail.positions.length > MAX_TRAIL_POINTS) trail.positions.shift();
}

/**
 * Removes a trail entity and cleans up the trail map entry.
 * @param {string} icao - ICAO24 hex identifier
 */
function removeTrail(icao) {
  const trail = flightTrails.get(icao);
  if (trail?.entity) dataSource.entities.remove(trail.entity);
  flightTrails.delete(icao);
}

// ============================================
// VISIBILITY
// ============================================
/**
 * Sets visibility of the entire flights data source.
 * @param {boolean} v - Whether to show flights
 */
export function setFlightsVisible(v) {
  visible = v;
  dataSource.show = v;
}

// ============================================
// THERMAL MODE — swap icons
// ============================================
/**
 * Toggles thermal (IR) display mode: swaps all icons to white dots and trails to white glow.
 * @param {boolean} active - Whether thermal mode is active
 */
export function setFlightsThermal(active) {
  for (const [icao, entity] of flightEntities) {
    const ac = entity.acData;
    if (active) {
      entity.billboard.image = ICON_THERMAL;
      entity.billboard.width = 8;
      entity.billboard.height = 8;
    } else {
      const icon = getIconForAircraft(ac);
      const size = getIconSize(ac);
      entity.billboard.image = icon;
      entity.billboard.width = size.w;
      entity.billboard.height = size.h;
    }
  }

  for (const [icao, trail] of flightTrails) {
    if (trail.entity?.polyline) {
      trail.entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
        glowPower: active ? 0.25 : 0.1,
        color: active
          ? Cesium.Color.fromCssColorString('#ffffffaa')
          : Cesium.Color.fromCssColorString('#ff334488')
      });
      trail.entity.polyline.width = active ? 3 : 2;
    }
  }
}
