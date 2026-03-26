// ============================================
// EVENT DETECTION — Simple anomaly detection engine
// Compares current data snapshots to detect unusual patterns
// ============================================

import { getHotspots } from './hotspots.js';

let alerts = [];
let snapshots = []; // rolling window of entity counts per region
const MAX_SNAPSHOTS = 10;
const ALERT_MAX = 20;

// ============================================
// TAKE SNAPSHOT — called each data refresh cycle
// ============================================
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

function computeBaseline() {
  const baseline = {};
  const count = Math.max(snapshots.length - 1, 1); // exclude current

  for (const snap of snapshots.slice(0, -1)) {
    for (const [region, data] of Object.entries(snap.regions)) {
      if (!baseline[region]) baseline[region] = { flights: 0, military: 0, vessels: 0 };
      baseline[region].flights += data.flights / count;
      baseline[region].military += data.military / count;
      baseline[region].vessels += data.vessels / count;
    }
  }
  return baseline;
}

// ============================================
// ALERT MANAGEMENT
// ============================================
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

export function getAlerts() {
  return alerts;
}

export function dismissAlert(id) {
  alerts = alerts.filter(a => a.id !== id);
}

export function getAlertCount() {
  // Only count alerts from last 30 minutes
  const cutoff = Date.now() - 1800000;
  return alerts.filter(a => a.timestamp > cutoff).length;
}
