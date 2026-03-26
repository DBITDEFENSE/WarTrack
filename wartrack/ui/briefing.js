// ============================================
// BRIEFING PANEL — Executive World Summary on Load
// ============================================

import { fetchAllNews } from '../layers/news.js';
import { getHotspots } from '../layers/hotspots.js';
import { apiUrl } from '../config.js';

let briefingData = null;
let panelEl = null;

// ============================================
// INIT — called after data loads
// ============================================
export async function initBriefing() {
  createPanel();
  await generateBriefing();
}

// ============================================
// CREATE PANEL DOM
// ============================================
function createPanel() {
  panelEl = document.createElement('div');
  panelEl.id = 'briefing-overlay';
  panelEl.innerHTML = `
    <div class="briefing-backdrop"></div>
    <div class="briefing-panel">
      <div class="briefing-header">
        <div class="briefing-logo">◆ NEXUS</div>
        <div class="briefing-title">WARTRACK DAILY BRIEFING</div>
        <div class="briefing-time" id="briefing-time"></div>
      </div>
      <div class="briefing-body" id="briefing-body">
        <div class="briefing-loading">
          <div class="briefing-loading-text">NEXUS is analyzing world intelligence...</div>
          <div class="briefing-loading-bar"><div class="briefing-loading-fill"></div></div>
        </div>
      </div>
      <div class="briefing-footer">
        <button class="briefing-btn-audio" id="briefing-audio-btn" title="Play audio briefing">▶ AUDIO</button>
        <button class="briefing-btn-dismiss" id="briefing-dismiss">ENTER COMMAND CENTER →</button>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  // Set time
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' ZULU';
  document.getElementById('briefing-time').textContent = timeStr;

  // Dismiss handler
  document.getElementById('briefing-dismiss').addEventListener('click', dismissBriefing);
  panelEl.querySelector('.briefing-backdrop').addEventListener('click', dismissBriefing);

  // Audio handler
  document.getElementById('briefing-audio-btn').addEventListener('click', playAudioBriefing);
}

// ============================================
// GENERATE BRIEFING
// ============================================
async function generateBriefing() {
  const bodyEl = document.getElementById('briefing-body');

  try {
    // Fetch news for all hotspots
    const hotspots = getHotspots();
    const articles = await fetchAllNews(hotspots);

    // Send to Claude API for summary
    const resp = await fetch(apiUrl('/api/summary'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: articles.slice(0, 15) })
    });
    briefingData = await resp.json();

    renderBriefing(bodyEl);
  } catch (err) {
    bodyEl.innerHTML = `
      <div class="briefing-summary">
        <p>NEXUS briefing unavailable. Intelligence feeds may be offline.</p>
        <p style="color:#556;font-size:11px;margin-top:8px">${err.message}</p>
      </div>
    `;
  }
}

// ============================================
// RENDER BRIEFING CONTENT
// ============================================
function renderBriefing(bodyEl) {
  if (!briefingData) return;

  const severityColors = { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' };

  const highlightsHtml = (briefingData.highlights || []).map(h => {
    const color = severityColors[h.severity] || '#888';
    return `
      <div class="briefing-highlight">
        <span class="briefing-severity-dot" style="background:${color}"></span>
        <span class="briefing-region">${escapeHtml(h.region)}</span>
        <span class="briefing-insight">${escapeHtml(h.insight)}</span>
      </div>
    `;
  }).join('');

  const storiesHtml = (briefingData.topStories || []).map((s, i) => {
    const hotspotColor = severityColors[s.severity] || '#888';
    return `
      <a class="briefing-story" href="${s.url || '#'}" target="_blank" rel="noopener">
        <span class="briefing-story-num">${i + 1}</span>
        <div class="briefing-story-content">
          <div class="briefing-story-title">${escapeHtml(s.title || 'Untitled')}</div>
          <div class="briefing-story-meta">
            <span style="color:${hotspotColor}">${escapeHtml(s.hotspot || '')}</span>
            <span class="briefing-story-source">${escapeHtml(s.source?.name || '')}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');

  bodyEl.innerHTML = `
    <div class="briefing-summary">
      <p>${escapeHtml(briefingData.briefing || 'No briefing available.')}</p>
    </div>

    ${highlightsHtml ? `
      <div class="briefing-section">
        <div class="briefing-section-title">SITUATION HIGHLIGHTS</div>
        ${highlightsHtml}
      </div>
    ` : ''}

    ${storiesHtml ? `
      <div class="briefing-section">
        <div class="briefing-section-title">TOP INTELLIGENCE</div>
        ${storiesHtml}
      </div>
    ` : ''}

    ${briefingData.closingRemark ? `
      <div class="briefing-closing">
        <span class="briefing-closing-label">NEXUS:</span> ${escapeHtml(briefingData.closingRemark)}
      </div>
    ` : ''}
  `;
}

// ============================================
// DISMISS
// ============================================
function dismissBriefing() {
  if (panelEl) {
    panelEl.classList.add('fade-out');
    setTimeout(() => {
      panelEl.remove();
      panelEl = null;
    }, 500);
  }
}

// ============================================
// AUDIO PLAYBACK (ElevenLabs TTS)
// ============================================
async function playAudioBriefing() {
  const btn = document.getElementById('briefing-audio-btn');
  if (!briefingData?.briefing) return;

  btn.textContent = '◌ LOADING...';
  btn.disabled = true;

  try {
    const text = `${briefingData.briefing} ${briefingData.closingRemark || ''}`;
    const resp = await fetch(apiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (resp.headers.get('content-type')?.includes('audio')) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      btn.textContent = '■ PLAYING';
      audio.addEventListener('ended', () => {
        btn.textContent = '▶ AUDIO';
        btn.disabled = false;
      });
    } else {
      let errMsg = 'TTS ERROR';
      try {
        const data = await resp.json();
        errMsg = data.error ? 'TTS: ' + data.error.substring(0, 20) : 'TTS UNAVAILABLE';
        console.warn('TTS error:', data);
      } catch { /* ignore */ }
      btn.textContent = `▶ ${errMsg}`;
      btn.disabled = false;
      // Reset label after 3 seconds
      setTimeout(() => { btn.textContent = '▶ AUDIO'; }, 3000);
    }
  } catch {
    btn.textContent = '▶ AUDIO';
    btn.disabled = false;
  }
}

// ============================================
// RE-OPEN (from HUD button)
// ============================================
export async function showBriefing() {
  if (panelEl) return; // already showing
  createPanel();
  if (briefingData) {
    renderBriefing(document.getElementById('briefing-body'));
  } else {
    await generateBriefing();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
