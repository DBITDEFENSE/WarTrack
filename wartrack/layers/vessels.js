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

// Ship type classification
const SHIP_TYPES = {
  CARGO: { color: '#0088ff', label: 'CARGO' },
  TANKER: { color: '#ff8800', label: 'TANKER' },
  PASSENGER: { color: '#00cc44', label: 'PASSENGER' },
  MILITARY: { color: '#ff3344', label: 'MILITARY' },
  FISHING: { color: '#44aaff', label: 'FISHING' },
  TUG: { color: '#aa88ff', label: 'TUG' },
  OTHER: { color: '#6688aa', label: 'VESSEL' }
};

function classifyShipType(shipType) {
  if (!shipType) return SHIP_TYPES.OTHER;
  const t = Number(shipType);
  if (t >= 70 && t <= 79) return SHIP_TYPES.CARGO;
  if (t >= 80 && t <= 89) return SHIP_TYPES.TANKER;
  if (t >= 60 && t <= 69) return SHIP_TYPES.PASSENGER;
  if (t >= 35 && t <= 39) return SHIP_TYPES.MILITARY;
  if (t === 30) return SHIP_TYPES.FISHING;
  if (t >= 31 && t <= 32) return SHIP_TYPES.TUG;
  return SHIP_TYPES.OTHER;
}

function createShipSvg(color) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="1" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#glow)">
        <polygon points="10,2 16,14 10,12 4,14" fill="${color}" opacity="0.85"/>
      </g>
    </svg>
  `)}`;
}

// ============================================
// INIT
// ============================================
export function initVessels(viewer) {
  dataSource = new Cesium.CustomDataSource('vessels');
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
            image: createShipSvg(shipClass.color),
            width: 14 * vesselIconScale,
            height: 14 * vesselIconScale,
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
