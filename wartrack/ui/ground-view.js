// ============================================
// GROUND VIEW — Multi-provider street-level experience
// Google Street View (primary) → Mapillary (fallback) → Static map (last resort)
// ============================================

import { apiUrl } from '../config.js';

// API keys are server-side only — frontend proxies through /api/streetview and /api/mapillary
const GOOGLE_API_KEY = ''; // DO NOT put keys here — they go in Railway env vars
const MAPILLARY_ACCESS_TOKEN = '';

let modalEl = null;
let _gvDelegatedListenerBound = false;
let _gvCurrentLat = null;
let _gvCurrentLon = null;
let _gvMapillaryViewerUrl = null;

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

  // Delegated click listener for interactive street view triggers (registered once)
  const gvBody = modalEl.querySelector('#gv-body');
  const gvActions = modalEl.querySelector('#gv-actions');
  const handleInteractive = (e) => {
    if (e.target.closest('#gv-preview-overlay') || e.target.closest('#gv-btn-streetview')) {
      if (_gvCurrentLat !== null && _gvCurrentLon !== null) {
        const body = document.getElementById('gv-body');
        const badge = document.getElementById('gv-provider-badge');
        showInteractiveStreetView(_gvCurrentLat, _gvCurrentLon, body, badge);
      }
    }
    if (e.target.closest('#gv-mapillary-open') && _gvMapillaryViewerUrl) {
      window.open(_gvMapillaryViewerUrl, '_blank');
    }
  };
  gvBody.addEventListener('click', handleInteractive);
  gvActions.addEventListener('click', handleInteractive);
  _gvDelegatedListenerBound = true;
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

  _gvCurrentLat = lat;
  _gvCurrentLon = lon;

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
// INTERACTIVE STREET VIEW (Google Maps JS API — pannable 360°)
// ============================================
let mapsApiLoaded = false;

function loadGoogleMapsAPI() {
  return new Promise((resolve, reject) => {
    if (mapsApiLoaded && window.google?.maps) { resolve(); return; }
    // Fetch API key from server
    fetch(apiUrl('/api/config/google-maps-key'))
      .then(r => r.json())
      .then(data => {
        if (!data.key) { reject(new Error('No Google Maps key')); return; }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=streetView`;
        script.onload = () => { mapsApiLoaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
      })
      .catch(reject);
  });
}

async function showInteractiveStreetView(lat, lon, body, badge) {
  body.innerHTML = `<div class="gv-loading">Loading interactive Street View...</div>`;

  try {
    await loadGoogleMapsAPI();

    body.innerHTML = `<div id="gv-streetview-pano" style="width:100%;height:100%"></div>`;

    const panorama = new google.maps.StreetViewPanorama(
      document.getElementById('gv-streetview-pano'),
      {
        position: { lat, lng: lon },
        pov: { heading: 0, pitch: 0 },
        zoom: 1,
        addressControl: false,
        showRoadLabels: false,
        motionTracking: false,
        motionTrackingControl: false,
      }
    );

    // Check if panorama actually found imagery
    const sv = new google.maps.StreetViewService();
    sv.getPanorama({ location: { lat, lng: lon }, radius: 500 }, (data, status) => {
      if (status !== 'OK') {
        body.innerHTML = `
          <div class="gv-fallback-container">
            <div class="gv-fallback-icon">📡</div>
            <div class="gv-fallback-text">No interactive Street View available within 500m</div>
            <a href="https://www.google.com/maps/@${lat},${lon},3a,75y,0h,90t" target="_blank" class="gv-btn gv-btn-primary" style="margin-top:12px;display:inline-block;text-decoration:none">TRY GOOGLE MAPS →</a>
          </div>
        `;
      }
    });

    badge.textContent = 'GOOGLE STREET VIEW — INTERACTIVE (DRAG TO LOOK AROUND)';
    badge.className = 'gv-provider-badge gv-badge-google';
  } catch (err) {
    // Fallback: open in new tab
    window.open(`https://www.google.com/maps/@${lat},${lon},3a,75y,0h,90t/data=!3m1!1e3`, '_blank');
    badge.textContent = 'OPENED IN NEW TAB';
    badge.className = 'gv-provider-badge gv-badge-google';
  }
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
  _gvMapillaryViewerUrl = result.viewerUrl || null;
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
    // Mapillary open is handled by delegated listener on gv-body via #gv-mapillary-open
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
