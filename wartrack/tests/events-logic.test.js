import { describe, it, expect, vi } from 'vitest';
import {
  matchesConflictKeywords,
  shouldDedup,
  computeBaseline,
  detectAnomaliesForRegion,
} from '../layers/events-logic.js';

// ---------------------------------------------------------------------------
// matchesConflictKeywords
// ---------------------------------------------------------------------------
describe('matchesConflictKeywords', () => {
  it('matches "airstrike"', () => {
    expect(matchesConflictKeywords('Breaking: airstrike on target')).toBe(true);
  });

  it('matches "missile"', () => {
    expect(matchesConflictKeywords('Missile launch detected')).toBe(true);
  });

  it('matches "ceasefire broken"', () => {
    expect(matchesConflictKeywords('Reports of ceasefire broken in region')).toBe(true);
  });

  it('does NOT match neutral text', () => {
    expect(matchesConflictKeywords('Weather forecast for tomorrow')).toBe(false);
  });

  it('does NOT match empty string', () => {
    expect(matchesConflictKeywords('')).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(matchesConflictKeywords(null)).toBe(false);
    expect(matchesConflictKeywords(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldDedup
// ---------------------------------------------------------------------------
describe('shouldDedup', () => {
  it('suppresses duplicate within 5 minutes', () => {
    const existing = [{ type: 'MIL_SPIKE', region: 'Ukraine', timestamp: Date.now() - 60000 }];
    expect(shouldDedup(existing, { type: 'MIL_SPIKE', region: 'Ukraine' })).toBe(true);
  });

  it('allows alert after 5 minutes', () => {
    const existing = [{ type: 'MIL_SPIKE', region: 'Ukraine', timestamp: Date.now() - 400000 }];
    expect(shouldDedup(existing, { type: 'MIL_SPIKE', region: 'Ukraine' })).toBe(false);
  });

  it('allows different alert types for same region', () => {
    const existing = [{ type: 'MIL_SPIKE', region: 'Ukraine', timestamp: Date.now() }];
    expect(shouldDedup(existing, { type: 'VESSEL_DROP', region: 'Ukraine' })).toBe(false);
  });

  it('allows same alert type for different regions', () => {
    const existing = [{ type: 'MIL_SPIKE', region: 'Ukraine', timestamp: Date.now() }];
    expect(shouldDedup(existing, { type: 'MIL_SPIKE', region: 'Gaza' })).toBe(false);
  });

  it('returns false for empty alerts list', () => {
    expect(shouldDedup([], { type: 'MIL_SPIKE', region: 'Ukraine' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeBaseline
// ---------------------------------------------------------------------------
describe('computeBaseline', () => {
  it('returns empty object for single snapshot', () => {
    const snapshots = [{ regions: { Ukraine: { flights: 10, military: 3, vessels: 5 } } }];
    expect(computeBaseline(snapshots)).toEqual({});
  });

  it('averages all snapshots except the last', () => {
    const snapshots = [
      { regions: { Ukraine: { flights: 10, military: 2, vessels: 6 } } },
      { regions: { Ukraine: { flights: 20, military: 4, vessels: 8 } } },
      { regions: { Ukraine: { flights: 30, military: 6, vessels: 10 } } }, // current — excluded
    ];
    const baseline = computeBaseline(snapshots);
    // Average of first 2: flights=(10+20)/2=15, military=(2+4)/2=3, vessels=(6+8)/2=7
    expect(baseline.Ukraine.flights).toBe(15);
    expect(baseline.Ukraine.military).toBe(3);
    expect(baseline.Ukraine.vessels).toBe(7);
  });

  it('handles multiple regions', () => {
    const snapshots = [
      { regions: { A: { flights: 10, military: 1, vessels: 2 }, B: { flights: 20, military: 3, vessels: 4 } } },
      { regions: { A: { flights: 30, military: 5, vessels: 6 }, B: { flights: 40, military: 7, vessels: 8 } } },
      { regions: { A: { flights: 0, military: 0, vessels: 0 } } }, // current
    ];
    const baseline = computeBaseline(snapshots);
    expect(baseline.A.flights).toBe(20);
    expect(baseline.B.flights).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// detectAnomaliesForRegion
// ---------------------------------------------------------------------------
describe('detectAnomaliesForRegion', () => {
  const hotspot = { name: 'Ukraine Front', lat: 48.5, lon: 31.2, severity: 'high' };

  it('triggers MIL_SPIKE at 150% of baseline with min 3', () => {
    const region = { flights: 10, military: 5, vessels: 5 };
    const baseline = { flights: 10, military: 3, vessels: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'MIL_SPIKE')).toBe(true);
  });

  it('does NOT trigger MIL_SPIKE below threshold', () => {
    const region = { flights: 10, military: 2, vessels: 5 };
    const baseline = { flights: 10, military: 2, vessels: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'MIL_SPIKE')).toBe(false);
  });

  it('triggers TRAFFIC_SURGE at 200% of baseline with min 20', () => {
    const region = { flights: 40, military: 0, vessels: 5 };
    const baseline = { flights: 15, military: 0, vessels: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'TRAFFIC_SURGE')).toBe(true);
  });

  it('does NOT trigger TRAFFIC_SURGE below 20 flights', () => {
    const region = { flights: 18, military: 0, vessels: 5 };
    const baseline = { flights: 5, military: 0, vessels: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'TRAFFIC_SURGE')).toBe(false);
  });

  it('triggers VESSEL_DROP at <50% of baseline with min baseline 3', () => {
    const region = { flights: 10, military: 0, vessels: 1 };
    const baseline = { flights: 10, military: 0, vessels: 6 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'VESSEL_DROP')).toBe(true);
  });

  it('does NOT trigger VESSEL_DROP when baseline too low', () => {
    const region = { flights: 10, military: 0, vessels: 0 };
    const baseline = { flights: 10, military: 0, vessels: 2 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts.some(a => a.type === 'VESSEL_DROP')).toBe(false);
  });

  it('triggers CORRELATED_ESCALATION with intel data', () => {
    const region = { flights: 10, military: 5, vessels: 5 };
    const baseline = { flights: 10, military: 3, vessels: 5 };
    const intel = { compositeScore: 0.7, milAircraftCount: 6, jammingCells: 2, vesselCount: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot, intel);
    expect(alerts.some(a => a.type === 'CORRELATED_ESCALATION')).toBe(true);
  });

  it('triggers ROUTE_AVOIDANCE with low vessel + high mil intel', () => {
    const region = { flights: 10, military: 0, vessels: 5 };
    const baseline = { flights: 10, military: 0, vessels: 5 };
    const intel = { compositeScore: 0.3, milAircraftCount: 4, jammingCells: 0, vesselCount: 2 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot, intel);
    expect(alerts.some(a => a.type === 'ROUTE_AVOIDANCE')).toBe(true);
  });

  it('returns no alerts when everything is normal', () => {
    const region = { flights: 10, military: 1, vessels: 5 };
    const baseline = { flights: 10, military: 1, vessels: 5 };
    const alerts = detectAnomaliesForRegion(region, baseline, hotspot);
    expect(alerts).toHaveLength(0);
  });
});
