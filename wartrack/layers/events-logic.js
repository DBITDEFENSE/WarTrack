/**
 * @module events-logic
 * Pure anomaly detection functions extracted from the events engine.
 * These functions have no side effects and no browser/DOM dependencies,
 * making them easy to unit test.
 */

/**
 * @constant {RegExp} Pattern matching conflict-related keywords in OSINT article titles.
 */
export const CONFLICT_KEYWORDS = /\b(strike|explosion|attack|missile|bombing|military operation|escalation|invasion|airstrike|shelling|ceasefire broken)\b/i;

/**
 * Tests whether a title matches any conflict keyword.
 * @param {string} title - Article or content title to check
 * @returns {boolean}
 */
export function matchesConflictKeywords(title) {
  return CONFLICT_KEYWORDS.test(title || '');
}

/**
 * Checks whether a new alert should be suppressed because a similar one
 * (same type + region) already exists within the dedup window.
 * @param {Array<{type: string, region: string, timestamp: number}>} existingAlerts
 * @param {{type: string, region: string}} newAlert
 * @param {number} [windowMs=300000] - Dedup window in milliseconds (default 5 min)
 * @returns {boolean} True if the alert should be suppressed (is a duplicate)
 */
export function shouldDedup(existingAlerts, newAlert, windowMs = 300000) {
  const now = Date.now();
  return existingAlerts.some(a =>
    a.type === newAlert.type &&
    a.region === newAlert.region &&
    now - a.timestamp < windowMs
  );
}

/**
 * Computes a rolling baseline by averaging all snapshots except the most recent.
 * @param {Array<{regions: Object<string, {flights: number, military: number, vessels: number}>}>} snapshots
 * @returns {Object<string, {flights: number, military: number, vessels: number}>} Average counts per region
 */
export function computeBaseline(snapshots) {
  const baseline = {};
  if (snapshots.length <= 1) return baseline;

  const past = snapshots.slice(0, -1);
  const count = past.length;

  for (const snap of past) {
    for (const [region, data] of Object.entries(snap.regions)) {
      if (!baseline[region]) baseline[region] = { flights: 0, military: 0, vessels: 0 };
      baseline[region].flights += data.flights / count;
      baseline[region].military += data.military / count;
      baseline[region].vessels += data.vessels / count;
    }
  }
  return baseline;
}

/**
 * Runs anomaly detection rules for a single region and returns any triggered alerts.
 * Pure function — no side effects, no DOM events.
 *
 * @param {{flights: number, military: number, vessels: number}} regionData - Current snapshot counts
 * @param {{flights: number, military: number, vessels: number}} baseline - Baseline average counts
 * @param {{name: string, lat: number, lon: number, severity: string}} hotspot - Hotspot definition
 * @param {Object|null} [intel=null] - Optional correlator intel with compositeScore, milAircraftCount, jammingCells, vesselCount
 * @returns {Array<{type: string, severity: string, region: string, description: string, lat: number, lon: number}>}
 */
export function detectAnomaliesForRegion(regionData, baseline, hotspot, intel = null) {
  const alerts = [];

  // Rule 1: Military aircraft spike (>150% of baseline, min 3)
  if (regionData.military >= 3 && baseline.military > 0 && regionData.military > baseline.military * 1.5) {
    alerts.push({
      type: 'MIL_SPIKE',
      severity: 'high',
      region: hotspot.name,
      description: `Military aircraft spike: ${regionData.military} detected (baseline: ${Math.round(baseline.military)})`,
      lat: hotspot.lat,
      lon: hotspot.lon,
    });
  }

  // Rule 2: Total flight surge (>200% baseline, min 20)
  if (regionData.flights >= 20 && baseline.flights > 0 && regionData.flights > baseline.flights * 2) {
    alerts.push({
      type: 'TRAFFIC_SURGE',
      severity: 'elevated',
      region: hotspot.name,
      description: `Air traffic surge: ${regionData.flights} aircraft (baseline: ${Math.round(baseline.flights)})`,
      lat: hotspot.lat,
      lon: hotspot.lon,
    });
  }

  // Rule 3: Vessel drop (< 50% of baseline, min 3 in baseline)
  if (baseline.vessels >= 3 && regionData.vessels < baseline.vessels * 0.5) {
    alerts.push({
      type: 'VESSEL_DROP',
      severity: 'elevated',
      region: hotspot.name,
      description: `Vessel activity drop: ${regionData.vessels} ships (baseline: ${Math.round(baseline.vessels)})`,
      lat: hotspot.lat,
      lon: hotspot.lon,
    });
  }

  // Rule 4: CORRELATED ESCALATION — mil spike + GPS jamming in same region
  if (intel && intel.compositeScore >= 0.6 && intel.milAircraftCount >= 5 && intel.jammingCells > 0) {
    alerts.push({
      type: 'CORRELATED_ESCALATION',
      severity: 'critical',
      region: hotspot.name,
      description: `Multi-signal escalation: ${intel.milAircraftCount} MIL aircraft + ${intel.jammingCells} jamming cells + threat score ${intel.compositeScore.toFixed(2)}`,
      lat: hotspot.lat,
      lon: hotspot.lon,
    });
  }

  // Rule 5: ROUTE AVOIDANCE — low vessel + high mil in trade route zone
  if (intel && intel.vesselCount <= 3 && intel.milAircraftCount >= 3 && hotspot.severity !== 'watch') {
    alerts.push({
      type: 'ROUTE_AVOIDANCE',
      severity: 'elevated',
      region: hotspot.name,
      description: `Possible route avoidance: only ${intel.vesselCount} vessels near ${intel.milAircraftCount} military aircraft`,
      lat: hotspot.lat,
      lon: hotspot.lon,
    });
  }

  return alerts;
}
