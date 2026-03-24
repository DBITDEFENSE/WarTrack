// ============================================
// SNAPSHOT STORE — In-memory rolling window for timeline replay
// ============================================

const MAX_SNAPSHOTS = 1440; // 24h at 1-minute intervals
const snapshots = [];

// Replay state
let replayMode = false;
let replayTimestamp = 0;
let playSpeed = 1;
let playing = false;

// ============================================
// SNAPSHOT MANAGEMENT
// ============================================
export function pushSnapshot(snapshot) {
  snapshot.timestamp = snapshot.timestamp || Date.now();
  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
}

export function getSnapshots() {
  return snapshots;
}

export function getSnapshotAt(timestamp) {
  if (snapshots.length === 0) return null;
  // Binary search for nearest snapshot
  let lo = 0, hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].timestamp < timestamp) lo = mid + 1;
    else hi = mid;
  }
  // Return closest
  if (lo > 0) {
    const dPrev = Math.abs(snapshots[lo - 1].timestamp - timestamp);
    const dCurr = Math.abs(snapshots[lo].timestamp - timestamp);
    return dPrev < dCurr ? snapshots[lo - 1] : snapshots[lo];
  }
  return snapshots[lo];
}

export function getSnapshotRange(startTs, endTs) {
  return snapshots.filter(s => s.timestamp >= startTs && s.timestamp <= endTs);
}

export function getLatestSnapshot() {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export function getOldestSnapshot() {
  return snapshots.length > 0 ? snapshots[0] : null;
}

export function getSnapshotCount() {
  return snapshots.length;
}

// ============================================
// REPLAY STATE
// ============================================
export function isReplayMode() {
  return replayMode;
}

export function setReplayMode(active) {
  replayMode = active;
  if (!active) {
    playing = false;
  }
}

export function getReplayTimestamp() {
  return replayTimestamp;
}

export function setReplayTimestamp(ts) {
  replayTimestamp = ts;
}

export function getPlaySpeed() {
  return playSpeed;
}

export function setPlaySpeed(speed) {
  playSpeed = speed;
}

export function isPlaying() {
  return playing;
}

export function setPlaying(v) {
  playing = v;
}
