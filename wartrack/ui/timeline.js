// ============================================
// TIMELINE — Time scrubber + replay controls
// ============================================

import {
  getSnapshots, getSnapshotAt, getLatestSnapshot, getOldestSnapshot,
  isReplayMode, setReplayMode, getReplayTimestamp, setReplayTimestamp,
  getPlaySpeed, setPlaySpeed, isPlaying, setPlaying, getSnapshotCount
} from '../data/snapshot-store.js';
import { emit } from '../event-bus.js';

let viewer = null;
let barEl = null;
let sliderEl = null;
let timeDisplay = null;
let playBtn = null;
let liveBtn = null;
let speedBtn = null;
let animFrameId = null;
let lastFrameTime = 0;

const SPEEDS = [1, 5, 10, 30, 60];
let speedIndex = 0;

// ============================================
// INIT
// ============================================
export function initTimeline(v) {
  viewer = v;
  barEl = document.getElementById('timeline-bar');
  if (!barEl) return;

  barEl.innerHTML = `
    <div class="tl-controls">
      <div class="tl-range-btns">
        <button class="tl-btn tl-range-btn" data-range="3600000">1H</button>
        <button class="tl-btn tl-range-btn" data-range="21600000">6H</button>
        <button class="tl-btn tl-range-btn active" data-range="86400000">24H</button>
      </div>
      <div class="tl-transport">
        <button class="tl-btn" id="tl-step-back" title="Step back">◀◀</button>
        <button class="tl-btn tl-play-btn" id="tl-play" title="Play/Pause">▶</button>
        <button class="tl-btn" id="tl-step-fwd" title="Step forward">▶▶</button>
      </div>
      <button class="tl-btn tl-speed-btn" id="tl-speed" title="Playback speed">1×</button>
      <div class="tl-slider-wrap">
        <input type="range" id="tl-slider" class="tl-slider" min="0" max="100" value="100" />
      </div>
      <span class="tl-time" id="tl-time">LIVE</span>
      <button class="tl-btn tl-live-btn" id="tl-live" title="Return to live">LIVE</button>
    </div>
  `;

  sliderEl = document.getElementById('tl-slider');
  timeDisplay = document.getElementById('tl-time');
  playBtn = document.getElementById('tl-play');
  liveBtn = document.getElementById('tl-live');
  speedBtn = document.getElementById('tl-speed');

  // Range buttons
  barEl.querySelectorAll('.tl-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      barEl.querySelectorAll('.tl-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = parseInt(btn.dataset.range);
      enterReplayForRange(range);
    });
  });

  // Transport controls
  playBtn.addEventListener('click', togglePlay);
  document.getElementById('tl-step-back')?.addEventListener('click', () => stepReplay(-60000));
  document.getElementById('tl-step-fwd')?.addEventListener('click', () => stepReplay(60000));

  // Speed button
  speedBtn.addEventListener('click', cycleSpeed);

  // Slider
  sliderEl.addEventListener('input', onSliderInput);

  // Live button
  liveBtn.addEventListener('click', returnToLive);

  // Update slider range periodically
  setInterval(updateSliderRange, 5000);
}

// ============================================
// SHOW / HIDE
// ============================================
export function showTimeline() {
  if (barEl) barEl.classList.remove('hidden');
}

export function hideTimeline() {
  if (barEl) barEl.classList.add('hidden');
}

export function isTimelineVisible() {
  return barEl && !barEl.classList.contains('hidden');
}

// ============================================
// REPLAY CONTROLS
// ============================================
function enterReplayForRange(rangeMs) {
  const now = Date.now();
  const startTs = now - rangeMs;
  setReplayMode(true);
  setReplayTimestamp(startTs);
  setPlaying(true);
  updateSliderRange();
  updateUI();
  startPlaybackLoop();
  showTimeline();
}

function togglePlay() {
  if (!isReplayMode()) {
    // Enter replay at latest snapshot
    const latest = getLatestSnapshot();
    if (!latest) return;
    const oldest = getOldestSnapshot();
    setReplayMode(true);
    setReplayTimestamp(oldest?.timestamp || Date.now() - 3600000);
    setPlaying(true);
    startPlaybackLoop();
  } else {
    setPlaying(!isPlaying());
    if (isPlaying()) startPlaybackLoop();
  }
  updateUI();
}

function stepReplay(deltaMs) {
  if (!isReplayMode()) {
    const latest = getLatestSnapshot();
    if (!latest) return;
    setReplayMode(true);
    setReplayTimestamp(latest.timestamp);
  }
  setPlaying(false);
  const newTs = getReplayTimestamp() + deltaMs;
  setReplayTimestamp(Math.max(newTs, getOldestSnapshot()?.timestamp || 0));
  triggerReplayFrame();
  updateUI();
}

function cycleSpeed() {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  setPlaySpeed(SPEEDS[speedIndex]);
  if (speedBtn) speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
}

function returnToLive() {
  setReplayMode(false);
  setPlaying(false);
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
  updateUI();
  // Trigger live refresh
  emit('replay:end');
}

// ============================================
// SLIDER
// ============================================
function onSliderInput() {
  if (!isReplayMode()) {
    setReplayMode(true);
  }
  setPlaying(false);

  const oldest = getOldestSnapshot()?.timestamp || Date.now() - 86400000;
  const newest = getLatestSnapshot()?.timestamp || Date.now();
  const range = newest - oldest;
  const pct = parseInt(sliderEl.value) / 100;
  const ts = oldest + range * pct;

  setReplayTimestamp(ts);
  triggerReplayFrame();
  updateUI();
}

function updateSliderRange() {
  if (isReplayMode() && sliderEl) {
    const oldest = getOldestSnapshot()?.timestamp || Date.now() - 86400000;
    const newest = getLatestSnapshot()?.timestamp || Date.now();
    const range = newest - oldest;
    if (range > 0) {
      const pct = ((getReplayTimestamp() - oldest) / range) * 100;
      sliderEl.value = Math.max(0, Math.min(100, pct));
    }
  }
}

// ============================================
// PLAYBACK LOOP
// ============================================
function startPlaybackLoop() {
  if (animFrameId) return;
  lastFrameTime = performance.now();
  animFrameId = requestAnimationFrame(playbackTick);
}

function playbackTick(now) {
  if (!isPlaying() || !isReplayMode()) {
    animFrameId = null;
    return;
  }

  const delta = now - lastFrameTime;
  lastFrameTime = now;

  const advance = delta * getPlaySpeed();
  const newTs = getReplayTimestamp() + advance;
  const latest = getLatestSnapshot()?.timestamp || Date.now();

  if (newTs >= latest) {
    // Reached end — return to live
    returnToLive();
    return;
  }

  setReplayTimestamp(newTs);
  updateSliderRange();
  updateTimeDisplay();

  // Throttle frame dispatch to every 500ms of real time
  if (!playbackTick._lastDispatch || now - playbackTick._lastDispatch > 500) {
    triggerReplayFrame();
    playbackTick._lastDispatch = now;
  }

  animFrameId = requestAnimationFrame(playbackTick);
}

// ============================================
// FRAME DISPATCH
// ============================================
function triggerReplayFrame() {
  const snapshot = getSnapshotAt(getReplayTimestamp());
  if (!snapshot) return;
  emit('replay:frame', snapshot);
  viewer?.scene?.requestRender();
}

// ============================================
// UI UPDATE
// ============================================
function updateUI() {
  updateTimeDisplay();
  updateSliderRange();

  if (playBtn) {
    playBtn.textContent = isPlaying() ? '❚❚' : '▶';
    playBtn.classList.toggle('active', isPlaying());
  }
  if (liveBtn) {
    liveBtn.classList.toggle('active', !isReplayMode());
  }
}

function updateTimeDisplay() {
  if (!timeDisplay) return;
  if (!isReplayMode()) {
    timeDisplay.textContent = 'LIVE';
    timeDisplay.style.color = '#00ff88';
  } else {
    const d = new Date(getReplayTimestamp());
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    timeDisplay.textContent = `${h}:${m}:${s}Z`;
    timeDisplay.style.color = '#ffaa00';
  }
}
