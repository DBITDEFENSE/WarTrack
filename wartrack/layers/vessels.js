// ============================================
// VESSELS LAYER — AIS Ship Tracking
// ============================================

import { appState, updateStats } from '../main.js';
import { apiUrl } from '../config.js';

let vesselEntities = new Map();
let dataSource = null;
let visible = true;
let vesselIconScale = 1.0;

// Listen for icon resize events
window.addEventListener('wartrack-icon-resize', (e) => {
  if (e.detail.layer !== 'vessels') return;
  vesselIconScale = e.detail.scale;
  const baseSize = 14;
  for (const [id, entity] of vesselEntities) {
    entity.billboard.width = baseSize * vesselIconScale;
    entity.billboard.height = baseSize * vesselIconScale;
  }
  window.viewer?.scene?.requestRender();
});

// ============================================
// VESSEL CLASSIFICATION — AIS ship type codes → icon + color
// ============================================
const SHIP_TYPES = {
  CONTAINER:  { color: '#0088ff', label: 'CONTAINER', size: 16 },
  BULK:       { color: '#3377cc', label: 'BULK CARRIER', size: 16 },
  CARGO:      { color: '#4488dd', label: 'CARGO', size: 14 },
  TANKER:     { color: '#ff8800', label: 'TANKER', size: 16 },
  LNG:        { color: '#ffaa33', label: 'LNG TANKER', size: 17 },
  PASSENGER:  { color: '#00cc44', label: 'PASSENGER', size: 18 },
  CRUISE:     { color: '#00ee55', label: 'CRUISE', size: 20 },
  MILITARY:   { color: '#ff3344', label: 'MILITARY', size: 16 },
  FISHING:    { color: '#44aaff', label: 'FISHING', size: 10 },
  TUG:        { color: '#aa88ff', label: 'TUG', size: 10 },
  PILOT:      { color: '#ccaa44', label: 'PILOT', size: 9 },
  SAR:        { color: '#ff6644', label: 'SAR', size: 12 },
  PLEASURE:   { color: '#66ccbb', label: 'YACHT', size: 9 },
  SAIL:       { color: '#77bbaa', label: 'SAILING', size: 9 },
  OTHER:      { color: '#6688aa', label: 'VESSEL', size: 12 }
};

function classifyShipType(shipType) {
  if (!shipType) return SHIP_TYPES.OTHER;
  const t = Number(shipType);
  // Cargo sub-types
  if (t === 71 || t === 72) return SHIP_TYPES.CONTAINER;
  if (t === 73 || t === 74) return SHIP_TYPES.BULK;
  if (t >= 70 && t <= 79) return SHIP_TYPES.CARGO;
  // Tanker sub-types
  if (t === 84) return SHIP_TYPES.LNG;
  if (t >= 80 && t <= 89) return SHIP_TYPES.TANKER;
  // Passenger
  if (t === 69) return SHIP_TYPES.CRUISE;
  if (t >= 60 && t <= 69) return SHIP_TYPES.PASSENGER;
  // Military/government
  if (t >= 35 && t <= 39) return SHIP_TYPES.MILITARY;
  if (t === 55) return SHIP_TYPES.MILITARY; // law enforcement
  // Service
  if (t === 30) return SHIP_TYPES.FISHING;
  if (t >= 31 && t <= 32) return SHIP_TYPES.TUG;
  if (t === 50) return SHIP_TYPES.PILOT;
  if (t === 51) return SHIP_TYPES.SAR;
  // Pleasure/sailing
  if (t >= 36 && t <= 37) return SHIP_TYPES.PLEASURE;
  if (t === 36) return SHIP_TYPES.SAIL;
  return SHIP_TYPES.OTHER;
}

// ============================================
// VESSEL SVG SILHOUETTES — top-down, 24x24 viewBox, bow pointing up
// ============================================
const VESSEL_SHAPES = {
  // Container ship — rectangular with stacked containers
  CONTAINER: (c) => `<path d="M12 2 L14 4 L14 7 L15 7 L15 17 L14 17 L14 19 L12 20 L10 19 L10 17 L9 17 L9 7 L10 7 L10 4 Z" fill="${c}" opacity="0.9"/><line x1="9.5" y1="9" x2="14.5" y2="9" stroke="${c}" stroke-width="0.4" opacity="0.5"/><line x1="9.5" y1="12" x2="14.5" y2="12" stroke="${c}" stroke-width="0.4" opacity="0.5"/><line x1="9.5" y1="15" x2="14.5" y2="15" stroke="${c}" stroke-width="0.4" opacity="0.5"/>`,

  // Bulk carrier — wider, rounder bow
  BULK: (c) => `<path d="M12 2 L14.5 5 L15 8 L15 17 L14 19 L12 20 L10 19 L9 17 L9 8 L9.5 5 Z" fill="${c}" opacity="0.9"/>`,

  // General cargo — standard ship shape
  CARGO: (c) => `<path d="M12 2.5 L14 5 L14.5 8 L14.5 17 L13.5 19 L12 20 L10.5 19 L9.5 17 L9.5 8 L10 5 Z" fill="${c}" opacity="0.9"/>`,

  // Tanker — wide midship, rounded
  TANKER: (c) => `<path d="M12 2 L14 5 L15.5 8 L15.5 15 L15 17 L13.5 19 L12 20 L10.5 19 L9 17 L8.5 15 L8.5 8 L10 5 Z" fill="${c}" opacity="0.9"/><circle cx="12" cy="11" r="2" fill="none" stroke="${c}" stroke-width="0.4" opacity="0.4"/>`,

  // LNG tanker — tanker with dome shapes
  LNG: (c) => `<path d="M12 2 L14 5 L15.5 8 L15.5 16 L14 19 L12 20 L10 19 L8.5 16 L8.5 8 L10 5 Z" fill="${c}" opacity="0.9"/><circle cx="12" cy="9" r="1.5" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.5"/><circle cx="12" cy="13" r="1.5" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.5"/>`,

  // Passenger — sleeker, longer
  PASSENGER: (c) => `<path d="M12 1.5 L13.5 4 L14 7 L14 16 L13 18.5 L12 20 L11 18.5 L10 16 L10 7 L10.5 4 Z" fill="${c}" opacity="0.9"/><line x1="10.5" y1="6" x2="13.5" y2="6" stroke="${c}" stroke-width="0.3" opacity="0.4"/>`,

  // Cruise — large passenger, wider
  CRUISE: (c) => `<path d="M12 1 L14 4 L15 7 L15 16 L14 18.5 L12 20.5 L10 18.5 L9 16 L9 7 L10 4 Z" fill="${c}" opacity="0.9"/><line x1="9.5" y1="7" x2="14.5" y2="7" stroke="${c}" stroke-width="0.3" opacity="0.4"/><line x1="9.5" y1="10" x2="14.5" y2="10" stroke="${c}" stroke-width="0.3" opacity="0.4"/><circle cx="12" cy="4" r="1" fill="${c}" opacity="0.5"/>`,

  // Military — angular, aggressive bow
  MILITARY: (c) => `<path d="M12 1 L14 6 L14.5 9 L14.5 15 L14 17.5 L12 19 L10 17.5 L9.5 15 L9.5 9 L10 6 Z" fill="${c}" opacity="0.95"/><line x1="12" y1="7" x2="12" y2="12" stroke="${c}" stroke-width="0.5" opacity="0.4"/>`,

  // Fishing — small, with outriggers
  FISHING: (c) => `<path d="M12 3 L13.5 6 L14 9 L14 15 L13 17 L12 18 L11 17 L10 15 L10 9 L10.5 6 Z" fill="${c}" opacity="0.85"/><line x1="8" y1="10" x2="16" y2="10" stroke="${c}" stroke-width="0.4" opacity="0.4"/>`,

  // Tug — compact, powerful
  TUG: (c) => `<path d="M12 4 L13.5 6 L14 8 L14 14 L13 16 L12 17 L11 16 L10 14 L10 8 L10.5 6 Z" fill="${c}" opacity="0.9"/>`,

  // Pilot vessel — small, distinct
  PILOT: (c) => `<path d="M12 4 L13 6 L13.5 8 L13.5 14 L12.5 16 L12 17 L11.5 16 L10.5 14 L10.5 8 L11 6 Z" fill="${c}" opacity="0.85"/>`,

  // SAR — rescue vessel
  SAR: (c) => `<path d="M12 3 L14 6 L14.5 9 L14.5 15 L13.5 17 L12 18 L10.5 17 L9.5 15 L9.5 9 L10 6 Z" fill="${c}" opacity="0.9"/><line x1="10" y1="8" x2="14" y2="12" stroke="${c}" stroke-width="0.5" opacity="0.5"/><line x1="14" y1="8" x2="10" y2="12" stroke="${c}" stroke-width="0.5" opacity="0.5"/>`,

  // Pleasure/yacht — sleek, small
  PLEASURE: (c) => `<path d="M12 4 L13 7 L13.5 10 L13.5 15 L12.5 17 L12 18 L11.5 17 L10.5 15 L10.5 10 L11 7 Z" fill="${c}" opacity="0.8"/>`,

  // Sailing vessel
  SAIL: (c) => `<path d="M12 3 L13 7 L13 15 L12 17 L11 15 L11 7 Z" fill="${c}" opacity="0.8"/><path d="M13 6 L16 12 L13 12 Z" fill="${c}" opacity="0.35"/>`,

  // Generic/other
  OTHER: (c) => `<path d="M12 3 L13.5 6 L14 9 L14 16 L13 18 L12 19 L11 18 L10 16 L10 9 L10.5 6 Z" fill="${c}" opacity="0.8"/>`,
};

const vesselIconCache = new Map();

function createShipSvg(shipClass) {
  const key = `${shipClass.label}-${shipClass.color}`;
  if (vesselIconCache.has(key)) return vesselIconCache.get(key);

  const shapeFn = VESSEL_SHAPES[Object.keys(SHIP_TYPES).find(k => SHIP_TYPES[k] === shipClass)] || VESSEL_SHAPES.OTHER;
  const svg = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${shapeFn(shipClass.color)}</svg>`
  )}`;
  vesselIconCache.set(key, svg);
  return svg;
}

// ============================================
// INIT
// ============================================
export function initVessels(viewer) {
  dataSource = new Cesium.CustomDataSource('vessels');
  dataSource.show = false; // hidden until user enables
  viewer.dataSources.add(dataSource);
}

// ============================================
// FETCH & UPDATE — Uses proxy for AISHub/MarineTraffic-like data
// We use a simplified approach via proxy returning AIS data
// ============================================
export async function updateVessels(viewer) {
  if (!dataSource) return; // not initialized yet
  try {
    let vessels = [];
    try {
      const resp = await fetch(apiUrl(`/api/vessels`));
      vessels = await resp.json();
    } catch {
      // ignored
    }

    // Use sample data if API returned nothing
    if (!Array.isArray(vessels) || vessels.length === 0) {
      vessels = generateSampleVessels();
    }

    const activeIds = new Set();
    let count = 0;

    for (const v of vessels) {
      if (!v.lon || !v.lat) continue;
      const id = v.mmsi || v.id || `vessel-${count}`;
      activeIds.add(id);
      count++;

      const shipClass = classifyShipType(v.shipType);

      const existing = vesselEntities.get(id);
      if (existing) {
        existing.position = Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 0);
        existing.billboard.rotation = Cesium.Math.toRadians(-(v.heading || v.cog || 0));
        existing.vesselData = v;
      } else {
        const entity = dataSource.entities.add({
          id: `vessel-${id}`,
          position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 0),
          billboard: {
            image: createShipSvg(shipClass),
            width: (shipClass.size || 14) * vesselIconScale,
            height: (shipClass.size || 14) * vesselIconScale,
            rotation: Cesium.Math.toRadians(-(v.heading || v.cog || 0)),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: 0,
            scaleByDistance: new Cesium.NearFarScalar(1e5, 1.2, 1e7, 0.2),
          }
        });
        entity.vesselData = v;
        entity.vesselClass = shipClass;
        entity.entityType = 'vessel';
        vesselEntities.set(id, entity);
      }
    }

    // Remove stale
    for (const [id, entity] of vesselEntities) {
      if (!activeIds.has(id)) {
        dataSource.entities.remove(entity);
        vesselEntities.delete(id);
      }
    }

    appState.vesselCount = count;
    updateStats();
    viewer.scene.requestRender();

  } catch (err) {
    console.warn('Vessel data fetch error:', err);
  }
}

// ============================================
// SAMPLE DATA (when proxy not available)
// ============================================
function generateSampleVessels() {
  const lanes = [
    // Primary chokepoints — coordinates tightened to actual water areas
    { latStart: 33, latEnd: 36, lonStart: 0, lonEnd: 30, name: 'Mediterranean', count: 30 },
    { latStart: 49, latEnd: 51, lonStart: -2, lonEnd: 4, name: 'English Channel', count: 18 },
    { latStart: 1, latEnd: 4, lonStart: 101, lonEnd: 105, name: 'Strait of Malacca', count: 25 },
    { latStart: 25.5, latEnd: 27, lonStart: 55.5, lonEnd: 56.8, name: 'Strait of Hormuz', count: 15 },
    { latStart: 13, latEnd: 15, lonStart: 42, lonEnd: 43.5, name: 'Red Sea/Bab al-Mandab', count: 18 },
    { latStart: 29.8, latEnd: 31.5, lonStart: 32.2, lonEnd: 33, name: 'Suez Canal', count: 12 },
    // East Asia — shifted to open water
    { latStart: 25, latEnd: 32, lonStart: 125, lonEnd: 135, name: 'East China Sea', count: 22 },
    { latStart: 8, latEnd: 16, lonStart: 112, lonEnd: 118, name: 'South China Sea', count: 20 },
    { latStart: 33, latEnd: 35, lonStart: 128, lonEnd: 132, name: 'Korea Strait', count: 12 },
    // Americas — shifted offshore
    { latStart: 37, latEnd: 41, lonStart: -73, lonEnd: -69, name: 'US East Coast', count: 18 },
    { latStart: 33, latEnd: 37, lonStart: -121, lonEnd: -118, name: 'US West Coast', count: 15 },
    { latStart: 26, latEnd: 29, lonStart: -92, lonEnd: -87, name: 'Gulf of Mexico', count: 14 },
    { latStart: 8, latEnd: 9.5, lonStart: -79.8, lonEnd: -79, name: 'Panama Canal', count: 10 },
    // Africa / Indian Ocean
    { latStart: -35, latEnd: -33, lonStart: 17, lonEnd: 19, name: 'Cape of Good Hope', count: 10 },
    { latStart: 11, latEnd: 13, lonStart: 44, lonEnd: 50, name: 'Gulf of Aden', count: 12 },
    { latStart: 20, latEnd: 24, lonStart: 62, lonEnd: 68, name: 'Arabian Sea', count: 14 },
    { latStart: -3, latEnd: 3, lonStart: 72, lonEnd: 82, name: 'Indian Ocean Central', count: 10 },
    // Europe — tightened to open water
    { latStart: 55, latEnd: 58, lonStart: 14, lonEnd: 22, name: 'Baltic Sea', count: 15 },
    { latStart: 56, latEnd: 60, lonStart: 1, lonEnd: 5, name: 'North Sea', count: 12 },
    // Oceania — offshore
    { latStart: -36, latEnd: -32, lonStart: 150, lonEnd: 154, name: 'Australian East Coast', count: 10 },
    { latStart: 0, latEnd: 5, lonStart: 115, lonEnd: 125, name: 'Indonesian Archipelago', count: 14 },
  ];

  const vessels = [];
  const shipNames = ['EVER GIVEN','MAERSK SEALAND','MSC OSCAR','COSCO SHIPPING','CMA CGM MARCO POLO',
    'YANG MING','HAPAG LLOYD','ONE COLUMBIA','ZIM ANTWERP','PIL TRUST','HANJIN ATHENS',
    'OOCL HONG KONG','EVERGREEN MARINE','HYUNDAI MERCHANT','K LINE EUROPE','MOL TRIUMPH',
    'NYK VENUS','PACIFIC BASIN','STENA BULK','TORM PLATA','BW TANKER','FRONTLINE SPIRIT',
    'EURONAV FORCE','TEEKAY COURAGE','NAVIOS STAR','DIANA SHIPPING','STAR BULK EAGLE',
    'SCORPIO TANKERS','ARDMORE SEA','NORDEN CARRIER','GENCO VESSEL','EAGLE BULK','SAFE BULKER'];

  let idx = 0;
  for (const lane of lanes) {
    for (let i = 0; i < lane.count; i++) {
      const lat = lane.latStart + Math.random() * (lane.latEnd - lane.latStart);
      const lon = lane.lonStart + Math.random() * (lane.lonEnd - lane.lonStart);
      const shipType = [70,71,72,73,80,81,82,60,30,36][Math.floor(Math.random() * 10)];
      vessels.push({
        mmsi: `${200000000 + idx}`,
        name: shipNames[idx % shipNames.length],
        lat, lon,
        heading: Math.random() * 360,
        cog: Math.random() * 360,
        speed: 5 + Math.random() * 15,
        shipType,
        destination: lane.name,
        flag: ['PA','LR','MH','HK','SG','MT','BS','CY','GB','NO'][Math.floor(Math.random()*10)]
      });
      idx++;
    }
  }
  return vessels;
}

// ============================================
// VISIBILITY
// ============================================
export function setVesselsVisible(v) {
  visible = v;
  dataSource.show = v;
}
