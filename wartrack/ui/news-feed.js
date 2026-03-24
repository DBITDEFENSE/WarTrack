// ============================================
// NEWS FEED PANEL — Right-side scrollable global feed
// ============================================

import { fetchAllNews, fetchNewsForHotspot, getCacheAge, clearCache, timeAgo, severityColor } from '../layers/news.js';
import { getHotspots } from '../layers/hotspots.js';
import { NEWS_REFRESH_COOLDOWN } from '../config.js';

let panelEl, bodyEl, filterEl, refreshBtn;
let viewer = null;
let lastRefreshTime = 0;
let currentFilter = 'ALL';
let allArticles = [];
let isLoading = false;

// ============================================
// INIT
// ============================================
export function initNewsFeed(v) {
  viewer = v;
  panelEl = document.getElementById('news-feed-panel');
  bodyEl = document.getElementById('news-feed-body');
  filterEl = document.getElementById('news-feed-filter');
  refreshBtn = document.getElementById('news-feed-refresh');

  const closeBtn = document.getElementById('news-feed-close');
  const openBtn = document.getElementById('btn-news-feed');

  openBtn.addEventListener('click', () => {
    panelEl.classList.toggle('hidden');
    if (!panelEl.classList.contains('hidden') && allArticles.length === 0) {
      loadGlobalFeed();
    }
  });

  closeBtn.addEventListener('click', () => {
    panelEl.classList.add('hidden');
  });

  filterEl.addEventListener('change', () => {
    currentFilter = filterEl.value;
    renderArticles();
  });

  refreshBtn.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastRefreshTime < NEWS_REFRESH_COOLDOWN) {
      const remaining = Math.ceil((NEWS_REFRESH_COOLDOWN - (now - lastRefreshTime)) / 60000);
      refreshBtn.textContent = `WAIT ${remaining}m`;
      setTimeout(() => { refreshBtn.textContent = '↻ REFRESH'; }, 2000);
      return;
    }
    clearCache();
    loadGlobalFeed();
  });

  // Populate filter dropdown with hotspot names
  const hotspots = getHotspots();
  for (const hs of hotspots) {
    const opt = document.createElement('option');
    opt.value = hs.name;
    opt.textContent = hs.name.toUpperCase();
    filterEl.appendChild(opt);
  }
}

// ============================================
// LOAD GLOBAL FEED
// ============================================
async function loadGlobalFeed() {
  if (isLoading) return;
  isLoading = true;
  lastRefreshTime = Date.now();
  refreshBtn.textContent = '↻ LOADING...';
  bodyEl.innerHTML = '<div class="news-loading">Fetching headlines...</div>';

  const hotspots = getHotspots();
  allArticles = await fetchAllNews(hotspots);

  isLoading = false;
  refreshBtn.textContent = '↻ REFRESH';
  renderArticles();
}

// ============================================
// RENDER ARTICLES
// ============================================
function renderArticles() {
  const filtered = currentFilter === 'ALL'
    ? allArticles
    : allArticles.filter(a => a.hotspot === currentFilter);

  if (filtered.length === 0) {
    bodyEl.innerHTML = `<div class="news-empty">No headlines available${currentFilter !== 'ALL' ? ' for ' + currentFilter : ''}.<br>Configure GNEWS_API_KEY in proxy for live data.</div>`;
    return;
  }

  bodyEl.innerHTML = filtered.map(article => {
    const color = severityColor(article.severity);
    const cacheAge = getCacheAge(article.hotspot);
    const cacheLabel = cacheAge ? `CACHED · ${Math.floor(cacheAge / 60000)}min ago` : '';
    const stateWarning = article.isStateAdjacent
      ? '<span class="news-state-warning" title="State-adjacent media">⚠</span>'
      : '';

    return `
      <div class="news-card" data-lat="${article.lat}" data-lon="${article.lon}">
        <div class="news-card-region" style="color: ${color}">
          <span class="news-severity-dot" style="background: ${color}"></span>
          ${(article.hotspot || '').toUpperCase()}
        </div>
        <a class="news-card-title" href="${article.url || '#'}" target="_blank" rel="noopener">
          ${escapeHtml(truncate(article.title || 'Untitled', 90))}
        </a>
        <div class="news-card-meta">
          <span class="news-source">${stateWarning}${escapeHtml(article.source?.name || 'Unknown')}</span>
          <span class="news-time">${timeAgo(article.publishedAt)}</span>
        </div>
        ${cacheLabel ? `<div class="news-cache-label">${cacheLabel}</div>` : ''}
      </div>
    `;
  }).join('');

  // Attach flyTo click handlers
  bodyEl.querySelectorAll('.news-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't hijack link clicks
      if (e.target.closest('a')) return;
      const lat = parseFloat(card.dataset.lat);
      const lon = parseFloat(card.dataset.lon);
      if (!isNaN(lat) && !isNaN(lon) && viewer) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000000),
          duration: 1.5
        });
      }
    });
  });
}

// ============================================
// OPEN FEED FILTERED TO A SPECIFIC HOTSPOT
// ============================================
export async function openFeedForHotspot(hotspot) {
  panelEl.classList.remove('hidden');

  // Set filter
  filterEl.value = hotspot.name;
  currentFilter = hotspot.name;

  // Fetch if needed
  bodyEl.innerHTML = '<div class="news-loading">Fetching headlines...</div>';
  const articles = await fetchNewsForHotspot(hotspot);

  // Merge into allArticles if not present
  for (const a of articles) {
    if (!allArticles.find(x => x.title === a.title)) {
      allArticles.push(a);
    }
  }
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  renderArticles();
}

// ============================================
// HELPERS
// ============================================
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
