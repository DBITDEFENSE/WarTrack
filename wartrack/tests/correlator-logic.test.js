import { describe, it, expect } from 'vitest';
import {
  inRegion,
  createAssessment,
  computeThreatScore,
  WEIGHTS,
  REGION_RADIUS_DEG,
} from '../layers/correlator-logic.js';

// ---------------------------------------------------------------------------
// inRegion
// ---------------------------------------------------------------------------
describe('inRegion', () => {
  const centerLat = 48.5;
  const centerLon = 31.2;

  it('returns true for entity at the center', () => {
    expect(inRegion(centerLat, centerLon, centerLat, centerLon)).toBe(true);
  });

  it('returns true for entity just inside the radius', () => {
    expect(inRegion(centerLat + 4.9, centerLon + 4.9, centerLat, centerLon)).toBe(true);
  });

  it('returns false for entity outside the radius', () => {
    expect(inRegion(centerLat + 6, centerLon, centerLat, centerLon)).toBe(false);
  });

  it('returns false when both lat and lon exceed radius', () => {
    expect(inRegion(centerLat + 10, centerLon + 10, centerLat, centerLon)).toBe(false);
  });

  it('handles negative coordinate offsets', () => {
    expect(inRegion(centerLat - 4, centerLon - 4, centerLat, centerLon)).toBe(true);
  });

  it('uses REGION_RADIUS_DEG of 5', () => {
    expect(REGION_RADIUS_DEG).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// createAssessment
// ---------------------------------------------------------------------------
describe('createAssessment', () => {
  const hotspot = { name: 'Test Zone', lat: 10, lon: 20, severity: 'high' };

  it('returns an object with all zeroed counters', () => {
    const a = createAssessment(hotspot);
    expect(a.milAircraftCount).toBe(0);
    expect(a.civAircraftCount).toBe(0);
    expect(a.vesselCount).toBe(0);
    expect(a.jammingCells).toBe(0);
    expect(a.satCount).toBe(0);
    expect(a.newsCount).toBe(0);
  });

  it('defaults threat level to GREEN', () => {
    expect(createAssessment(hotspot).threatLevel).toBe('GREEN');
  });

  it('stores hotspot metadata', () => {
    const a = createAssessment(hotspot);
    expect(a.name).toBe('Test Zone');
    expect(a.lat).toBe(10);
    expect(a.lon).toBe(20);
    expect(a.baseSeverity).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// computeThreatScore — threat level classification
// ---------------------------------------------------------------------------
describe('computeThreatScore — threat levels', () => {
  function makeAssessment(overrides = {}) {
    const base = createAssessment({ name: 'X', lat: 0, lon: 0, severity: 'watch' });
    return { ...base, ...overrides };
  }

  it('returns GREEN when all counters are zero', () => {
    const a = computeThreatScore(makeAssessment(), 'watch');
    expect(a.threatLevel).toBe('GREEN');
    expect(a.compositeScore).toBe(0);
  });

  it('returns YELLOW with moderate signals', () => {
    // 5 mil aircraft (0.25 * 0.6 = 0.15) + elevated severity boost (+0.05) + low vessels (+0.12) = 0.32
    const a = computeThreatScore(makeAssessment({
      milAircraftCount: 5,
      vesselCount: 1,
    }), 'elevated');
    expect(a.threatLevel).toBe('YELLOW');
    expect(a.compositeScore).toBeGreaterThanOrEqual(0.25);
    expect(a.compositeScore).toBeLessThan(0.45);
  });

  it('returns ORANGE with strong signals', () => {
    // 5 mil (0.25*0.6=0.15) + mod jamming (0.30*0.5=0.15) + elevated boost (+0.05) + low vessels (0.15*0.8=0.12) = 0.47
    const a = computeThreatScore(makeAssessment({
      milAircraftCount: 5,
      jammingAvgScore: 0.35,
      jammingCells: 3,
      vesselCount: 1,
    }), 'elevated');
    expect(a.threatLevel).toBe('ORANGE');
    expect(a.compositeScore).toBeGreaterThanOrEqual(0.45);
  });

  it('returns RED with maximum signals', () => {
    const a = computeThreatScore(makeAssessment({
      milAircraftCount: 15,
      jammingAvgScore: 0.8,
      jammingCells: 10,
      newsCount: 8,
      vesselCount: 0,
      civAircraftCount: 2,
      satCount: 3,
    }), 'high');
    expect(a.threatLevel).toBe('RED');
    expect(a.compositeScore).toBeGreaterThanOrEqual(0.7);
  });
});

// ---------------------------------------------------------------------------
// computeThreatScore — individual signals
// ---------------------------------------------------------------------------
describe('computeThreatScore — signal details', () => {
  function makeAssessment(overrides = {}) {
    return { ...createAssessment({ name: 'X', lat: 0, lon: 0, severity: 'watch' }), ...overrides };
  }

  it('adds military aircraft signal at ≥10', () => {
    const a = computeThreatScore(makeAssessment({ milAircraftCount: 12 }), 'watch');
    expect(a.signals.some(s => s.includes('MIL aircraft in zone'))).toBe(true);
  });

  it('adds jamming signal at high score', () => {
    const a = computeThreatScore(makeAssessment({ jammingAvgScore: 0.7, jammingCells: 5 }), 'watch');
    expect(a.signals.some(s => s.includes('GPS interference: HIGH'))).toBe(true);
  });

  it('adds low civilian traffic signal when mil ≥3 and civ ≤5', () => {
    const a = computeThreatScore(makeAssessment({
      milAircraftCount: 4,
      civAircraftCount: 3,
    }), 'watch');
    expect(a.signals.some(s => s.includes('Low civilian air traffic'))).toBe(true);
  });

  it('adds vessel route avoidance signal for non-watch zones', () => {
    const a = computeThreatScore(makeAssessment({ vesselCount: 1 }), 'high');
    expect(a.signals.some(s => s.includes('route avoidance'))).toBe(true);
  });

  it('does NOT add vessel avoidance signal for watch zones', () => {
    const a = computeThreatScore(makeAssessment({ vesselCount: 1 }), 'watch');
    expect(a.signals.some(s => s.includes('route avoidance'))).toBe(false);
  });

  it('caps composite score at 1.0', () => {
    const a = computeThreatScore(makeAssessment({
      milAircraftCount: 20,
      jammingAvgScore: 1.0,
      jammingCells: 50,
      newsCount: 20,
      vesselCount: 0,
      civAircraftCount: 0,
      satCount: 10,
    }), 'high');
    expect(a.compositeScore).toBeLessThanOrEqual(1.0);
  });

  it('applies severity boost for high zones', () => {
    const base = makeAssessment();
    const watchResult = computeThreatScore({ ...base }, 'watch');
    const highResult = computeThreatScore({ ...base }, 'high');
    expect(highResult.compositeScore).toBeGreaterThan(watchResult.compositeScore);
  });
});
