// ============================================
// NEXUS INTELLIGENCE ADVISOR — Map-aware AI interaction
// User-triggered, location-resolving, camera-controlling
// ============================================

import { apiUrl } from '../config.js';
import { getRegionIntel, getGlobalIntelSummary } from '../layers/correlator.js';
let panelEl, messagesEl, inputEl;
let viewer = null;
let conversation = []; // { role: 'user'|'nexus', text, location? }
const MAX_HISTORY = 10;

const SEVERITY_COLORS = { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44', low: '#00ff88' };

// ============================================
// INIT
// ============================================
export function initNexus(v) {
  viewer = v;

  const btn = document.getElementById('btn-nexus');
  btn?.addEventListener('click', togglePanel);

  const closeBtn = document.getElementById('nexus-close');
  closeBtn?.addEventListener('click', () => {
    document.getElementById('nexus-panel')?.classList.add('hidden');
  });

  inputEl = document.getElementById('nexus-input');
  messagesEl = document.getElementById('nexus-messages');

  // Submit on Enter
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  });

  // Submit button
  document.getElementById('nexus-submit')?.addEventListener('click', submitQuery);
}

// Future hook for avatar/talking-head attachment
export function setAvatarElement(el) {
  const slot = document.getElementById('nexus-avatar-slot');
  if (slot && el) slot.appendChild(el);
}

// ============================================
// TOGGLE PANEL
// ============================================
function togglePanel() {
  const panel = document.getElementById('nexus-panel');
  panel?.classList.toggle('hidden');
  if (!panel?.classList.contains('hidden')) {
    inputEl?.focus();
    if (conversation.length === 0) {
      addNexusMessage('NEXUS online. Ask me about any region, conflict, or geopolitical situation. I can move the map and brief you.', null);
    }
  }
}

// ============================================
// SUBMIT QUERY
// ============================================
async function submitQuery() {
  const query = inputEl?.value?.trim();
  if (!query) return;

  // Show user message
  addUserMessage(query);
  inputEl.value = '';

  // Show loading
  const loadingId = addNexusMessage('Analyzing...', null, true);

  try {
    // Gather live intelligence context from correlation engine
    let liveContext = null;
    try {
      const summary = getGlobalIntelSummary() || [];
      const regionIntel = getRegionIntel();
      liveContext = {
        globalSummary: summary.slice(0, 5), // top 5 threat regions
        totalFlights: document.getElementById('count-flights')?.textContent || '0',
        totalMilitary: document.getElementById('count-military')?.textContent || '0',
        totalVessels: document.getElementById('count-vessels')?.textContent || '0',
        jammingCells: document.getElementById('count-jamming')?.textContent || '0',
        satellites: document.getElementById('count-satellites')?.textContent || '0',
      };
    } catch { /* correlation not ready */ }

    const resp = await fetch(apiUrl('/api/nexus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, liveContext })
    });

    const data = await resp.json();
    removeMessage(loadingId);

    if (data.error && !data.briefing) {
      addNexusMessage(data.briefing || 'NEXUS is currently offline.', null);
      return;
    }

    // Fly camera to resolved location
    if (data.location?.lat && data.location?.lon) {
      flyToLocation(data.location.lat, data.location.lon, data.location.name);
    }

    // Show NEXUS response
    addNexusMessage(data.briefing || 'No intelligence available.', data);

  } catch (err) {
    removeMessage(loadingId);
    addNexusMessage('Connection to NEXUS failed. Check network status.', null);
  }
}

// ============================================
// FLY CAMERA TO LOCATION
// ============================================
function flyToLocation(lat, lon, name) {
  if (!viewer) return;

  viewer.scene.requestRenderMode = false;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000000),
    duration: 1.5,
    easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    complete: () => { viewer.scene.requestRenderMode = true; },
    cancel: () => { viewer.scene.requestRenderMode = true; },
  });
}

// ============================================
// MESSAGE RENDERING
// ============================================
let msgCounter = 0;

function addUserMessage(text) {
  const id = `msg-${++msgCounter}`;
  conversation.push({ role: 'user', text });
  if (conversation.length > MAX_HISTORY) conversation.shift();

  const div = document.createElement('div');
  div.className = 'nexus-msg nexus-msg-user';
  div.id = id;
  div.innerHTML = `<div class="nexus-msg-label">OPERATOR</div><div class="nexus-msg-text">${escapeHtml(text)}</div>`;
  messagesEl?.appendChild(div);
  scrollToBottom();
  return id;
}

function addNexusMessage(text, data, isLoading = false) {
  const id = `msg-${++msgCounter}`;
  if (!isLoading) {
    conversation.push({ role: 'nexus', text });
    if (conversation.length > MAX_HISTORY) conversation.shift();
  }

  const div = document.createElement('div');
  div.className = `nexus-msg nexus-msg-nexus ${isLoading ? 'nexus-msg-loading' : ''}`;
  div.id = id;

  let content = `<div class="nexus-msg-label">◆ NEXUS</div>`;
  content += `<div class="nexus-msg-text">${escapeHtml(text)}</div>`;

  // Add location badge + fly-to button if location data
  if (data?.location?.name) {
    const color = SEVERITY_COLORS[data.severity] || '#888';
    content += `
      <div class="nexus-msg-meta">
        <span class="nexus-location-badge" style="color:${color}">◎ ${escapeHtml(data.location.name)}</span>
        ${data.severity ? `<span class="nexus-severity-badge" style="border-color:${color};color:${color}">${data.severity.toUpperCase()}</span>` : ''}
      </div>
    `;
  }

  // Add recommendation if present
  if (data?.recommendation) {
    content += `<div class="nexus-msg-rec">MONITOR: ${escapeHtml(data.recommendation)}</div>`;
  }

  // Fly-to button
  if (data?.location?.lat && data?.location?.lon) {
    content += `<button class="nexus-fly-btn" data-lat="${data.location.lat}" data-lon="${data.location.lon}">FLY TO REGION</button>`;
  }

  div.innerHTML = content;
  messagesEl?.appendChild(div);

  // Wire fly-to button
  div.querySelector('.nexus-fly-btn')?.addEventListener('click', (e) => {
    flyToLocation(parseFloat(e.target.dataset.lat), parseFloat(e.target.dataset.lon));
  });

  scrollToBottom();
  return id;
}

function removeMessage(id) {
  document.getElementById(id)?.remove();
}

function scrollToBottom() {
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
