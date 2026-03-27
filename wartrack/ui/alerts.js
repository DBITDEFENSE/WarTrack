// ============================================
// ALERTS UI — Event detection alert panel
// ============================================

import { getAlerts, dismissAlert, getAlertCount } from '../layers/events.js';

let panelEl, bodyEl;
let alertSoundsMuted = localStorage.getItem('wartrack-alert-mute') === 'true';

// ============================================
// ALERT SOUNDS (Web Audio API — no external files needed)
// ============================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playAlertTone(severity) {
  if (alertSoundsMuted) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (severity === 'critical') {
      // Urgent double beep
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (severity === 'high') {
      // Single sharp beep
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Soft chime for elevated/watch
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch { /* audio not available */ }
}

export function setAlertSoundsMuted(muted) {
  alertSoundsMuted = muted;
  localStorage.setItem('wartrack-alert-mute', muted ? 'true' : 'false');
}

const ALERT_ICONS = {
  MIL_SPIKE: '✈',
  TRAFFIC_SURGE: '📡',
  VESSEL_DROP: '⚓',
  CORRELATED_ESCALATION: '🔺',
  ROUTE_AVOIDANCE: '🚢',
  JAMMING_DETECTED: '📡',
  OSINT_ALERT: '📰',
  DEFAULT: '⚠',
};

const SEVERITY_COLORS = { critical: '#ff1133', high: '#ff3344', elevated: '#ffaa00', watch: '#ffdd44' };

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

  // Mute toggle button
  const muteBtn = document.getElementById('alerts-mute');
  if (muteBtn) {
    muteBtn.textContent = alertSoundsMuted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      setAlertSoundsMuted(!alertSoundsMuted);
      muteBtn.textContent = alertSoundsMuted ? '🔇' : '🔊';
    });
  }

  // Listen for new alerts
  window.addEventListener('wartrack-alert', (e) => {
    updateBadge();
    if (panelEl && !panelEl.classList.contains('hidden')) renderAlerts(viewer);
    // Play notification sound based on severity
    const severity = e.detail?.severity || 'elevated';
    playAlertTone(severity);
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
