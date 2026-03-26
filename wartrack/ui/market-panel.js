// ============================================
// MARKET INTELLIGENCE PANEL — Defense/geopolitical stock tracking
// ============================================

import { STOCKS, CATEGORIES, STOCK_MAP } from '../data/market-universe.js';
import { renderSaveButton, bindSaveButtons } from './favorites.js';
import { apiUrl } from '../config.js';

let panelEl, bodyEl, headerControlsEl;
let allQuotes = [];
let aiAnalysis = null;
let currentFilter = 'all';
let refreshCooldown = false;

// ============================================
// INIT
// ============================================
export function initMarketPanel() {
  panelEl = document.getElementById('market-panel');
  bodyEl = document.getElementById('market-body');

  const openBtn = document.getElementById('btn-markets');
  const closeBtn = document.getElementById('market-close');
  const refreshBtn = document.getElementById('market-refresh');
  const filterEl = document.getElementById('market-filter');

  openBtn?.addEventListener('click', () => {
    panelEl.classList.toggle('hidden');
    if (!panelEl.classList.contains('hidden') && allQuotes.length === 0) {
      loadMarketData();
    }
  });

  closeBtn?.addEventListener('click', () => panelEl.classList.add('hidden'));

  refreshBtn?.addEventListener('click', () => {
    if (refreshCooldown) return;
    loadMarketData(true);
  });

  // Stock search
  const searchInput = document.getElementById('market-search');
  const searchBtn = document.getElementById('market-search-btn');
  searchBtn?.addEventListener('click', () => searchStock(searchInput?.value));
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchStock(searchInput.value);
  });

  filterEl?.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderStocks();
  });
}

// ============================================
// LOAD DATA
// ============================================
async function loadMarketData(forceRefresh = false) {
  const refreshBtn = document.getElementById('market-refresh');
  if (refreshBtn) {
    refreshBtn.textContent = '◌ LOADING...';
    refreshBtn.disabled = true;
  }

  // Set cooldown
  refreshCooldown = true;
  setTimeout(() => { refreshCooldown = false; }, 60000); // 1 min cooldown

  try {
    // Fetch quotes for all tickers (batched by 10 to avoid URL length issues)
    allQuotes = [];
    const tickers = STOCKS.map(s => s.ticker);
    const batchSize = 10;

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      try {
        const resp = await fetch(apiUrl(`/api/quotes?tickers=${batch.join(',')}`));
        if (resp.ok) {
          const data = await resp.json();
          if (data.quotes) allQuotes.push(...data.quotes);
        }
      } catch { /* skip batch */ }
    }

    // Fetch AI analysis
    const topMovers = allQuotes
      .filter(q => Math.abs(q.changePercent) > 1)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 8)
      .map(q => {
        const info = STOCK_MAP[q.ticker];
        return `${q.ticker} (${info?.name || ''}): ${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(1)}% — ${info?.category || ''}`;
      }).join('\n');

    try {
      const aiResp = await fetch(apiUrl('/api/market-analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movers: topMovers || 'Markets relatively flat today.', refresh: forceRefresh })
      });
      if (aiResp.ok) aiAnalysis = await aiResp.json();
    } catch { /* AI optional */ }

    renderStocks();
  } catch (err) {
    bodyEl.innerHTML = `<div class="market-empty">Market data unavailable<br><span style="color:#556;font-size:10px">${err.message}</span></div>`;
  }

  if (refreshBtn) {
    refreshBtn.textContent = '↻ REFRESH';
    refreshBtn.disabled = false;
  }
}

// ============================================
// RENDER
// ============================================
function renderStocks() {
  if (!bodyEl) return;

  // AI brief at top
  const briefHtml = aiAnalysis?.brief ? `
    <div class="market-brief">
      <div class="market-brief-label">◆ NEXUS MARKET BRIEF</div>
      <div class="market-brief-text">${escapeHtml(aiAnalysis.brief)}</div>
    </div>
  ` : '';

  // Filter stocks
  const filtered = currentFilter === 'all'
    ? STOCKS
    : STOCKS.filter(s => s.category === currentFilter);

  // Build quote lookup
  const quoteMap = {};
  for (const q of allQuotes) quoteMap[q.ticker] = q;

  // Find AI sentiment for each ticker
  const aiMovers = {};
  if (aiAnalysis?.topMovers) {
    for (const m of aiAnalysis.topMovers) {
      aiMovers[m.ticker] = m;
    }
  }

  const cardsHtml = filtered.map(stock => {
    const q = quoteMap[stock.ticker];
    const ai = aiMovers[stock.ticker];
    const cat = CATEGORIES[stock.category] || {};
    const price = q ? q.price.toFixed(2) : '--';
    const change = q ? q.change.toFixed(2) : '--';
    const changePct = q ? q.changePercent.toFixed(2) : '--';
    const isUp = q && q.change > 0;
    const isDown = q && q.change < 0;
    const changeColor = isUp ? '#00ff88' : isDown ? '#ff3344' : '#888';
    const arrow = isUp ? '▲' : isDown ? '▼' : '—';
    const sentiment = ai?.sentiment || (isUp ? 'positive' : isDown ? 'negative' : 'neutral');
    const sentColor = sentiment === 'positive' ? '#00ff88' : sentiment === 'negative' ? '#ff3344' : '#888';

    return `
      <div class="market-card" data-ticker="${stock.ticker}">
        <div class="market-card-top">
          <div class="market-card-left">
            <span class="market-ticker">${stock.ticker}</span>
            <span class="market-name">${escapeHtml(stock.name)}</span>
          </div>
          <div class="market-card-right">
            <span class="market-price">$${price}</span>
            <span class="market-change" style="color:${changeColor}">${arrow} ${changePct}%</span>
          </div>
        </div>
        <div class="market-card-bottom">
          <span class="market-cat-badge" style="color:${cat.color}">${cat.icon || '●'} ${cat.label || stock.category}</span>
          <span class="market-sentiment" style="color:${sentColor}">${sentiment.toUpperCase()}</span>
        </div>
        ${ai?.reason ? `<div class="market-ai-reason">${escapeHtml(ai.reason)}</div>` : ''}
      </div>
    `;
  }).join('');

  bodyEl.innerHTML = briefHtml + (cardsHtml || '<div class="market-empty">No stocks in this category</div>');

  // Click handlers for expanded detail
  bodyEl.querySelectorAll('.market-card').forEach(card => {
    card.addEventListener('click', () => {
      const ticker = card.dataset.ticker;
      showStockDetail(ticker);
    });
  });
}

// ============================================
// STOCK DETAIL (inline expand)
// ============================================
function showStockDetail(ticker, searchedQuote = null) {
  const stock = STOCK_MAP[ticker] || { ticker, name: ticker, category: 'other', desc: 'Custom search' };
  const q = searchedQuote || allQuotes.find(q => q.ticker === ticker);
  const ai = aiAnalysis?.topMovers?.find(m => m.ticker === ticker);
  const cat = CATEGORIES[stock?.category] || { label: 'CUSTOM', color: '#888899', icon: '📈' };

  if (!stock) return;

  const changeColor = q?.change > 0 ? '#00ff88' : q?.change < 0 ? '#ff3344' : '#888';

  // Use the detail panel (right side)
  const panelEl = document.getElementById('detail-panel');
  const titleEl = document.getElementById('detail-title');
  const detailBody = document.getElementById('detail-body');

  titleEl.textContent = '◈ STOCK DETAIL';

  detailBody.innerHTML = `
    <div class="detail-callsign" style="color:${cat.color}">${stock.ticker}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${cat.color}22;border:1px solid ${cat.color}66;color:${cat.color}">${cat.icon} ${cat.label}</span>
      ${q?.marketState ? `<span class="detail-type-badge" style="background:#00ff8822;border:1px solid #00ff8866;color:#00ff88">${q.marketState}</span>` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">ASSET INFO</div>
      <div class="detail-row"><span class="detail-key">NAME</span><span class="detail-val">${escapeHtml(stock.name)}</span></div>
      <div class="detail-row"><span class="detail-key">TICKER</span><span class="detail-val">${stock.ticker}</span></div>
      <div class="detail-row"><span class="detail-key">SECTOR</span><span class="detail-val" style="color:${cat.color}">${cat.label}</span></div>
      <div class="detail-row"><span class="detail-key">RELEVANCE</span><span class="detail-val">${escapeHtml(stock.desc)}</span></div>
    </div>

    ${q ? `
    <div class="detail-section">
      <div class="detail-section-title">MARKET DATA</div>
      <div class="detail-row"><span class="detail-key">PRICE</span><span class="detail-val">$${q.price.toFixed(2)}</span></div>
      <div class="detail-row"><span class="detail-key">CHANGE</span><span class="detail-val" style="color:${changeColor}">${q.change > 0 ? '+' : ''}$${q.change.toFixed(2)} (${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)</span></div>
      <div class="detail-row"><span class="detail-key">PREV CLOSE</span><span class="detail-val">$${q.prevClose?.toFixed(2) || '--'}</span></div>
      <div class="detail-row"><span class="detail-key">VOLUME</span><span class="detail-val">${q.volume ? q.volume.toLocaleString() : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">EXCHANGE</span><span class="detail-val">${q.exchange || '--'}</span></div>
    </div>
    ` : ''}

    ${ai?.reason ? `
    <div class="detail-section">
      <div class="detail-section-title">◆ NEXUS ASSESSMENT</div>
      <div class="nexus-text">${escapeHtml(ai.reason)}</div>
      <div class="nexus-threat"><span class="nexus-threat-label">SENTIMENT</span><span style="color:${ai.sentiment === 'positive' ? '#00ff88' : ai.sentiment === 'negative' ? '#ff3344' : '#888'}">${(ai.sentiment || 'neutral').toUpperCase()}</span></div>
    </div>
    ` : ''}

    ${renderSaveButton('stock', ticker, { name: stock.name, subtitle: cat.label })}
  `;

  panelEl.classList.remove('hidden');
  bindSaveButtons(detailBody);
}

// ============================================
// STOCK SEARCH — any ticker
// ============================================
async function searchStock(query) {
  if (!query || query.trim().length === 0) return;
  const q = query.trim();
  const searchBtn = document.getElementById('market-search-btn');
  if (searchBtn) searchBtn.textContent = '...';

  // 1. Try to match by company name in the universe first
  let ticker = q.toUpperCase();
  const nameMatch = STOCKS.find(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.ticker === ticker
  );
  if (nameMatch) ticker = nameMatch.ticker;

  try {
    // 2. If no local match and looks like a company name (not a ticker), try Yahoo search
    if (!nameMatch && q.length > 4 && /[a-z\s]/.test(q)) {
      try {
        const searchResp = await fetch(apiUrl(`/api/stock-search?q=${encodeURIComponent(q)}`));
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.symbol) ticker = searchData.symbol;
        }
      } catch { /* fallback to raw query as ticker */ }
    }

    // 3. Fetch quote for resolved ticker
    const resp = await fetch(apiUrl(`/api/quotes?tickers=${encodeURIComponent(ticker)}`));
    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();
    const quote = data.quotes?.[0];

    if (!quote || !quote.price) {
      if (searchBtn) searchBtn.textContent = 'NOT FOUND';
      setTimeout(() => { if (searchBtn) searchBtn.textContent = 'GO'; }, 2000);
      return;
    }

    // 4. Add to quotes array
    const existing = allQuotes.findIndex(aq => aq.ticker === ticker);
    if (existing >= 0) {
      allQuotes[existing] = quote;
    } else {
      allQuotes.push(quote);
    }

    // 5. Show detail
    showStockDetail(ticker, quote);
    if (searchBtn) searchBtn.textContent = 'GO';
    document.getElementById('market-search').value = ticker; // show resolved ticker
  } catch (err) {
    console.warn('Stock search error:', err);
    if (searchBtn) { searchBtn.textContent = 'ERR'; setTimeout(() => { searchBtn.textContent = 'GO'; }, 2000); }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
