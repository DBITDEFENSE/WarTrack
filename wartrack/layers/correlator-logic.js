/**
 * @module correlator-logic
 * Pure scoring and classification functions extracted from the correlator engine.
 * These functions have no side effects and no browser/Cesium dependencies,
 * making them easy to unit test.
 */

/**
 * @constant {number} Approximate radius in degrees (~550km) for capturing entities near a region.
 */
export const REGION_RADIUS_DEG = 5;

/**
 * @constant {Object<string, number>} Severity weights for composite threat scoring.
 * Each key maps a signal category to its weight in the final score (0-1).
 */
export const WEIGHTS = {
  milAircraft:    0.25,
  jammingScore:   0.30,
  newsActivity:   0.15,
  vesselAnomaly:  0.15,
  satCoverage:    0.05,
  civilianFlight: 0.10,
};

/**
 * Checks whether an entity falls within the rectangular region around a hotspot.
 * Uses a simple bounding-box check in degrees (not great-circle distance).
 * @param {number} entityLat
 * @param {number} entityLon
 * @param {number} regionLat
 * @param {number} regionLon
 * @returns {boolean}
 */
export function inRegion(entityLat, entityLon, regionLat, regionLon) {
  const dlat = Math.abs(entityLat - regionLat);
  const dlon = Math.abs(entityLon - regionLon);
  return dlat < REGION_RADIUS_DEG && dlon < REGION_RADIUS_DEG;
}

/**
 * Creates a blank RegionAssessment for a given hotspot.
 * @param {Object} hotspot - Hotspot definition with name, lat, lon, severity
 * @returns {Object} Initialized assessment with zeroed counters
 */
export function createAssessment(hotspot) {
  return {
    name: hotspot.name,
    lat: hotspot.lat,
    lon: hotspot.lon,
    baseSeverity: hotspot.severity,
    milAircraftCount: 0,
    civAircraftCount: 0,
    totalAircraftCount: 0,
    vesselCount: 0,
    jammingCells: 0,
    jammingAvgScore: 0,
    satCount: 0,
    newsCount: 0,
    recentNews: [],
    threatLevel: 'GREEN',
    compositeScore: 0,
    signals: [],
    timestamp: 0,
  };
}

/**
 * Computes the composite threat score and threat level for a populated assessment.
 * Mutates the assessment in place, setting compositeScore, threatLevel, and signals.
 *
 * @param {Object} assessment - A RegionAssessment with entity counts already filled in
 * @param {string} hotspotSeverity - Base severity of the hotspot ('high' | 'elevated' | 'watch')
 * @returns {Object} The same assessment object, with compositeScore/threatLevel/signals updated
 */
export function computeThreatScore(assessment, hotspotSeverity) {
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

  // Vessel density
  if (assessment.vesselCount >= 20) {
    score += WEIGHTS.vesselAnomaly * 0.3;
  } else if (assessment.vesselCount <= 2 && hotspotSeverity !== 'watch') {
    score += WEIGHTS.vesselAnomaly * 0.8;
    signals.push(`Low vessel traffic (${assessment.vesselCount}) — possible route avoidance`);
  }

  // Civilian traffic inverse
  if (assessment.civAircraftCount <= 5 && assessment.milAircraftCount >= 3) {
    score += WEIGHTS.civilianFlight * 0.7;
    signals.push('Low civilian air traffic in military-active zone');
  }

  // Satellite overflight
  if (assessment.satCount >= 2) {
    score += WEIGHTS.satCoverage * 0.5;
    signals.push(`${assessment.satCount} satellites overhead`);
  }

  // Base severity boost
  if (hotspotSeverity === 'high') score = Math.min(1, score + 0.15);
  else if (hotspotSeverity === 'elevated') score = Math.min(1, score + 0.05);

  // Classify threat level
  assessment.compositeScore = Math.min(1, score);
  if (score >= 0.7)       assessment.threatLevel = 'RED';
  else if (score >= 0.45) assessment.threatLevel = 'ORANGE';
  else if (score >= 0.25) assessment.threatLevel = 'YELLOW';
  else                    assessment.threatLevel = 'GREEN';

  assessment.signals = signals;
  return assessment;
}
