// ============================================
// SATELLITES LAYER — Live satellite tracking via CelesTrak TLE + satellite.js
// ============================================

import { appState, updateStats } from '../main.js';

let dataSource = null;
let satRecords = new Map();
let trailEntities = new Map();
let coverageEntities = new Map(); // cone/footprint entities
let visible = true;
let loaded = false;
let coverageVisible = true; // toggle for coverage visualization

const SAT_CATEGORIES = {
  ISS:      { color: '#00ff88', size: 28, label: true, trail: true, priority: 1 },
  MILITARY: { color: '#ff3344', size: 14, label: true, trail: true, priority: 2 },
  GPS:      { color: '#4488ff', size: 8,  label: false, trail: false, priority: 3 },
  WEATHER:  { color: '#00ccdd', size: 8,  label: false, trail: false, priority: 4 },
  STARLINK: { color: '#aaaacc', size: 3,  label: false, trail: false, priority: 5 },
  OTHER:    { color: '#666688', size: 5,  label: false, trail: false, priority: 6 },
};

const STARLINK_CAP = 1500;
let satIconScale = 1.0;

// Listen for icon resize
window.addEventListener('wartrack-icon-resize', (e) => {
  if (e.detail.layer !== 'satellites') return;
  satIconScale = e.detail.scale;
  for (const [noradId, rec] of satRecords) {
    if (!rec.entity) continue;
    const cat = SAT_CATEGORIES[rec.category] || SAT_CATEGORIES.OTHER;
    rec.entity.billboard.width = cat.size * satIconScale;
    rec.entity.billboard.height = cat.size * satIconScale;
  }
  window.viewer?.scene?.requestRender();
});

// ============================================
// SVG ICON GENERATOR
// ============================================
function createSatIcon(color, size) {
  const r = Math.max(size / 4, 2);
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r + 2}" fill="${color}" opacity="0.15"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="${color}" opacity="0.9"/>
    </svg>
  `)}`;
}

function createISSIcon() {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <line x1="4" y1="16" x2="28" y2="16" stroke="#00ff88" stroke-width="1.5" opacity="0.7"/>
      <line x1="16" y1="8" x2="16" y2="24" stroke="#00ff88" stroke-width="1" opacity="0.5"/>
      <rect x="6" y="13" width="6" height="6" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
      <rect x="20" y="13" width="6" height="6" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
      <circle cx="16" cy="16" r="3" fill="#00ff88" opacity="0.9"/>
      <circle cx="16" cy="16" r="5" fill="#00ff88" opacity="0.2"/>
    </svg>
  `)}`;
}

const iconCache = new Map();
function getCachedIcon(category) {
  if (iconCache.has(category)) return iconCache.get(category);
  const cat = SAT_CATEGORIES[category] || SAT_CATEGORIES.OTHER;
  const icon = category === 'ISS' ? createISSIcon() : createSatIcon(cat.color, Math.max(cat.size, 12));
  iconCache.set(category, icon);
  return icon;
}

// ============================================
// TLE PARSING
// ============================================
function parseTLE(tleText, category) {
  const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sats = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;
    const noradId = line1.substring(2, 7).trim();
    sats.push({ name, line1, line2, noradId, category });
  }
  return sats;
}

function classifyCategory(sat) {
  if (sat.noradId === '25544') return 'ISS';
  if (sat.name.startsWith('STARLINK')) return 'STARLINK';
  return sat.category || 'OTHER';
}

// ============================================
// POSITION PROPAGATION
// ============================================
function propagatePosition(satrec, date) {
  try {
    const pv = satellite.propagate(satrec, date);
    if (!pv.position || typeof pv.position === 'boolean') return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    return {
      longitude: satellite.degreesLong(geo.longitude),
      latitude: satellite.degreesLat(geo.latitude),
      altitude: geo.height * 1000, // km → m
      velocity: Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2)
    };
  } catch {
    return null;
  }
}

// ============================================
// INIT
// ============================================
export async function initSatellites(viewer) {
  dataSource = new Cesium.CustomDataSource('satellites');
  viewer.dataSources.add(dataSource);

  // Fetch TLE groups sequentially
  const groups = [
    { name: 'stations', category: 'OTHER' },
    { name: 'military', category: 'MILITARY' },
    { name: 'gps-ops', category: 'GPS' },
    { name: 'starlink', category: 'STARLINK' },
  ];

  for (const group of groups) {
    try {
      const resp = await fetch(`/api/tle?group=${group.name}`);
      if (!resp.ok) continue;
      const text = await resp.text();
      const sats = parseTLE(text, group.category);

      let starlinkCount = 0;
      for (const sat of sats) {
        const cat = classifyCategory(sat);
        if (cat === 'STARLINK') {
          starlinkCount++;
          if (starlinkCount > STARLINK_CAP) continue;
        }
        try {
          const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
          satRecords.set(sat.noradId, { satrec, name: sat.name, category: cat, entity: null });
        } catch { /* skip bad TLE */ }
      }
    } catch (err) {
      console.warn(`TLE fetch failed for ${group.name}:`, err.message);
    }
  }

  // Initial render
  renderSatellites(viewer);
  loaded = true;
}

// ============================================
// RENDER — create entities for all parsed satellites
// ============================================
function renderSatellites(viewer) {
  const now = new Date();
  dataSource.entities.suspendEvents();

  for (const [noradId, rec] of satRecords) {
    const pos = propagatePosition(rec.satrec, now);
    if (!pos) continue;

    const cat = SAT_CATEGORIES[rec.category] || SAT_CATEGORIES.OTHER;
    const cesiumPos = Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude);

    const entity = dataSource.entities.add({
      id: `sat-${noradId}`,
      position: cesiumPos,
      billboard: {
        image: getCachedIcon(rec.category),
        width: cat.size,
        height: cat.size,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1.5, 5e7, rec.category === 'STARLINK' ? 0.05 : 0.2),
      },
      label: cat.label ? {
        text: rec.category === 'ISS' ? '🛰 ISS' : rec.name.substring(0, 12),
        font: '10px Share Tech Mono',
        fillColor: Cesium.Color.fromCssColorString(cat.color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -(cat.size / 2 + 8)),
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1, 5e7, 0.2),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      } : undefined
    });

    entity.entityType = 'satellite';
    entity.satData = {
      name: rec.name,
      noradId,
      category: rec.category,
      altitude: pos.altitude,
      velocity: pos.velocity,
      latitude: pos.latitude,
      longitude: pos.longitude,
    };

    rec.entity = entity;

    // Coverage cone — tight directional sensor footprint for ISS and military
    if (cat.trail && pos.altitude > 100000 && coverageVisible) {
      createCoverageCone(noradId, pos, cat.color, cesiumPos);
    }

    // Orbital trail for ISS and military
    if (cat.trail) {
      createOrbitalTrail(noradId, rec, cat.color);
    }
  }

  dataSource.entities.resumeEvents();
  appState.satelliteCount = satRecords.size;
  updateStats();
  viewer.scene.requestRender();
}

// ============================================
// ORBITAL TRAIL — compute forward/backward path
// ============================================
function createOrbitalTrail(noradId, rec, color) {
  const positions = [];
  const now = Date.now();
  // Short trail: +/- 15 minutes only, to reduce visual clutter from wrap-around
  for (let m = -15; m <= 15; m += 2) {
    const t = new Date(now + m * 60000);
    const pos = propagatePosition(rec.satrec, t);
    if (pos) {
      positions.push(Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude));
    }
  }
  if (positions.length < 3) return;

  const trail = dataSource.entities.add({
    id: `sat-trail-${noradId}`,
    polyline: {
      positions,
      width: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.05,
        color: Cesium.Color.fromCssColorString(color).withAlpha(0.2)
      }),
      clampToGround: false,
      // Only visible when zoomed in close to the satellite
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
    }
  });
  trailEntities.set(noradId, trail);
}

// ============================================
// COVERAGE CONE — tight directional sensor footprint
// ============================================
function createCoverageCone(noradId, pos, color, satPos) {
  const altKm = pos.altitude / 1000;
  // Realistic sensor footprint: ~0.8× altitude in km as radius
  // ISS at 400km → ~320km footprint radius. Military at 500km → ~400km.
  const footprintRadius = Math.min(altKm * 800, 500000); // meters, cap at 500km
  const cesiumColor = Cesium.Color.fromCssColorString(color);

  const entities = [];

  // Ground footprint — small, tight circle
  entities.push(dataSource.entities.add({
    id: `sat-fp-${noradId}`,
    position: Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, 0),
    ellipse: {
      semiMinorAxis: footprintRadius,
      semiMajorAxis: footprintRadius,
      material: cesiumColor.withAlpha(0.04),
      outline: true,
      outlineColor: cesiumColor.withAlpha(0.2),
      outlineWidth: 1,
      height: 0,
    },
    // Only show when reasonably close
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000000),
  }));

  // Cone beam lines — 4 lines from satellite to footprint edge points
  const beamOffsetDeg = footprintRadius / 111000; // rough meters to degrees
  const beamPoints = [
    [pos.longitude, pos.latitude + beamOffsetDeg],
    [pos.longitude + beamOffsetDeg, pos.latitude],
    [pos.longitude, pos.latitude - beamOffsetDeg],
    [pos.longitude - beamOffsetDeg, pos.latitude],
  ];

  for (let i = 0; i < beamPoints.length; i++) {
    entities.push(dataSource.entities.add({
      id: `sat-beam-${noradId}-${i}`,
      polyline: {
        positions: [
          satPos,
          Cesium.Cartesian3.fromDegrees(beamPoints[i][0], beamPoints[i][1], 0)
        ],
        width: 0.5,
        material: cesiumColor.withAlpha(0.08),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
      }
    }));
  }

  // Center beam — brighter, from satellite straight down
  entities.push(dataSource.entities.add({
    id: `sat-cbeam-${noradId}`,
    polyline: {
      positions: [
        satPos,
        Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, 0)
      ],
      width: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.1,
        color: cesiumColor.withAlpha(0.2)
      }),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
    }
  }));

  // Scanning arc — animated SVG billboard on the ground that rotates
  entities.push(dataSource.entities.add({
    id: `sat-scan-${noradId}`,
    position: Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, 100),
    billboard: {
      image: createScanIcon(color, footprintRadius),
      width: Math.max(footprintRadius / 5000, 30), // scale with footprint
      height: Math.max(footprintRadius / 5000, 30),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: 0,
      rotation: new Cesium.CallbackProperty(() => {
        // Slow rotation — 1 revolution per 30 seconds
        return (Date.now() / 30000) * Math.PI * 2;
      }, false),
      scaleByDistance: new Cesium.NearFarScalar(5e5, 2.0, 1e7, 0.3),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
    }
  }));

  coverageEntities.set(noradId, entities);
}

// Animated scanning icon — 3 radial lines that rotate
function createScanIcon(color, radius) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <!-- Three scanning lines radiating from center -->
      <line x1="32" y1="32" x2="32" y2="4" stroke="${color}" stroke-width="1" opacity="0.4"/>
      <line x1="32" y1="32" x2="56" y2="46" stroke="${color}" stroke-width="1" opacity="0.3"/>
      <line x1="32" y1="32" x2="8" y2="46" stroke="${color}" stroke-width="1" opacity="0.25"/>
      <!-- Subtle center dot -->
      <circle cx="32" cy="32" r="2" fill="${color}" opacity="0.5"/>
      <!-- Faint sweep arc -->
      <path d="M32 32 L32 8 A24 24 0 0 1 53 45 Z" fill="${color}" opacity="0.03"/>
    </svg>
  `)}`;
}

// ============================================
// COVERAGE TOGGLE
// ============================================
export function setCoverageVisible(v) {
  coverageVisible = v;
  for (const [noradId, entities] of coverageEntities) {
    for (const e of entities) {
      e.show = v;
    }
  }
  window.viewer?.scene?.requestRender();
}

// ============================================
// UPDATE — re-propagate positions
// ============================================
export function updateSatellites(viewer) {
  if (!loaded) return;
  const now = new Date();

  for (const [noradId, rec] of satRecords) {
    if (!rec.entity) continue;
    const pos = propagatePosition(rec.satrec, now);
    if (!pos) continue;

    rec.entity.position = Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude);
    rec.entity.satData = {
      ...rec.entity.satData,
      altitude: pos.altitude,
      velocity: pos.velocity,
      latitude: pos.latitude,
      longitude: pos.longitude,
    };
  }
  viewer.scene.requestRender();
}

// ============================================
// VISIBILITY
// ============================================
export function setSatellitesVisible(v) {
  visible = v;
  dataSource.show = v;
}

// ============================================
// THERMAL MODE
// ============================================
export function setSatellitesThermal(active) {
  const thermalIcon = createSatIcon('#ffffff', 8);
  for (const [noradId, rec] of satRecords) {
    if (!rec.entity) continue;
    const cat = SAT_CATEGORIES[rec.category] || SAT_CATEGORIES.OTHER;
    if (active) {
      rec.entity.billboard.image = thermalIcon;
      rec.entity.billboard.width = 6;
      rec.entity.billboard.height = 6;
    } else {
      rec.entity.billboard.image = getCachedIcon(rec.category);
      rec.entity.billboard.width = cat.size;
      rec.entity.billboard.height = cat.size;
    }
  }
}
