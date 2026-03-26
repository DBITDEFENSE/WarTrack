// ============================================
// WARTRACK — Configuration
// ============================================

// API Base URL — Railway server in production, empty for local dev
// When running locally, API calls go to same origin (proxy server on :5173)
// When deployed on Vercel, API calls go directly to Railway
export const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://wartrack-production.up.railway.app';

// Helper: prepend API_BASE to any /api/ path
export function apiUrl(path) {
  return API_BASE + path;
}

// Supabase — public values (safe for frontend)
export const SUPABASE_URL = 'https://rejsenubjifjuxuolvug.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanNlbnViamlmanV4dW9sdnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTg4MzEsImV4cCI6MjA4OTg5NDgzMX0.H3c7n9XLfdsgKgz-KiZy09n9f2F8ChD1vocl0cqejBA';

// News API key — set your GNews or NewsAPI key here
// GNews free tier: 100 req/day — https://gnews.io
// Or set via proxy env var GNEWS_API_KEY
export const GNEWS_KEY = '';

// Cache TTL for news results (30 minutes — balances freshness vs API limits)
export const NEWS_CACHE_TTL = 30 * 60 * 1000;

// Minimum interval between manual refreshes (2 minutes)
export const NEWS_REFRESH_COOLDOWN = 2 * 60 * 1000;

// Delay between sequential hotspot fetches (ms) to avoid burst limits
export const NEWS_FETCH_DELAY = 500;

// Max articles per hotspot query
export const NEWS_MAX_ARTICLES = 8;
