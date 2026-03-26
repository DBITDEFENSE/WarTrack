// ============================================
// CLOCK — Timezone-aware time display
// Respects user's timezone setting from settings panel
// ============================================

import { getSetting } from './settings.js';

let currentTimezone = 'UTC';

export function startClock() {
  const dateEl = document.getElementById('utc-date');
  const timeEl = document.getElementById('utc-time');
  const labelEl = document.querySelector('.clock-label');

  // Listen for settings changes
  window.addEventListener('wartrack-settings-changed', (e) => {
    const tz = e.detail?.timezone || 'UTC';
    if (tz !== currentTimezone) {
      currentTimezone = tz;
      updateLabel();
    }
  });

  // Read initial setting
  try {
    currentTimezone = getSetting('timezone') || 'UTC';
  } catch { currentTimezone = 'UTC'; }

  function updateLabel() {
    if (!labelEl) return;
    if (currentTimezone === 'UTC') {
      labelEl.textContent = 'ZULU';
    } else if (currentTimezone === 'local') {
      const offset = new Date().getTimezoneOffset();
      const h = Math.abs(Math.floor(offset / 60));
      const sign = offset <= 0 ? '+' : '-';
      labelEl.textContent = `UTC${sign}${h}`;
    } else {
      // Show short timezone abbreviation
      try {
        const abbr = new Intl.DateTimeFormat('en-US', { timeZone: currentTimezone, timeZoneName: 'short' })
          .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || currentTimezone;
        labelEl.textContent = abbr;
      } catch {
        labelEl.textContent = currentTimezone.split('/').pop();
      }
    }
  }

  function update() {
    const now = new Date();
    let tz = currentTimezone;
    if (tz === 'local') tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const dateFmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const timeFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });

      if (dateEl) dateEl.textContent = dateFmt.format(now);
      if (timeEl) timeEl.textContent = timeFmt.format(now);
    } catch {
      // Fallback to UTC
      if (dateEl) dateEl.textContent = now.toISOString().slice(0, 10);
      if (timeEl) timeEl.textContent = now.toISOString().slice(11, 19);
    }
  }

  updateLabel();
  update();
  setInterval(update, 1000);
}
