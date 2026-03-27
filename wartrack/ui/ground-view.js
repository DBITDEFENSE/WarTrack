// ============================================
// GROUND VIEW — Multi-provider street-level experience
// Google Street View (primary) → Mapillary (fallback) → Static map (last resort)
// ============================================

import { apiUrl } from '../config.js';

// API keys are server-side only — frontend proxies through /api/streetview and /api/mapillary
const GOOGLE_API_KEY = ''; // DO NOT put keys here — they go in Railway env vars
const MAPILLARY_ACCESS_TOKEN = '';

let modalEl = null;

// ============================================
// INIT
// ============================================
export function initGroundView() {
  modalEl = document.createElement('div');
  modalEl.id = 'ground-view-modal';
  modalEl.className = 'ground-view-modal hidden';
  modalEl.innerHTML = `
    <div class="gv-backdrop"></div>
    <div class="gv-container">
      <div class="gv-header">
        <span class="gv-title">◈ GROUND VIEW</span>
        <span class="gv-location-name" id="gv-location-name"></span>
        <button class="gv-close" id="gv-close">✕</button>
      </div>
      <div class="gv-body" id="gv-body">
        <div class="gv-loading">Searching for street-level imagery...</div>
      </div>
      <div class="gv-footer" id="gv-footer">
        <span class="gv-coords" id="gv-coords"></span>
        <span class="gv-provider-badge" id="gv-provider-badge"></span>
        <div class="gv-actions" id="gv-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.querySelector('.gv-backdrop').addEventListener('click', closeGroundView);
  modalEl.querySelector('#gv-close').addEventListener('click', closeGroundView);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeGroundView();
  });
}

// ============================================
// OPEN — Multi-provider cascade
// ============================================
export async function openGroundView(lat, lon, name = '', context = {}) {
  if (!modalEl) return;

  const locationName = document.getElementById('gv-location-name');
  const coords = document.getElementById('gv-coords');
  const body = document.getElementById('gv-body');
  const actions = document.getElementById('gv-actions');
  const badge = document.getElementById('gv-provider-badge');

  locationName.textContent = name || 'Selected Location';
  coords.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  badge.textContent = '';
  modalEl.classList.remove('hidden');

  // Phase 1: Show preview image immediately (Google Static)
  body.innerHTML = `
    <div class="gv-preview-container">
      <img class="gv-preview-img" id="gv-preview"
        src="${apiUrl(`/api/streetview?lat=${lat}&lon=${lon}`)}"
        alt="Street view preview"
        onerror="this.style.display='none'; document.getElementById('gv-no-sv')?.classList.remove('hidden');"
      />
      <div class="gv-preview-overlay" id="gv-preview-overlay">
        <div class="gv-preview-hint">Click for interactive 360° view</div>
      </div>
      <div class="gv-no-imagery hidden" id="gv-no-sv">
        <div class="gv-no-icon">📡</div>
        <div>No street-level imagery at this location</div>
        <div class="gv-no-sub">Trying alternative sources...</div>
      </div>
    </div>
  `;

  // Action buttons
  actions.innerHTML = `
    <button class="gv-btn gv-btn-primary" id="gv-btn-streetview">◈ 360° STREET VIEW</button>
    <a href="https://www.google.com/maps/@${lat},${lon},15z" target="_blank" rel="noopener" class="gv-btn">MAP →</a>
  `;
  badge.textContent = 'GOOGLE STREET VIEW';
  badge.className = 'gv-provider-badge gv-badge-google';

  // Click preview to open interactive mode
  const previewOverlay = document.getElementById('gv-preview-overlay');
  const svBtn = document.getElementById('gv-btn-streetview');

  const openInteractive = () => showInteractiveStreetView(lat, lon, body, badge);
  previewOverlay?.addEventListener('click', openInteractive);
  svBtn?.addEventListener('click', openInteractive);

  // Phase 2: Check if Google Street View actually has coverage
  // The static image returns a gray "no imagery" placeholder when unavailable
  // We detect this via the onerror handler on the img tag
  // Also try Mapillary in parallel
  setTimeout(async () => {
    const img = document.getElementById('gv-preview');
    const noSv = document.getElementById('gv-no-sv');

    // If image failed to load or is hidden
    if (img && (img.style.display === 'none' || !img.naturalWidth)) {
      // Try Mapillary
      const mapillaryResult = await tryMapillary(lat, lon);
      if (mapillaryResult) {
        showMapillaryResult(mapillaryResult, body, badge, actions, lat, lon);
      } else {
        // Last resort: satellite static map
        showSatelliteFallback(lat, lon, body, badge);
      }
    }
  }, 2000);
}

// ============================================
// INTERACTIVE STREET VIEW (Google Embed)
// ============================================
function showInteractiveStreetView(lat, lon, body, badge) {
  // Interactive mode: open Google Street View in a new tab (embed requires key in URL)
  // For in-app, show the static preview large and link out
  window.open(`https://www.google.com/maps/@${lat},${lon},3a,75y,0h,90t/data=!3m1!1e3`, '_blank');
  badge.textContent = 'GOOGLE STREET VIEW — OPENED IN NEW TAB';
  badge.className = 'gv-provider-badge gv-badge-google';
}

// ============================================
// MAPILLARY FALLBACK
// ============================================
async function tryMapillary(lat, lon) {
  try {
    // Mapillary search goes through server proxy (keeps token server-side)
    const resp = await fetch(apiUrl(`/api/mapillary?lat=${lat}&lon=${lon}`));
    if (!resp.ok) throw new Error('Mapillary API error');
    const data = await resp.json();

    if (data.data && data.data.length > 0) {
      const img = data.data[0];
      return {
        available: true,
        imageId: img.id,
        thumbUrl: img.thumb_1024_url || img.thumb_256_url,
        capturedAt: img.captured_at,
        viewerUrl: `https://www.mapillary.com/app/?pKey=${img.id}`,
        source: 'mapillary',
      };
    }
    // No images in bbox — still offer viewer link
    return {
      available: false,
      viewerUrl: `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=15`,
      source: 'mapillary',
    };
  } catch {
    return null;
  }
}

function showMapillaryResult(result, body, badge, actions, lat, lon) {
  if (result.available && result.thumbUrl) {
    // Show actual Mapillary image
    const dateStr = result.capturedAt ? new Date(result.capturedAt).toLocaleDateString() : '';
    body.innerHTML = `
      <div class="gv-preview-container">
        <img class="gv-preview-img" src="${result.thumbUrl}" alt="Mapillary street-level image" />
        <div class="gv-preview-overlay" id="gv-mapillary-open">
          <div class="gv-preview-hint">Click to open full Mapillary viewer</div>
        </div>
        <div class="gv-info-strip">
          <span class="gv-provider">MAPILLARY COMMUNITY IMAGE${dateStr ? ` — ${dateStr}` : ''}</span>
        </div>
      </div>
    `;
    document.getElementById('gv-mapillary-open')?.addEventListener('click', () => {
      window.open(result.viewerUrl, '_blank');
    });
  } else {
    body.innerHTML = `
      <div class="gv-fallback-container">
        <div class="gv-fallback-icon">🗺️</div>
        <div class="gv-fallback-text">
          No Google Street View coverage here.
          <br/>Mapillary may have nearby community imagery.
        </div>
        <a href="${result.viewerUrl}" target="_blank" rel="noopener" class="gv-btn gv-btn-primary" style="margin-top:12px;display:inline-block;text-decoration:none;">
          SEARCH MAPILLARY →
        </a>
      </div>
    `;
  }
  badge.textContent = 'MAPILLARY';
  badge.className = 'gv-provider-badge gv-badge-mapillary';

  actions.innerHTML = `
    <a href="${result.viewerUrl}" target="_blank" rel="noopener" class="gv-btn gv-btn-primary">MAPILLARY →</a>
    <a href="https://www.google.com/maps/@${lat},${lon},15z" target="_blank" rel="noopener" class="gv-btn">SATELLITE MAP →</a>
  `;
}

// ============================================
// SATELLITE FALLBACK (last resort)
// ============================================
function showSatelliteFallback(lat, lon, body, badge) {
  body.innerHTML = `
    <div class="gv-preview-container">
      <img class="gv-preview-img"
        src="${apiUrl(`/api/staticmap?lat=${lat}&lon=${lon}`)}"
        alt="Satellite view"
      />
      <div class="gv-info-strip">
        <span>SATELLITE IMAGERY — No street-level coverage available</span>
      </div>
    </div>
  `;
  badge.textContent = 'GOOGLE SATELLITE';
  badge.className = 'gv-provider-badge gv-badge-satellite';
}

// ============================================
// CLOSE
// ============================================
export function closeGroundView() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  const body = document.getElementById('gv-body');
  if (body) body.innerHTML = '';
}

// ============================================
// BUTTON HELPERS for detail panels
// ============================================
export function renderGroundViewButton(lat, lon, name = '', context = {}) {
  return `
    <button class="detail-btn-groundview"
            data-lat="${lat}" data-lon="${lon}"
            data-name="${name}"
            data-severity="${context.severity || ''}">
      ◈ GROUND VIEW
    </button>
  `;
}

export function bindGroundViewButtons(container) {
  container.querySelectorAll('.detail-btn-groundview').forEach(btn => {
    btn.addEventListener('click', () => {
      const lat = parseFloat(btn.dataset.lat);
      const lon = parseFloat(btn.dataset.lon);
      const name = btn.dataset.name;
      const severity = btn.dataset.severity;
      if (!isNaN(lat) && !isNaN(lon)) {
        openGroundView(lat, lon, name, { severity });
      }
    });
  });
}
