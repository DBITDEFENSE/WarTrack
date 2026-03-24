// ============================================
// UTC CLOCK — Live Zulu Time Display
// ============================================

export function startClock() {
  const dateEl = document.getElementById('utc-date');
  const timeEl = document.getElementById('utc-time');

  function update() {
    const now = new Date();

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = String(now.getUTCSeconds()).padStart(2, '0');

    dateEl.textContent = `${year}-${month}-${day}`;
    timeEl.textContent = `${hours}:${mins}:${secs}`;
  }

  update();
  setInterval(update, 1000);
}
