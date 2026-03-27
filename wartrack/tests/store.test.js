import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getState, setState, subscribe, resetState } from '../store.js';
import { on, emit, off, clearAll } from '../event-bus.js';

// ---------------------------------------------------------------------------
// Store — getState / setState
// ---------------------------------------------------------------------------
describe('store — getState / setState', () => {
  beforeEach(() => resetState());

  it('returns full state when no path given', () => {
    const s = getState();
    expect(s).toHaveProperty('layers');
    expect(s).toHaveProperty('counts');
    expect(s).toHaveProperty('thermalActive');
  });

  it('reads a top-level value by path', () => {
    expect(getState('thermalActive')).toBe(false);
  });

  it('reads a nested value by dot-path', () => {
    expect(getState('counts.flights')).toBe(0);
    expect(getState('layers.hotspots')).toBe(true);
  });

  it('returns undefined for nonexistent paths', () => {
    expect(getState('nonexistent.path')).toBeUndefined();
  });

  it('sets a top-level value', () => {
    setState('thermalActive', true);
    expect(getState('thermalActive')).toBe(true);
  });

  it('sets a nested value', () => {
    setState('counts.flights', 42);
    expect(getState('counts.flights')).toBe(42);
  });

  it('does not trigger subscribers on same-value set', () => {
    const fn = vi.fn();
    subscribe('thermalActive', fn);
    setState('thermalActive', false); // already false
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Store — subscribe
// ---------------------------------------------------------------------------
describe('store — subscribe', () => {
  beforeEach(() => resetState());

  it('fires subscriber when exact path changes', () => {
    const fn = vi.fn();
    subscribe('counts.flights', fn);
    setState('counts.flights', 10);
    expect(fn).toHaveBeenCalledWith(10, 'counts.flights', 10);
  });

  it('fires parent subscriber when child changes', () => {
    const fn = vi.fn();
    subscribe('counts', fn);
    setState('counts.military', 5);
    expect(fn).toHaveBeenCalledTimes(1);
    // Should receive the full counts object
    const payload = fn.mock.calls[0][0];
    expect(payload.military).toBe(5);
  });

  it('does NOT fire unrelated subscriber', () => {
    const fn = vi.fn();
    subscribe('layers', fn);
    setState('counts.flights', 99);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    const fn = vi.fn();
    const unsub = subscribe('thermalActive', fn);
    setState('thermalActive', true);
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    setState('thermalActive', false);
    expect(fn).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple subscribers on same path all fire', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    subscribe('counts.flights', fn1);
    subscribe('counts.flights', fn2);
    setState('counts.flights', 7);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Event Bus — on / emit / off
// ---------------------------------------------------------------------------
describe('event-bus', () => {
  beforeEach(() => clearAll());

  it('emit delivers data to subscriber', () => {
    const fn = vi.fn();
    on('test:event', fn);
    emit('test:event', { foo: 'bar' });
    expect(fn).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('multiple listeners on same event all fire', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    on('test:multi', fn1);
    on('test:multi', fn2);
    emit('test:multi', 42);
    expect(fn1).toHaveBeenCalledWith(42);
    expect(fn2).toHaveBeenCalledWith(42);
  });

  it('on() returns unsubscribe function', () => {
    const fn = vi.fn();
    const unsub = on('test:unsub', fn);
    emit('test:unsub', 1);
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    emit('test:unsub', 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('off() removes a specific listener', () => {
    const fn = vi.fn();
    on('test:off', fn);
    off('test:off', fn);
    emit('test:off', 'data');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emit on unknown event is a no-op', () => {
    expect(() => emit('nonexistent', 'data')).not.toThrow();
  });

  it('listener errors do not block other listeners', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    on('test:error', bad);
    on('test:error', good);
    emit('test:error', 'data');
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });
});
