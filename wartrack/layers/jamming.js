/**
 * @module jamming
 * GPS jamming / interference layer for WarTrack.
 * Renders a hex-grid (H3) visualization of inferred GPS degradation.
 * Dual-source: ADSB-X (real NACp/NIC/SIL) or OpenSky (heuristic baro/geo altitude divergence).
 */

// ============================================
// GPS JAMMING / INTERFERENCE LAYER
// Hex-grid visualization of inferred GPS degradation
// Dual-source: ADSB-X (real NACp) or OpenSky (heuristic fallback)
// ============================================

import { appState, updateStats } from '../main.js';
import { pushSnapshot } from '../data/snapshot-store.js';
import { apiUrl } from '../config.js';
import { dedupFetch } from '../utils/dedup-fetch.js';

/**
 * @typedef {Object} ScoredAircraft
 * @property {string} icao24 - ICAO 24-bit transponder address
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {number|null} baroAlt - Barometric altitude (meters)
 * @property {number|null} geoAlt - Geometric/GPS altitude (meters)
 * @property {number|null} velocity - Ground speed
 * @property {number|null} heading - Track heading
 * @property {number} score - Composite anomaly score (0-1)
 * @property {'normal'|'low'|'moderate'|'high'} severity - Classified severity
 * @property {string[]} indicators - List of triggered heuristic codes
 */

/**
 * @typedef {Object} HexCell
 * @property {number} count - Number of scored aircraft in the cell
 * @property {number} totalScore - Sum of all aircraft scores
 * @property {number} maxScore - Highest individual aircraft score
 * @property {string} maxSeverity - Highest severity label in the cell
 * @property {ScoredAircraft[]} aircraft - Aircraft contributing to this cell
 * @property {number} [avgScore] - Average score (computed after aggregation)
 * @property {'normal'|'low'|'moderate'|'high'} [severity] - Final cell severity
 */

/**
 * @typedef {Object} JammingStats
 * @property {number} totalCells - Total rendered hex cells
 * @property {number} highCells - Cells at 'high' severity
 * @property {number} moderateCells - Cells at 'moderate' severity
 */

/** @type {Cesium.CustomDataSource|null} Cesium data source for hex polygons */
let dataSource = null;

/** @type {Map<string, Cesium.Entity>} Active hex cell entities keyed by H3 index */
let hexEntities = new Map();

/** @type {boolean} Whether the jamming layer is currently visible */
let visible = false; // off by default

/** @type {'adsbx'|'opensky'} Active data source mode */
let dataSourceMode = 'opensky'; // 'adsbx' or 'opensky'

/** @type {Map<string, {lat: number, lon: number, timestamp: number}>} Previous positions for jump detection, keyed by icao24 */
let previousPositions = new Map(); // for position-jump detection

/** @type {JammingStats} Current jamming statistics */
let jammingStats = { totalCells: 0, highCells: 0, moderateCells: 0 };

/**
 * @constant {Object<string, {fill: string, outline: string, label: string}>}
 * Color scale for hex cell severity rendering (CSS color strings with alpha).
 */
const HEX_COLORS = {
  normal:   { fill: '#00ff8860', outline: '#00ff88cc', label: 'NORMAL' },
  low:      { fill: '#ffdd4470', outline: '#ffdd44cc', label: 'LOW' },
  moderate: { fill: '#ffaa0088', outline: '#ffaa00dd', label: 'MODERATE' },
  high:     { fill: '#ff3344aa', outline: '#ff3344ee', label: 'HIGH' },
};

// ============================================
// INIT
// ============================================

/**
 * Initializes the jamming layer. Creates the Cesium data source, checks for
 * ADSB-X availability, and registers a listener for flight data updates.
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 */
export async function initJamming(viewer) {
  dataSource = new Cesium.CustomDataSource('jamming');
  viewer.dataSources.add(dataSource);
  dataSource.show = false;

  // Check if ADSB-X is available
  try {
    const resp = await fetch(apiUrl('/api/adsbx/status'));
    const data = await resp.json();
    if (data.available) {
      dataSourceMode = 'adsbx';
      console.log('  GPS Jamming: ADSB-X mode (real NACp/NIC/SIL)');
    } else {
      console.log('  GPS Jamming: OpenSky heuristic mode (baro/geo altitude divergence)');
    }
  } catch {
    console.log('  GPS Jamming: OpenSky heuristic mode (fallback)');
  }

  // Listen for flight data updates from flights.js
  window.addEventListener('wartrack-flight-data', (e) => {
    if (visible) {
      processFlightData(e.detail.states, viewer);
    }
  });
}

// ============================================
// AIRCRAFT SCORING
// ============================================

/**
 * Scores a single aircraft for GPS anomaly indicators using heuristics:
 * baro/geo altitude divergence, position jumps, and missing geo altitude.
 * @param {Array} state - OpenSky state vector (positional array)
 * @returns {ScoredAircraft|null} Scored result, or null if aircraft is on ground or missing position
 */
function scoreAircraft(state) {
  const icao24 = (state[0] || '').toUpperCase();
  const lat = state[6];
  const lon = state[5];
  const baroAlt = state[7];
  const geoAlt = state[13];
  const velocity = state[9];
  const heading = state[10];

  if (!lat || !lon) return null;
  if (state[8]) return null; // on ground

  let score = 0;
  const indicators = [];

  // Heuristic 1: Barometric vs geometric altitude divergence
  // Normal: up to ~600ft due to QNH/pressure.
  // Suspicious: >1000ft. High confidence: >2000ft.
  if (baroAlt != null && geoAlt != null && baroAlt > 0 && geoAlt > 0) {
    const divergenceFt = Math.abs(baroAlt - geoAlt) * 3.281;
    if (divergenceFt > 3000) {
      score += 0.7;
      indicators.push('ALT_DIVERGE_SEVERE');
    } else if (divergenceFt > 2000) {
      score += 0.5;
      indicators.push('ALT_DIVERGE_HIGH');
    } else if (divergenceFt > 1000) {
      score += 0.25;
      indicators.push('ALT_DIVERGE_MOD');
    }
    // Below 1000ft: normal atmospheric variation, not scored
  }

  // Heuristic 2: Position jump detection
  const prevPos = previousPositions.get(icao24);
  if (prevPos && prevPos.lat && prevPos.lon) {
    const dlat = Math.abs(lat - prevPos.lat);
    const dlon = Math.abs(lon - prevPos.lon);
    const distDeg = Math.sqrt(dlat * dlat + dlon * dlon);
    const distKm = distDeg * 111; // rough degrees to km

    // If position jumped > 50km in one update cycle (60s), suspicious
    if (distKm > 50) {
      score += 0.4;
      indicators.push('POS_JUMP');
    }
  }
  previousPositions.set(icao24, { lat, lon, timestamp: Date.now() });

  // Heuristic 3: Missing geo altitude when baro exists (possible GPS loss)
  if (baroAlt != null && baroAlt > 0 && (geoAlt == null || geoAlt === 0)) {
    score += 0.15;
    indicators.push('NO_GEO_ALT');
  }

  score = Math.min(score, 1.0);

  return {
    icao24, lat, lon, baroAlt, geoAlt, velocity, heading,
    score,
    severity: classifySeverity(score),
    indicators
  };
}

/**
 * Maps a numeric anomaly score to a severity label.
 * @param {number} score - Anomaly score (0-1)
 * @returns {'normal'|'low'|'moderate'|'high'} Severity classification
 */
function classifySeverity(score) {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'moderate';
  if (score >= 0.1) return 'low';
  return 'normal';
}

// ============================================
// H3 HEX AGGREGATION
// ============================================

/**
 * Returns the H3 resolution to use. Fixed at 4 (~22km edge) to avoid
 * visual flicker from resolution changes that destroy and recreate entities.
 * @param {Cesium.Viewer} viewer - The Cesium viewer (unused, kept for future dynamic resolution)
 * @returns {number} H3 resolution level
 */
function getResolution(viewer) {
  // Fixed resolution 4 (~22km edge) — avoids flicker from resolution changes
  // Resolution changes destroy all hex entities and recreate with new H3 indices,
  // which causes visual disappearance. Consistent resolution keeps cells stable.
  return 4;
}

/**
 * Aggregates scored aircraft into H3 hex cells. Computes per-cell average/max
 * scores and classifies severity, boosting if many aircraft are affected.
 * @param {ScoredAircraft[]} scoredAircraft - Aircraft with anomaly scores
 * @param {number} resolution - H3 resolution level
 * @returns {Map<string, HexCell>} Map of H3 index to aggregated cell data
 */
function aggregateToHex(scoredAircraft, resolution) {
  const cells = new Map();

  for (const ac of scoredAircraft) {
    if (!ac || ac.score < 0.15) continue; // skip low-anomaly aircraft — only show meaningful signals

    try {
      const h3Index = h3.latLngToCell(ac.lat, ac.lon, resolution);
      if (!cells.has(h3Index)) {
        cells.set(h3Index, {
          count: 0,
          totalScore: 0,
          maxScore: 0,
          maxSeverity: 'normal',
          aircraft: [],
        });
      }
      const cell = cells.get(h3Index);
      cell.count++;
      cell.totalScore += ac.score;
      cell.maxScore = Math.max(cell.maxScore, ac.score);
      cell.aircraft.push(ac);
    } catch { /* skip invalid coordinates */ }
  }

  // Compute averages and classify
  for (const [idx, cell] of cells) {
    cell.avgScore = cell.totalScore / cell.count;
    cell.severity = classifySeverity(cell.avgScore);
    // Boost severity if multiple aircraft are affected
    if (cell.count >= 5 && cell.avgScore >= 0.2) {
      cell.severity = cell.avgScore >= 0.4 ? 'high' : 'moderate';
    }
  }

  return cells;
}

// ============================================
// PROCESS FLIGHT DATA → SCORE → AGGREGATE → RENDER
// ============================================

/**
 * Main processing pipeline: scores all aircraft, aggregates into hex cells,
 * filters for meaningful signals, renders polygons, updates stats, and
 * pushes a snapshot for replay.
 * @param {Array<Array>} states - Raw OpenSky state vectors
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 */
function processFlightData(states, viewer) {
  if (!states || !visible) return;

  const resolution = getResolution(viewer);

  // Score all aircraft
  const scored = [];
  for (const state of states) {
    const result = scoreAircraft(state);
    if (result) scored.push(result);
  }

  // Aggregate into hex cells
  const allCells = aggregateToHex(scored, resolution);

  // Filter: only render cells with meaningful anomaly signal
  // Require avgScore >= 0.3 AND at least 2 affected aircraft, OR any aircraft with score >= 0.5
  const cells = new Map();
  for (const [idx, cell] of allCells) {
    if ((cell.avgScore >= 0.3 && cell.count >= 2) || cell.maxScore >= 0.5) {
      cells.set(idx, cell);
    }
  }

  // Render hex polygons
  renderHexCells(cells, viewer);

  // Update stats
  let highCount = 0, modCount = 0;
  for (const [, cell] of cells) {
    if (cell.severity === 'high') highCount++;
    else if (cell.severity === 'moderate') modCount++;
  }
  jammingStats = { totalCells: cells.size, highCells: highCount, moderateCells: modCount };
  appState.jammingCells = cells.size;

  // Dispatch event for alerts engine
  if (highCount > 0 || modCount > 0) {
    window.dispatchEvent(new CustomEvent('wartrack-jamming-update', {
      detail: { highCells: highCount, moderateCells: modCount, totalCells: cells.size }
    }));
  }

  // Push snapshot for replay
  pushSnapshot({
    timestamp: Date.now(),
    hexCells: Array.from(cells.entries()).map(([idx, data]) => ({
      h3Index: idx,
      avgScore: data.avgScore,
      count: data.count,
      severity: data.severity,
    })),
    stats: { totalCells: cells.size, highCells: highCount, moderateCells: modCount },
  });
}

// ============================================
// HEX CELL RENDERING
// ============================================

/**
 * Renders or updates hex cell polygons on the Cesium data source.
 * Creates new entities for new H3 indices, updates colors for existing ones,
 * and removes stale cells no longer present.
 * @param {Map<string, HexCell>} cells - Current hex cells to render
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 */
function renderHexCells(cells, viewer) {
  dataSource.entities.suspendEvents();

  const activeIndices = new Set();

  for (const [h3Index, cellData] of cells) {
    activeIndices.add(h3Index);
    const colors = HEX_COLORS[cellData.severity] || HEX_COLORS.normal;

    const existing = hexEntities.get(h3Index);
    if (existing) {
      // Update color
      existing.polygon.material = Cesium.Color.fromCssColorString(colors.fill);
      existing.polygon.outlineColor = Cesium.Color.fromCssColorString(colors.outline);
      existing.hexData = cellData;
    } else {
      // Get hex boundary and create polygon
      try {
        const boundary = h3.cellToBoundary(h3Index);
        const positions = boundary.map(([lat, lng]) =>
          Cesium.Cartesian3.fromDegrees(lng, lat, 0)
        );

        const entity = dataSource.entities.add({
          id: `hex-${h3Index}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.fromCssColorString(colors.fill),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(colors.outline),
            outlineWidth: 1,
            height: 500, // above surface for visibility + avoid z-fighting
          }
        });
        entity.hexData = cellData;
        entity.entityType = 'jammingCell';
        entity.h3Index = h3Index;
        hexEntities.set(h3Index, entity);
      } catch { /* invalid hex boundary */ }
    }
  }

  // Remove stale cells
  for (const [h3Index, entity] of hexEntities) {
    if (!activeIndices.has(h3Index)) {
      dataSource.entities.remove(entity);
      hexEntities.delete(h3Index);
    }
  }

  dataSource.entities.resumeEvents();
  viewer.scene.requestRender();
}

// ============================================
// REPLAY — render from snapshot data
// ============================================

/**
 * Renders jamming hex cells from a previously saved snapshot (for replay mode).
 * @param {Array<{h3Index: string, avgScore: number, count: number, severity: string}>} snapshotHexCells - Saved hex cell data
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 */
export function renderFromSnapshot(snapshotHexCells, viewer) {
  if (!dataSource) return;
  const cells = new Map();
  for (const cell of snapshotHexCells) {
    cells.set(cell.h3Index, cell);
  }
  renderHexCells(cells, viewer);
}

// ============================================
// UPDATE (called by main.js interval — for ADSB-X mode)
// ============================================

/**
 * Periodic update function called by main.js. In OpenSky mode this is a no-op
 * (data arrives via events). In ADSB-X mode, fetches aircraft quality data
 * directly and scores using NACp/NIC/SIL values.
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 */
export async function updateJamming(viewer) {
  if (!visible) return;

  // In OpenSky mode, data comes via wartrack-flight-data event — nothing to do here
  if (dataSourceMode === 'opensky') return;

  // ADSB-X mode: fetch quality data directly
  try {
    const resp = await dedupFetch(apiUrl('/api/adsbx'));
    const data = await resp.json();
    if (!data.aircraft || !data.available) return;

    const scored = [];
    for (const ac of data.aircraft) {
      if (!ac.lat || !ac.lon || ac.onGround) continue;

      let score = 0;
      const indicators = [];

      // Direct NACp scoring
      if (ac.nacp != null) {
        if (ac.nacp < 4) { score = 0.9; indicators.push('NACP_CRITICAL'); }
        else if (ac.nacp < 7) { score = 0.6; indicators.push('NACP_DEGRADED'); }
        else if (ac.nacp < 9) { score = 0.3; indicators.push('NACP_LOW'); }
      }

      // NIC supplement
      if (ac.nic != null && ac.nic < 4) {
        score = Math.max(score, 0.5);
        indicators.push('NIC_LOW');
      }

      // SIL supplement
      if (ac.sil != null && ac.sil < 2) {
        score = Math.max(score, 0.4);
        indicators.push('SIL_LOW');
      }

      scored.push({
        icao24: ac.icao24, lat: ac.lat, lon: ac.lon,
        baroAlt: ac.alt, geoAlt: ac.geoAlt,
        score: Math.min(score, 1),
        severity: classifySeverity(Math.min(score, 1)),
        indicators,
      });
    }

    const resolution = getResolution(viewer);
    const cells = aggregateToHex(scored, resolution);
    renderHexCells(cells, viewer);

    // Stats
    let highCount = 0, modCount = 0;
    for (const [, cell] of cells) {
      if (cell.severity === 'high') highCount++;
      else if (cell.severity === 'moderate') modCount++;
    }
    jammingStats = { totalCells: cells.size, highCells: highCount, moderateCells: modCount };
    appState.jammingCells = cells.size;
  } catch (err) {
    console.warn('ADSB-X fetch error:', err.message);
  }
}

// ============================================
// VISIBILITY
// ============================================

/**
 * Toggles the jamming layer visibility. When turned on, dispatches a
 * 'wartrack-jamming-request' event to trigger an immediate data refresh.
 * @param {boolean} v - Whether the layer should be visible
 */
export function setJammingVisible(v) {
  visible = v;
  dataSource.show = v;
  // If just turned on, trigger an update from cached flight data
  if (v) {
    window.dispatchEvent(new CustomEvent('wartrack-jamming-request'));
  }
}

// ============================================
// STATS
// ============================================

/**
 * Returns the current jamming statistics summary.
 * @returns {JammingStats}
 */
export function getJammingStats() {
  return jammingStats;
}
