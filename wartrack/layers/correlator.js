// ============================================
// CORRELATOR — Cross-layer intelligence fusion engine
// Aggregates flights, vessels, jamming, news, satellites
// into per-region threat assessments every 15 seconds
// ============================================

import { appState } from '../main.js';
import { getHotspots } from './hotspots.js';

// ============================================
// REGION STATE — live intelligence picture per hotspot
// ============================================
let regionIntel = new Map(); // hotspot.name → RegionAssessment
let lastCorrelation = 0;
const CORRELATION_INTERVAL = 15000; // 15 seconds
const REGION_RADIUS_DEG = 5; // ~550km radius for region capture

// Severity weights for composite scoring
const WEIGHTS = {
  milAircraft:  0.25,  // military aircraft density
  jammingScore: 0.30,  // GPS interference severity
  newsActivity: 0.15,  // recent news volume
  vesselAnomaly: 0.15, // vessel density change
  satCoverage:  0.05,  // surveillance satellite presence
  civilianFlight: 0.10, // civilian traffic (inverse — fewer = more concerning)
};

// ============================================
// REGION ASSESSMENT STRUCTURE
// ============================================
function createAssessment(hotspot) {
  return {
    name: hotspot.name,
    lat: hotspot.lat,
    lon: hotspot.lon,
    baseSeverity: hotspot.severity,
    // Layer signals
    milAircraftCount: 0,
    civAircraftCount: 0,
    totalAircraftCount: 0,
    vesselCount: 0,
    jammingCells: 0,
    jammingAvgScore: 0,
    satCount: 0,
    newsCount: 0,
    recentNews: [],
    // Computed
    threatLevel: 'GREEN',  // GREEN | YELLOW | ORANGE | RED
    compositeScore: 0,
    signals: [],           // human-readable evidence strings
    timestamp: Date.now(),
  };
}

// ============================================
// DISTANCE CHECK (degrees, rough)
// ============================================
function inRegion(entityLat, entityLon, regionLat, regionLon) {
  const dlat = Math.abs(entityLat - regionLat);
  const dlon = Math.abs(entityLon - regionLon);
  return dlat < REGION_RADIUS_DEG && dlon < REGION_RADIUS_DEG;
}

// ============================================
// CORE CORRELATION — called every 15s
// ============================================
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

    // ============================================
    // COMPOSITE THREAT SCORING
    // ============================================
    let score = 0;
    const signals = [];

    // Military aircraft signal
    if (assessment.milAircraftCount >= 10) {
      score += WEIGHTS.milAircraft * 1.0;
      signals.push(`${assessment.milAircraftCount} MIL aircraft in zone`);
    } else if (assessment.milAircraftCount >= 5) {
      score += WEIGHTS.milAircraft * 0.6;
      signals.push(`${assessment.milAircraftCount} MIL aircraft detected`);
    } else if (assessment.milAircraftCount >= 2) {
      score += WEIGHTS.milAircraft * 0.3;
    }

    // GPS jamming signal
    if (assessment.jammingAvgScore >= 0.6) {
      score += WEIGHTS.jammingScore * 1.0;
      signals.push(`GPS interference: HIGH (${assessment.jammingCells} cells)`);
    } else if (assessment.jammingAvgScore >= 0.3) {
      score += WEIGHTS.jammingScore * 0.5;
      signals.push(`GPS interference: MODERATE`);
    }

    // News volume signal
    if (assessment.newsCount >= 5) {
      score += WEIGHTS.newsActivity * 1.0;
      signals.push(`High news volume (${assessment.newsCount} articles)`);
    } else if (assessment.newsCount >= 2) {
      score += WEIGHTS.newsActivity * 0.5;
    }

    // Vessel density (high = potentially disrupted trade route)
    if (assessment.vesselCount >= 20) {
      score += WEIGHTS.vesselAnomaly * 0.3;
    } else if (assessment.vesselCount <= 2 && hs.severity !== 'watch') {
      // Low vessel count near active zone = possible avoidance
      score += WEIGHTS.vesselAnomaly * 0.8;
      signals.push(`Low vessel traffic (${assessment.vesselCount}) — possible route avoidance`);
    }

    // Civilian traffic inverse (fewer civilians = more concerning)
    if (assessment.civAircraftCount <= 5 && assessment.milAircraftCount >= 3) {
      score += WEIGHTS.civilianFlight * 0.7;
      signals.push('Low civilian air traffic in military-active zone');
    }

    // Satellite overflight
    if (assessment.satCount >= 2) {
      score += WEIGHTS.satCoverage * 0.5;
      signals.push(`${assessment.satCount} satellites overhead`);
    }

    // Base severity boost (conflict zones start elevated)
    if (hs.severity === 'high') score = Math.min(1, score + 0.15);
    else if (hs.severity === 'elevated') score = Math.min(1, score + 0.05);

    // Classify threat level
    assessment.compositeScore = Math.min(1, score);
    if (score >= 0.7) assessment.threatLevel = 'RED';
    else if (score >= 0.45) assessment.threatLevel = 'ORANGE';
    else if (score >= 0.25) assessment.threatLevel = 'YELLOW';
    else assessment.threatLevel = 'GREEN';

    assessment.signals = signals;
    assessment.timestamp = now;

    newIntel.set(hs.name, assessment);
  }

  regionIntel = newIntel;

  // Dispatch correlation event for other systems to consume
  window.dispatchEvent(new CustomEvent('wartrack-correlation', {
    detail: { regions: Object.fromEntries(regionIntel) }
  }));
}

// ============================================
// NEWS COUNT HELPER — reads from cached news layer
// ============================================
function getNewsCounts() {
  const counts = {};
  // Access the news cache via the global NEWS_CACHE if available
  if (window._newsCacheRef) {
    for (const [name, cached] of Object.entries(window._newsCacheRef)) {
      counts[name] = cached.articles?.length || 0;
    }
  }
  return counts;
}

// ============================================
// PUBLIC API
// ============================================
export function getRegionIntel() {
  return regionIntel;
}

export function getRegionAssessment(regionName) {
  return regionIntel.get(regionName) || null;
}

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

// Get structured data for Nexus AI context
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

// Get all regions summary for briefing
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
