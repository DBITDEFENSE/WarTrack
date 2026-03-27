import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dedupFetch, clearDedupCache } from '../utils/dedup-fetch.js';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
let fetchCallCount = 0;

function makeMockResponse(body = 'ok', status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

beforeEach(() => {
  clearDedupCache();
  fetchCallCount = 0;

  globalThis.fetch = vi.fn(async (url, _opts) => {
    fetchCallCount++;
    // Small delay to simulate network
    await new Promise(r => setTimeout(r, 10));
    return makeMockResponse(`response-for-${url}`);
  });
});

// ---------------------------------------------------------------------------
// Basic functionality
// ---------------------------------------------------------------------------
describe('dedupFetch — basic', () => {
  it('returns a valid response for a single call', async () => {
    const resp = await dedupFetch('https://example.com/api');
    expect(resp.ok).toBe(true);
    const text = await resp.text();
    expect(text).toBe('response-for-https://example.com/api');
  });

  it('calls fetch exactly once for a single request', async () => {
    await dedupFetch('https://example.com/one');
    expect(fetchCallCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// In-flight deduplication
// ---------------------------------------------------------------------------
describe('dedupFetch — in-flight dedup', () => {
  it('makes only 1 real fetch for 2 concurrent calls to the same URL', async () => {
    const p1 = dedupFetch('https://example.com/dup');
    const p2 = dedupFetch('https://example.com/dup');
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fetchCallCount).toBe(1);
    // Both should return readable responses
    const t1 = await r1.text();
    const t2 = await r2.text();
    expect(t1).toBe('response-for-https://example.com/dup');
    expect(t2).toBe('response-for-https://example.com/dup');
  });

  it('fetches independently for different URLs', async () => {
    const p1 = dedupFetch('https://example.com/a');
    const p2 = dedupFetch('https://example.com/b');
    await Promise.all([p1, p2]);
    expect(fetchCallCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TTL cache
// ---------------------------------------------------------------------------
describe('dedupFetch — TTL cache', () => {
  it('returns cached response within TTL', async () => {
    await dedupFetch('https://example.com/cached', {}, 5000);
    expect(fetchCallCount).toBe(1);

    // Second call should hit cache
    const resp = await dedupFetch('https://example.com/cached', {}, 5000);
    expect(fetchCallCount).toBe(1);
    const text = await resp.text();
    expect(text).toBe('response-for-https://example.com/cached');
  });

  it('refetches after TTL expires', async () => {
    await dedupFetch('https://example.com/expire', {}, 1); // 1ms TTL
    expect(fetchCallCount).toBe(1);

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 10));

    await dedupFetch('https://example.com/expire', {}, 1);
    expect(fetchCallCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// POST passthrough
// ---------------------------------------------------------------------------
describe('dedupFetch — POST passthrough', () => {
  it('does NOT deduplicate POST requests', async () => {
    const p1 = dedupFetch('https://example.com/post', { method: 'POST' });
    const p2 = dedupFetch('https://example.com/post', { method: 'POST' });
    await Promise.all([p1, p2]);
    expect(fetchCallCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// clearDedupCache
// ---------------------------------------------------------------------------
describe('clearDedupCache', () => {
  it('forces a refetch after clearing', async () => {
    await dedupFetch('https://example.com/clear', {}, 60000);
    expect(fetchCallCount).toBe(1);

    clearDedupCache();

    await dedupFetch('https://example.com/clear', {}, 60000);
    expect(fetchCallCount).toBe(2);
  });
});
