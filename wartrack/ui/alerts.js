// ============================================
// ALERTS UI — Event detection alert panel
// ============================================

import { getAlerts, dismissAlert, getAlertCount } from '../layers/events.js';

let panelEl, bodyEl;

const ALERT_ICONS = {
  MIL_SPIKE: '✈',
  TRAFFIC_SURGE: '📡',
  VESSEL_DROP: '⚓',
  DEFAULT: '⚠',
};

const SEVERITY_COLORS = { high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' };

export function initAlerts(viewer) {
  panelEl = document.getElementById('alerts-panel');
  bodyEl = document.getElementById('alerts-body');

  const btn = document.getElementById('btn-alerts');
  const closeBtn = document.getElementById('alerts-close');

  btn?.addEventListener('click', () => {
    panelEl?.classList.toggle('hidden');
    if (!panelEl?.classList.contains('hidden')) renderAlerts(viewer);
  });
  closeBtn?.addEventListener('click', () => panelEl?.classList.add('hidden'));

  // Listen for new alerts
  window.addEventListener('wartrack-alert', () => {
    updateBadge();
    if (panelEl && !panelEl.classList.contains('hidden')) renderAlerts(viewer);
  });

  // Update badge periodically
  setInterval(updateBadge, 5000);
}

function updateBadge() {
  const badge = document.getElementById('alert-badge');
  const count = getAlertCount();
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function renderAlerts(viewer) {
  if (!bodyEl) return;
  const alerts = getAlerts();

  if (alerts.length === 0) {
    bodyEl.innerHTML = '<div class="alert-empty">No anomalies detected.<br>Monitoring all sectors.</div>';
    return;
  }

  bodyEl.innerHTML = alerts.slice(0, 15).map(a => {
    const color = SEVERITY_COLORS[a.severity] || '#888';
    const icon = ALERT_ICONS[a.type] || ALERT_ICONS.DEFAULT;
    const ago = Math.round((Date.now() - a.timestamp) / 60000);
    const agoText = ago < 1 ? 'just now' : `${ago}m ago`;

    return `
      <div class="alert-card" data-alert-id="${a.id}" data-lat="${a.lat}" data-lon="${a.lon}">
        <div class="alert-card-top">
          <span class="alert-icon">${icon}</span>
          <div class="alert-content">
            <div class="alert-region" style="color:${color}">${a.region}</div>
            <div class="alert-desc">${a.description}</div>
          </div>
          <span class="alert-time">${agoText}</span>
        </div>
        <div class="alert-actions">
          <button class="alert-investigate" data-lat="${a.lat}" data-lon="${a.lon}">INVESTIGATE</button>
          <button class="alert-dismiss" data-id="${a.id}">DISMISS</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire buttons
  bodyEl.querySelectorAll('.alert-investigate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lat = parseFloat(e.target.dataset.lat);
      const lon = parseFloat(e.target.dataset.lon);
      if (!isNaN(lat) && !isNaN(lon) && viewer) {
        viewer.scene.requestRenderMode = false;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1500000),
          duration: 1.5,
          complete: () => { viewer.scene.requestRenderMode = true; },
          cancel: () => { viewer.scene.requestRenderMode = true; },
        });
      }
    });
  });

  bodyEl.querySelectorAll('.alert-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      dismissAlert(e.target.dataset.id);
      renderAlerts(viewer);
      updateBadge();
    });
  });
}
