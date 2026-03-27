/**
 * @module correlator
 * Cross-layer intelligence fusion engine. Aggregates flights, vessels, jamming,
 * news, and satellites into per-region threat assessments every 15 seconds.
 */

// ============================================
// CORRELATOR — Cross-layer intelligence fusion engine
// Aggregates flights, vessels, jamming, news, satellites
// into per-region threat assessments every 15 seconds
// ============================================

import { appState } from '../main.js';
import { emit } from '../event-bus.js';
import { getHotspots } from './hotspots.js';
import { _getNewsCache } from './news.js';
import { inRegion, createAssessment, computeThreatScore, WEIGHTS, REGION_RADIUS_DEG } from './correlator-logic.js';

/**
 * @typedef {Object} RegionAssessment
 * @property {string} name - Hotspot/region display name
 * @property {number} lat - Region center latitude
 * @property {number} lon - Region center longitude
 * @property {string} baseSeverity - Hotspot base severity from hotspots config
 * @property {number} milAircraftCount - Military aircraft in region
 * @property {number} civAircraftCount - Civilian aircraft in region
 * @property {number} totalAircraftCount - All aircraft in region
 * @property {number} vesselCount - AIS vessel count in region
 * @property {number} jammingCells - Number of GPS jamming hex cells
 * @property {number} jammingAvgScore - Average jamming score (0-1)
 * @property {number} satCount - Surveillance satellites overhead
 * @property {number} newsCount - Recent OSINT/news article count
 * @property {Array} recentNews - Recent news article references
 * @property {'GREEN'|'YELLOW'|'ORANGE'|'RED'} threatLevel - Classified threat level
 * @property {number} compositeScore - Weighted composite threat score (0-1)
 * @property {string[]} signals - Human-readable evidence strings
 * @property {number} timestamp - Assessment generation time (epoch ms)
 */

// ============================================
// REGION STATE — live intelligence picture per hotspot
// ============================================

/** @type {Map<string, RegionAssessment>} Live intelligence map keyed by hotspot name */
let regionIntel = new Map(); // hotspot.name → RegionAssessment

/** @type {number} Timestamp of the last correlation run */
let lastCorrelation = 0;

/** @constant {number} Minimum interval between correlation runs in milliseconds */
const CORRELATION_INTERVAL = 15000; // 15 seconds

// WEIGHTS, REGION_RADIUS_DEG, inRegion, createAssessment, computeThreatScore
// are imported from correlator-logic.js

// ============================================
// REGION ASSESSMENT STRUCTURE
// ============================================

// createAssessment is now imported from correlator-logic.js

// ============================================
// DISTANCE CHECK (degrees, rough)
// ============================================

// inRegion is now imported from correlator-logic.js

// ============================================
// CORE CORRELATION — called every 15s
// ============================================

/**
 * Runs the cross-layer correlation engine. Gathers entity data from all Cesium
 * data sources (flights, vessels, jamming, satellites), scores each hotspot region,
 * and dispatches a 'wartrack-correlation' CustomEvent with the results.
 * Throttled to run at most once per CORRELATION_INTERVAL.
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance with loaded data sources
 */
export function runCorrelation(viewer) {
  const now = Date.now();
  if (now - lastCorrelation < CORRELATION_INTERVAL) return;
  lastCorrelation = now;

  const hotspots = getHotspots();
  const newIntel = new Map();

  // Gather all entity data from datasources
  const flightDS = viewer.dataSources.getByName('flights')[0];
  const vesselDS = viewer.dataSources.getByName('vessels')[0];
  const jammingDS = viewer.dataSources.getByName('jamming')[0];
  const satDS = viewer.dataSources.getByName('satellites')[0];

  // Build flat arrays for efficient iteration
  const flights = [];
  if (flightDS) {
    for (const e of flightDS.entities.values) {
      if (e.acData) flights.push(e.acData);
    }
  }

  const vessels = [];
  if (vesselDS) {
    for (const e of vesselDS.entities.values) {
      if (e.vesselData) vessels.push(e.vesselData);
    }
  }

  const jammingCells = [];
  if (jammingDS) {
    for (const e of jammingDS.entities.values) {
      if (e.hexData) jammingCells.push(e.hexData);
    }
  }

  const sats = [];
  if (satDS) {
    for (const e of satDS.entities.values) {
      if (e.satData) sats.push(e.satData);
    }
  }

  // Get cached news counts
  const newsCounts = getNewsCounts();

  // ============================================
  // PER-REGION ANALYSIS
  // ============================================
  for (const hs of hotspots) {
    const assessment = createAssessment(hs);

    // Count aircraft in region
    for (const ac of flights) {
      if (inRegion(ac.latitude, ac.longitude, hs.lat, hs.lon)) {
        assessment.totalAircraftCount++;
        if (ac.isMilitary) assessment.milAircraftCount++;
        else assessment.civAircraftCount++;
      }
    }

    // Count vessels in region
    for (const v of vessels) {
      if (inRegion(v.lat, v.lon, hs.lat, hs.lon)) {
        assessment.vesselCount++;
      }
    }

    // Count jamming cells in region (use H3 cell center approx)
    let jammingTotal = 0, jammingScoreSum = 0;
    for (const cell of jammingCells) {
      // Hex cells don't have lat/lon directly; use count presence
      jammingTotal++;
      jammingScoreSum += cell.avgScore || 0;
    }
    // Rough: distribute jamming proportionally (since we can't easily geo-filter H3)
    // Better approach: store lat/lon on hex entities
    assessment.jammingCells = jammingTotal;
    assessment.jammingAvgScore = jammingTotal > 0 ? jammingScoreSum / jammingTotal : 0;

    // Count satellites overhead
    for (const sat of sats) {
      if (sat.latitude && sat.longitude && inRegion(sat.latitude, sat.longitude, hs.lat, hs.lon)) {
        assessment.satCount++;
      }
    }

    // News activity
    assessment.newsCount = newsCounts[hs.name] || 0;

    // Compute composite threat score and classify threat level
    computeThreatScore(assessment, hs.severity);
    assessment.timestamp = now;

    newIntel.set(hs.name, assessment);
  }

  regionIntel = newIntel;

  // Dispatch correlation event for other systems to consume
  emit('correlation:update', { regions: Object.fromEntries(regionIntel) });
}

// ============================================
// NEWS COUNT HELPER — reads from cached news layer
// ============================================

/**
 * Reads article counts per region from the global news cache.
 * @returns {Object<string, number>} Map of region name to article count
 */
function getNewsCounts() {
  const counts = {};
  const newsCache = _getNewsCache();
  if (newsCache) {
    for (const [name, cached] of Object.entries(newsCache)) {
      counts[name] = cached.articles?.length || 0;
    }
  }
  return counts;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Returns the full region intelligence map.
 * @returns {Map<string, RegionAssessment>} All current region assessments keyed by name
 */
export function getRegionIntel() {
  return regionIntel;
}

/**
 * Retrieves the assessment for a single region by name.
 * @param {string} regionName - The hotspot/region name to look up
 * @returns {RegionAssessment|null} The assessment, or null if not found
 */
export function getRegionAssessment(regionName) {
  return regionIntel.get(regionName) || null;
}

/**
 * Returns a compact summary of threat levels for all regions.
 * @returns {Object<string, {level: string, score: number, signals: number}>} Threat level per region
 */
export function getAllThreatLevels() {
  const levels = {};
  for (const [name, assessment] of regionIntel) {
    levels[name] = {
      level: assessment.threatLevel,
      score: assessment.compositeScore,
      signals: assessment.signals.length,
    };
  }
  return levels;
}

/**
 * Returns structured intelligence context for a region, formatted for Nexus AI consumption.
 * @param {string} regionName - The region to retrieve context for
 * @returns {Object|null} Flattened intel object with formatted scores, or null if unavailable
 */
export function getIntelContextForRegion(regionName) {
  const a = regionIntel.get(regionName);
  if (!a) return null;
  return {
    region: a.name,
    threatLevel: a.threatLevel,
    compositeScore: a.compositeScore.toFixed(2),
    militaryAircraft: a.milAircraftCount,
    civilianAircraft: a.civAircraftCount,
    vessels: a.vesselCount,
    jammingCells: a.jammingCells,
    jammingAvgScore: a.jammingAvgScore.toFixed(2),
    satellites: a.satCount,
    newsArticles: a.newsCount,
    signals: a.signals,
  };
}

/**
 * Returns a global briefing summary of all regions with meaningful threat activity.
 * Filters to regions with compositeScore > 0.2 and sorts descending by score.
 * @returns {Array<{region: string, threatLevel: string, score: string, milAircraft: number, vessels: number, jammingCells: number, topSignal: string}>}
 */
export function getGlobalIntelSummary() {
  const summary = [];
  for (const [name, a] of regionIntel) {
    if (a.compositeScore > 0.2) {
      summary.push({
        region: name,
        threatLevel: a.threatLevel,
        score: a.compositeScore.toFixed(2),
        milAircraft: a.milAircraftCount,
        vessels: a.vesselCount,
        jammingCells: a.jammingCells,
        topSignal: a.signals[0] || 'Baseline activity',
      });
    }
  }
  return summary.sort((a, b) => b.score - a.score);
}
