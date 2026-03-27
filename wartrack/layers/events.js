/**
 * @module events
 * Simple anomaly detection engine for WarTrack.
 * Compares rolling data snapshots to detect unusual patterns such as
 * military aircraft spikes, traffic surges, vessel drops, and correlated escalations.
 */

// ============================================
// EVENT DETECTION — Simple anomaly detection engine
// Compares current data snapshots to detect unusual patterns
// ============================================

import { getHotspots } from './hotspots.js';
import {
  matchesConflictKeywords,
  shouldDedup as shouldDedupAlert,
  computeBaseline as computeBaselineFromSnapshots,
  detectAnomaliesForRegion,
} from './events-logic.js';

/**
 * @typedef {Object} Alert
 * @property {string} id - Unique alert identifier (e.g. "alert-1711234567890-ab3f")
 * @property {string} type - Alert type code (MIL_SPIKE, TRAFFIC_SURGE, VESSEL_DROP, CORRELATED_ESCALATION, ROUTE_AVOIDANCE, JAMMING_DETECTED, OSINT_ALERT)
 * @property {'critical'|'high'|'elevated'} severity - Alert severity level
 * @property {string} region - Region/hotspot name or 'Global'
 * @property {string} description - Human-readable alert description
 * @property {number} lat - Latitude of the alert origin
 * @property {number} lon - Longitude of the alert origin
 * @property {number} timestamp - Alert creation time (epoch ms)
 */

/**
 * @typedef {Object} RegionSnapshot
 * @property {number} flights - Total flights near the region
 * @property {number} military - Military flights near the region
 * @property {number} vessels - Vessels near the region
 */

/**
 * @typedef {Object} Snapshot
 * @property {number} timestamp - Snapshot capture time (epoch ms)
 * @property {number} totalFlights - Global flight entity count
 * @property {number} totalVessels - Global vessel entity count
 * @property {Object<string, RegionSnapshot>} regions - Per-region entity counts
 */

/** @type {Alert[]} Rolling list of active alerts, newest first */
let alerts = [];

/** @type {Snapshot[]} Rolling window of entity-count snapshots for baseline computation */
let snapshots = []; // rolling window of entity counts per region

/** @constant {number} Maximum number of snapshots retained for baseline averaging */
const MAX_SNAPSHOTS = 10;

/** @constant {number} Maximum number of alerts retained in the alerts list */
const ALERT_MAX = 20;

// ============================================
// JAMMING ALERT LISTENER
// ============================================

/** @type {number} Timestamp of the last jamming alert, for 5-minute dedup throttle */
let lastJammingAlert = 0;
window.addEventListener('wartrack-jamming-update', (e) => {
  const { highCells, moderateCells, totalCells } = e.detail || {};
  if (highCells > 0 && Date.now() - lastJammingAlert > 300000) {
    lastJammingAlert = Date.now();
    addAlert({
      type: 'JAMMING_DETECTED',
      severity: highCells >= 3 ? 'critical' : 'high',
      region: 'Global',
      description: `GPS jamming detected: ${highCells} high-severity cells, ${moderateCells} moderate (${totalCells} total)`,
      lat: 0, lon: 0,
    });
  }
});

// ============================================
// OSINT ALERT — triggered when social content has conflict keywords
// ============================================

// CONFLICT_KEYWORDS regex is now in events-logic.js; matchesConflictKeywords imported above

/**
 * Checks a list of OSINT items for conflict-keyword matches and raises an alert
 * if two or more articles match.
 * @param {Array<{title: string}>} items - OSINT/news items to scan
 * @param {string} regionName - The region these items relate to
 * @param {number} lat - Latitude for the alert
 * @param {number} lon - Longitude for the alert
 */
export function checkOsintAlert(items, regionName, lat, lon) {
  if (!items || items.length === 0) return;
  const matches = items.filter(i => matchesConflictKeywords(i.title || ''));
  if (matches.length >= 2) {
    addAlert({
      type: 'OSINT_ALERT',
      severity: matches.length >= 4 ? 'critical' : 'elevated',
      region: regionName,
      description: `OSINT spike: ${matches.length} conflict-related articles detected for ${regionName}`,
      lat: lat || 0,
      lon: lon || 0,
    });
  }
}

// ============================================
// TAKE SNAPSHOT — called each data refresh cycle
// ============================================

/**
 * Captures a snapshot of current entity counts per hotspot region and runs
 * anomaly detection against the rolling baseline. Called each data refresh cycle.
 * @param {Map} flightEntities - Map of flight entity IDs to Cesium entities with acData
 * @param {Map} vesselEntities - Map of vessel entity IDs to Cesium entities with vesselData
 */
export function takeSnapshot(flightEntities, vesselEntities) {
  const hotspots = getHotspots();
  const snapshot = {
    timestamp: Date.now(),
    totalFlights: flightEntities.size,
    totalVessels: vesselEntities.size,
    regions: {},
  };

  // Count entities near each hotspot (500km radius ≈ 4.5 degrees)
  const RADIUS_DEG = 4.5;
  for (const hs of hotspots) {
    let flightsNear = 0;
    let milNear = 0;
    let vesselsNear = 0;

    for (const [id, entity] of flightEntities) {
      const ac = entity.acData;
      if (!ac) continue;
      if (Math.abs(ac.latitude - hs.lat) < RADIUS_DEG && Math.abs(ac.longitude - hs.lon) < RADIUS_DEG) {
        flightsNear++;
        if (ac.isMilitary) milNear++;
      }
    }

    for (const [id, entity] of vesselEntities) {
      const v = entity.vesselData;
      if (!v) continue;
      if (Math.abs(v.lat - hs.lat) < RADIUS_DEG && Math.abs(v.lon - hs.lon) < RADIUS_DEG) {
        vesselsNear++;
      }
    }

    snapshot.regions[hs.name] = { flights: flightsNear, military: milNear, vessels: vesselsNear };
  }

  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();

  // Run detection rules
  detectAnomalies(snapshot);
}

// ============================================
// DETECTION RULES
// ============================================

/**
 * Runs anomaly detection rules against the current snapshot. Compares entity
 * counts to the rolling baseline and fires alerts for spikes, surges, drops,
 * correlated escalations, and route avoidance patterns.
 * Requires at least 3 prior snapshots for a meaningful baseline.
 * @param {Snapshot} current - The most recent data snapshot
 */
function detectAnomalies(current) {
  if (snapshots.length < 3) return; // need baseline

  const hotspots = getHotspots();
  const baseline = computeBaseline();

  for (const hs of hotspots) {
    const region = current.regions[hs.name];
    const base = baseline[hs.name];
    if (!region || !base) continue;

    // Rule 1: Military aircraft spike (>150% of baseline, min 3)
    if (region.military >= 3 && base.military > 0 && region.military > base.military * 1.5) {
      addAlert({
        type: 'MIL_SPIKE',
        severity: 'high',
        region: hs.name,
        description: `Military aircraft spike: ${region.military} detected (baseline: ${Math.round(base.military)})`,
        lat: hs.lat,
        lon: hs.lon,
      });
    }

    // Rule 2: Total flight surge (>200% baseline, min 20)
    if (region.flights >= 20 && base.flights > 0 && region.flights > base.flights * 2) {
      addAlert({
        type: 'TRAFFIC_SURGE',
        severity: 'elevated',
        region: hs.name,
        description: `Air traffic surge: ${region.flights} aircraft (baseline: ${Math.round(base.flights)})`,
        lat: hs.lat,
        lon: hs.lon,
      });
    }

    // Rule 3: Vessel drop (< 50% of baseline, min 3 in baseline)
    if (base.vessels >= 3 && region.vessels < base.vessels * 0.5) {
      addAlert({
        type: 'VESSEL_DROP',
        severity: 'elevated',
        region: hs.name,
        description: `Vessel activity drop: ${region.vessels} ships (baseline: ${Math.round(base.vessels)})`,
        lat: hs.lat,
        lon: hs.lon,
      });
    }

    // Rule 4: CORRELATED ESCALATION — mil spike + GPS jamming in same region
    // Uses correlation engine data if available
    try {
      const intel = window._getRegionIntel?.()?.get?.(hs.name);
      if (intel && intel.compositeScore >= 0.6 && intel.milAircraftCount >= 5 && intel.jammingCells > 0) {
        addAlert({
          type: 'CORRELATED_ESCALATION',
          severity: 'critical',
          region: hs.name,
          description: `Multi-signal escalation: ${intel.milAircraftCount} MIL aircraft + ${intel.jammingCells} jamming cells + threat score ${intel.compositeScore.toFixed(2)}`,
          lat: hs.lat,
          lon: hs.lon,
        });
      }

      // Rule 5: ROUTE AVOIDANCE — low vessel + high mil in trade route zone
      if (intel && intel.vesselCount <= 3 && intel.milAircraftCount >= 3 && hs.severity !== 'watch') {
        addAlert({
          type: 'ROUTE_AVOIDANCE',
          severity: 'elevated',
          region: hs.name,
          description: `Possible route avoidance: only ${intel.vesselCount} vessels near ${intel.milAircraftCount} military aircraft`,
          lat: hs.lat,
          lon: hs.lon,
        });
      }
    } catch { /* correlator not ready */ }
  }
}

// computeBaseline is now imported as computeBaselineFromSnapshots from events-logic.js
function computeBaseline() {
  return computeBaselineFromSnapshots(snapshots);
}

// ============================================
// ALERT MANAGEMENT
// ============================================

/**
 * Adds an alert to the alerts list with deduplication. Alerts of the same
 * type and region are suppressed for 5 minutes. Dispatches a 'wartrack-alert'
 * CustomEvent for UI consumption.
 * @param {Omit<Alert, 'id'|'timestamp'>} alert - Alert data without id/timestamp (auto-generated)
 */
function addAlert(alert) {
  // Deduplicate: don't repeat same alert type+region within 5 minutes
  const recent = alerts.find(a =>
    a.type === alert.type && a.region === alert.region &&
    Date.now() - a.timestamp < 300000
  );
  if (recent) return;

  alert.timestamp = Date.now();
  alert.id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  alerts.unshift(alert);
  if (alerts.length > ALERT_MAX) alerts.pop();

  // Dispatch event for UI
  window.dispatchEvent(new CustomEvent('wartrack-alert', { detail: alert }));
}

/**
 * Returns the full list of active alerts, newest first.
 * @returns {Alert[]}
 */
export function getAlerts() {
  return alerts;
}

/**
 * Removes an alert by its unique id.
 * @param {string} id - The alert id to dismiss
 */
export function dismissAlert(id) {
  alerts = alerts.filter(a => a.id !== id);
}

/**
 * Returns the count of alerts from the last 30 minutes.
 * @returns {number}
 */
export function getAlertCount() {
  // Only count alerts from last 30 minutes
  const cutoff = Date.now() - 1800000;
  return alerts.filter(a => a.timestamp > cutoff).length;
}
