// ============================================
// GROUND VIEW — Street-level / location context modal
// Provider: Google Maps embed (no API key needed for basic embed)
// Fallback: Mapillary link, satellite view, location card
// ============================================

let modalEl = null;

// ============================================
// INIT — create modal element
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
        <div class="gv-loading">Loading ground view...</div>
      </div>
      <div class="gv-footer" id="gv-footer">
        <span class="gv-coords" id="gv-coords"></span>
        <div class="gv-actions" id="gv-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  // Close handlers
  modalEl.querySelector('.gv-backdrop').addEventListener('click', closeGroundView);
  modalEl.querySelector('#gv-close').addEventListener('click', closeGroundView);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
      closeGroundView();
    }
  });
}

// ============================================
// OPEN GROUND VIEW
// ============================================
export function openGroundView(lat, lon, name = '', context = {}) {
  if (!modalEl) return;

  const locationName = document.getElementById('gv-location-name');
  const coords = document.getElementById('gv-coords');
  const body = document.getElementById('gv-body');
  const actions = document.getElementById('gv-actions');

  // Set header info
  locationName.textContent = name || 'Selected Location';
  coords.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

  // Build the view content
  body.innerHTML = `
    <div class="gv-embed-container">
      <iframe
        class="gv-iframe"
        src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f35!5e1!3m2!1sen!2sus"
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
    <div class="gv-info-strip">
      <span class="gv-provider">GOOGLE MAPS SATELLITE</span>
      ${context.severity ? `<span class="gv-severity gv-severity-${context.severity}">${context.severity.toUpperCase()}</span>` : ''}
    </div>
  `;

  // Build action buttons
  actions.innerHTML = `
    <a href="https://www.google.com/maps/@${lat},${lon},3a,75y,90h,90t" target="_blank" rel="noopener" class="gv-btn gv-btn-primary">
      STREET VIEW →
    </a>
    <a href="https://www.google.com/maps/@${lat},${lon},15z" target="_blank" rel="noopener" class="gv-btn">
      MAP VIEW →
    </a>
    <a href="https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=15" target="_blank" rel="noopener" class="gv-btn">
      MAPILLARY →
    </a>
  `;

  modalEl.classList.remove('hidden');
}

// ============================================
// CLOSE
// ============================================
export function closeGroundView() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  // Clear iframe to stop loading
  const body = document.getElementById('gv-body');
  if (body) body.innerHTML = '';
}

// ============================================
// HELPER — generate "View Ground" button HTML for detail panels
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

// Bind click handlers on ground view buttons (call after rendering panel)
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
