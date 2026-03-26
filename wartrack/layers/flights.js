// ============================================
// FLIGHTS LAYER — OpenSky Network Integration
// Type-differentiated icons, nation flags, military trails
// ============================================

import { appState, updateStats } from '../main.js';
import { getAircraftIcon, getThermalIcon, AIRCRAFT_COLORS } from '../data/icons.js';
import { classifyIconType, resolveNation } from '../data/classify.js';
import { apiUrl } from '../config.js';

let flightEntities = new Map();
let flightTrails = new Map();
let dataSource = null;
let visible = true;
let militaryData = null;
let aircraftTypes = null;

// Pre-cached thermal icon
let ICON_THERMAL = null;

// Settable via settings panel — default 1500
function getMaxCivilian() { return window._wartracMaxCivilian || 1500; }
const MAX_TRAIL_POINTS = 15;
let iconScale = 1.0;

// Listen for icon resize events
window.addEventListener('wartrack-icon-resize', (e) => {
  if (e.detail.layer !== 'flights') return;
  iconScale = e.detail.scale;
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
function isMilitaryHex(icao24) {
  if (!icao24) return false;
  const upper = icao24.toUpperCase();
  for (const prefix of militaryData.prefixes) {
    if (upper.startsWith(prefix)) return true;
  }
  return !!militaryData.knownHex[upper];
}

function isMilitaryCallsign(callsign) {
  if (!callsign) return false;
  const upper = callsign.trim().toUpperCase();
  return militaryData.callsignPatterns.some(p => upper.startsWith(p));
}

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

  const ac = {
    icao24,
    callsign: callsign || 'UNKNOWN',
    isMilitary: isMil,
    origin: state[2] || '--',
    longitude: state[5],
    latitude: state[6],
    altitude: state[7] || state[13] || 0,
    baroAlt: state[7],     // barometric altitude (meters)
    geoAlt: state[13],     // geometric/GPS altitude (meters)
    velocity: state[9] || 0,
    heading: state[10] || 0,
    verticalRate: state[11] || 0,
    onGround: state[8],
    squawk: state[14] || '--',
    typeInfo
  };

  // Resolve icon class and nation
  ac.iconClass = classifyIconType(ac, aircraftTypes);
  ac.nation = resolveNation(ac);

  return ac;
}

// ============================================
// ICON RESOLVER — returns correct icon for aircraft state
// ============================================
function getIconForAircraft(ac) {
  if (appState.thermalActive) return ICON_THERMAL;
  const color = ac.isMilitary ? AIRCRAFT_COLORS.military : AIRCRAFT_COLORS.civilian;
  return getAircraftIcon(ac.iconClass, color);
}

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
function buildLabelText(ac) {
  if (!ac.isMilitary) return null;
  const flag = ac.nation?.flag || '';
  return `${flag} ${ac.callsign}`;
}

// ============================================
// INIT
// ============================================
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
const HOTSPOT_BBOXES = [
  { lamin: 44, lamax: 53, lomin: 24, lomax: 40 },   // Ukraine
  { lamin: 20, lamax: 27, lomin: 118, lomax: 123 },  // Taiwan Strait
  { lamin: 10, lamax: 20, lomin: 38, lomax: 48 },    // Red Sea
  { lamin: 23, lamax: 30, lomin: 51, lomax: 60 },    // Strait of Hormuz
  { lamin: 29, lamax: 33, lomin: 32, lomax: 37 },    // Gaza
  { lamin: 5, lamax: 18, lomin: 108, lomax: 120 },   // South China Sea
  { lamin: 35, lamax: 42, lomin: 124, lomax: 130 },  // Korea DMZ
];

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

async function fetchRegion(bbox) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s client timeout
    const resp = await fetch(
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
export async function updateFlights(viewer) {
  if (!dataSource) return;
  try {
    // Collect states from multiple regions
    let allStates = [];

    // On first load or when zoomed out, fetch hotspot regions
    if (flightEntities.size === 0) {
      // Fetch first 3 hotspot regions in parallel for fast initial load
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
      window.dispatchEvent(new CustomEvent('wartrack-flight-data', {
        detail: { states, timestamp: Math.floor(Date.now() / 1000) }
      }));
    }
}

// ============================================
// TRAIL MANAGEMENT
// ============================================
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

function addTrailPoint(icao, lon, lat, alt) {
  const trail = flightTrails.get(icao);
  if (!trail) { initTrail(icao, lon, lat, alt); return; }
  trail.positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
  if (trail.positions.length > MAX_TRAIL_POINTS) trail.positions.shift();
}

function removeTrail(icao) {
  const trail = flightTrails.get(icao);
  if (trail?.entity) dataSource.entities.remove(trail.entity);
  flightTrails.delete(icao);
}

// ============================================
// VISIBILITY
// ============================================
export function setFlightsVisible(v) {
  visible = v;
  dataSource.show = v;
}

// ============================================
// THERMAL MODE — swap icons
// ============================================
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
