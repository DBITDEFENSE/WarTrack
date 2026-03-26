// ============================================
// SETTINGS — User preferences (localStorage + Supabase sync)
// All settings work whether signed in or not
// ============================================

import { isAuthenticated, getAuthHeaders } from './auth.js';

const STORAGE_KEY = 'wartrack_settings';

const DEFAULTS = {
  timeFormat: '24h',
  timezone: 'UTC',
  altUnits: 'ft',
  speedUnits: 'kts',
  scanlines: 'on',
  maxAircraft: '1500',
  refreshRate: '60',
  tts: 'on',
  autoBriefing: 'on',
  globeStyle: 'satellite',
  labelDensity: 'full',
};

let settings = { ...DEFAULTS };

// ============================================
// LOAD / SAVE
// ============================================
function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ============================================
// PUBLIC API
// ============================================
export function getSetting(key) {
  return settings[key] ?? DEFAULTS[key];
}

export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
}

export function getAllSettings() {
  return { ...settings };
}

// ============================================
// APPLY SETTINGS
// ============================================
function applySettings() {
  // Scanlines
  const scanOverlay = document.getElementById('scanline-overlay');
  if (scanOverlay) {
    scanOverlay.style.display = settings.scanlines === 'off' ? 'none' : '';
  }

  // Label density
  const labelLayer = window._labelTileLayer;
  if (labelLayer) {
    switch (settings.labelDensity) {
      case 'off':
        labelLayer.show = false;
        break;
      case 'reduced':
        labelLayer.show = true;
        labelLayer.alpha = 0.4;
        break;
      default:
        labelLayer.show = true;
        labelLayer.alpha = 1.0;
    }
    window.viewer?.scene?.requestRender();
  }

  // Dispatch for other modules (clock.js, flights.js, etc.)
  window.dispatchEvent(new CustomEvent('wartrack-settings-changed', { detail: settings }));
}

// ============================================
// BILLING
// ============================================
async function loadBillingStatus() {
  try {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return;
    const resp = await fetch('/api/billing/status', { headers });
    if (!resp.ok) return;
    const data = await resp.json();
    updateBillingUI(data);
  } catch { /* ignore */ }
}

function updateBillingUI(billing) {
  const info = document.getElementById('settings-billing-info');
  const plans = document.getElementById('settings-plans');
  const manageBtn = document.getElementById('btn-manage-billing');

  if (!info) return;

  if (billing.status === 'active' || billing.status === 'trialing') {
    info.innerHTML = `<span style="color:#00ff88;font-weight:bold">◆ PRO</span> — Active${billing.periodEnd ? ` until ${new Date(billing.periodEnd).toLocaleDateString()}` : ''}`;
    if (plans) plans.style.display = 'none';
    if (manageBtn) manageBtn.style.display = '';
  } else if (billing.status === 'past_due') {
    info.innerHTML = '<span style="color:#ff5544">⚠ PAYMENT ISSUE</span> — Update billing to continue';
    if (manageBtn) manageBtn.style.display = '';
  } else {
    info.textContent = 'FREE PLAN';
    if (plans) plans.style.display = '';
    if (manageBtn) manageBtn.style.display = 'none';
  }
}

async function handleUpgrade(plan) {
  if (!isAuthenticated()) {
    // Must sign in first
    document.getElementById('btn-signin')?.click();
    return;
  }

  const btn = document.getElementById(`btn-upgrade-${plan}`);
  if (btn) {
    btn.textContent = 'LOADING...';
    btn.disabled = true;
  }

  try {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ plan })
    });
    const data = await resp.json();

    if (data.url) {
      // Redirect in same window (avoids popup blockers)
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Unable to start checkout', 'error');
      if (btn) { btn.textContent = plan === 'monthly' ? '$3 / MONTH' : '$15 / YEAR'; btn.disabled = false; }
    }
  } catch {
    showToast('Connection error — try again', 'error');
    if (btn) { btn.textContent = plan === 'monthly' ? '$3 / MONTH' : '$15 / YEAR'; btn.disabled = false; }
  }
}

async function handleManage() {
  const btn = document.getElementById('btn-manage-billing');
  if (btn) btn.textContent = 'LOADING...';

  try {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers }
    });
    const data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Unable to open billing portal', 'error');
    }
  } catch {
    showToast('Connection error', 'error');
  }
  if (btn) btn.textContent = 'MANAGE SUBSCRIPTION';
}

// Simple toast notification
function showToast(message, type = 'info') {
  const existing = document.getElementById('settings-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'settings-toast';
  toast.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    padding:10px 20px; border-radius:4px; font-family:var(--font-mono);
    font-size:11px; letter-spacing:1px; z-index:3000;
    background:${type === 'error' ? 'rgba(255,51,68,0.9)' : 'rgba(0,255,136,0.9)'};
    color:#000; animation: fadeInOut 3s ease forwards;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================
// INIT
// ============================================
export function initSettings() {
  loadSettings();

  const panel = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');
  const openBtn = document.getElementById('btn-settings');

  openBtn?.addEventListener('click', () => {
    panel?.classList.toggle('hidden');
    if (!panel?.classList.contains('hidden')) {
      syncUI();
      if (isAuthenticated()) loadBillingStatus();
    }
  });
  closeBtn?.addEventListener('click', () => panel?.classList.add('hidden'));

  // Bind ALL select settings
  const selects = {
    'setting-time-format': 'timeFormat',
    'setting-timezone': 'timezone',
    'setting-alt-units': 'altUnits',
    'setting-speed-units': 'speedUnits',
    'setting-scanlines': 'scanlines',
    'setting-max-aircraft': 'maxAircraft',
    'setting-refresh-rate': 'refreshRate',
    'setting-tts': 'tts',
    'setting-auto-briefing': 'autoBriefing',
    'setting-globe-style': 'globeStyle',
    'setting-label-density': 'labelDensity',
  };

  for (const [elemId, key] of Object.entries(selects)) {
    const el = document.getElementById(elemId);
    if (el) {
      el.addEventListener('change', () => {
        setSetting(key, el.value);

        // Special handlers for settings that need immediate action
        if (key === 'globeStyle') {
          // Click the matching globe style button in the layer controls
          document.querySelector(`[data-style="${el.value}"]`)?.click();
        }
      });
    }
  }

  // Cinematic mode
  document.getElementById('settings-cinematic')?.addEventListener('click', () => {
    panel?.classList.add('hidden');
    document.getElementById('btn-cinematic')?.click();
  });

  // Auth button
  document.getElementById('settings-auth-btn')?.addEventListener('click', () => {
    if (isAuthenticated()) {
      // Sign out
      document.getElementById('btn-logout')?.click();
    } else {
      document.getElementById('btn-signin')?.click();
    }
    panel?.classList.add('hidden');
  });

  // Billing buttons
  document.getElementById('btn-upgrade-monthly')?.addEventListener('click', () => handleUpgrade('monthly'));
  document.getElementById('btn-upgrade-yearly')?.addEventListener('click', () => handleUpgrade('yearly'));
  document.getElementById('btn-manage-billing')?.addEventListener('click', handleManage);

  // Auth state changes
  window.addEventListener('wartrack-auth-change', (e) => {
    const info = document.getElementById('settings-account-info');
    const btn = document.getElementById('settings-auth-btn');
    if (e.detail.user) {
      if (info) info.textContent = `Signed in as ${e.detail.user.username}`;
      if (btn) btn.textContent = 'SIGN OUT';
      loadBillingStatus();
    } else {
      if (info) info.textContent = 'Not signed in';
      if (btn) btn.textContent = 'SIGN IN';
      updateBillingUI({ status: 'free' });
    }
  });

  // Check for billing return params
  const params = new URLSearchParams(window.location.search);
  if (params.get('billing') === 'success') {
    showToast('Subscription activated! Welcome to WarTrack Pro.', 'info');
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
    // Reload billing status after a short delay (webhook may take a moment)
    setTimeout(() => { if (isAuthenticated()) loadBillingStatus(); }, 2000);
  } else if (params.get('billing') === 'cancelled') {
    showToast('Checkout cancelled.', 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }

  applySettings();
}

// Sync UI selects with current settings
function syncUI() {
  const map = {
    'setting-time-format': 'timeFormat',
    'setting-timezone': 'timezone',
    'setting-alt-units': 'altUnits',
    'setting-speed-units': 'speedUnits',
    'setting-scanlines': 'scanlines',
    'setting-max-aircraft': 'maxAircraft',
    'setting-refresh-rate': 'refreshRate',
    'setting-tts': 'tts',
    'setting-auto-briefing': 'autoBriefing',
    'setting-globe-style': 'globeStyle',
    'setting-label-density': 'labelDensity',
  };
  for (const [elemId, key] of Object.entries(map)) {
    const el = document.getElementById(elemId);
    if (el) el.value = settings[key] || DEFAULTS[key];
  }
}
