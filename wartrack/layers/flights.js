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
  viewer.dataSources.add(dataSource);
}

// ============================================
// FETCH & UPDATE
// ============================================
export async function updateFlights(viewer) {
  if (!dataSource) return; // not initialized yet
  try {
    let data;
    try {
      const resp = await fetch(apiUrl('/api/opensky'));
      if (resp.ok) data = await resp.json();
    } catch { /* ignore */ }

    if (!data || !data.states) {
      try {
        const resp = await fetch('https://opensky-network.org/api/states/all');
        if (resp.ok) data = await resp.json();
      } catch { /* ignore */ }
    }

    if (!data || !data.states) return;

    const states = data.states;
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

    // Remove stale
    for (const [icao, entity] of flightEntities) {
      if (!activeIcaos.has(icao)) {
        dataSource.entities.remove(entity);
        flightEntities.delete(icao);
        removeTrail(icao);
      }
    }

    dataSource.entities.resumeEvents();

    appState.flightCount = totalFlights;
    appState.militaryCount = milCount;
    appState.lastRefresh = Date.now();
    updateStats();
    viewer.scene.requestRender();

    // Share raw states with jamming layer (avoids duplicate API call)
    if (data.states) {
      window.dispatchEvent(new CustomEvent('wartrack-flight-data', {
        detail: { states: data.states, timestamp: data.time }
      }));
    }

  } catch (err) {
    console.warn('Flight data fetch error:', err);
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
