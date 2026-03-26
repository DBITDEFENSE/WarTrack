// ============================================
// DETAIL PANEL — Entity info slide-in
// Now with tabbed INFO / NEWS views for hotspots
// ============================================

import { fetchNewsForHotspot, getCacheAge, timeAgo, severityColor } from '../layers/news.js';
import { openFeedForHotspot } from './news-feed.js';
import { renderSaveButton, bindSaveButtons } from './favorites.js';
import { renderGroundViewButton, bindGroundViewButtons } from './ground-view.js';
import { apiUrl } from '../config.js';

let panelEl, bodyEl, titleEl, closeBtn;
let activeViewer = null;
let selectedEntity = null; // track currently selected entity for highlight

// Create a glowing "selected" aircraft icon
function createSelectedIcon(color) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <filter id="sel-glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="32" cy="32" r="28" fill="none" stroke="${color}" stroke-width="1" opacity="0.3">
        <animate attributeName="r" from="20" to="28" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.5" to="0.1" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="32" cy="32" r="16" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.2"/>
      <g filter="url(#sel-glow)">
        <path d="M32 12 L36 24 L48 28 L36 32 L34 48 L32 40 L30 48 L28 32 L16 28 L28 24 Z"
              fill="${color}" stroke="${color}" stroke-width="0.5" opacity="0.95"/>
      </g>
      <text x="32" y="58" text-anchor="middle" fill="${color}" font-size="7" font-family="monospace" opacity="0.7">TRACKING</text>
    </svg>
  `)}`;
}

function highlightEntity(entity) {
  // Remove previous highlight
  if (selectedEntity && selectedEntity !== entity) {
    unhighlightEntity(selectedEntity);
  }
  selectedEntity = entity;

  if (entity?.entityType === 'flight' && entity.acData) {
    const color = entity.acData.isMilitary ? '#ff3344' : '#00ddff';
    entity._originalIcon = entity.billboard.image;
    entity._originalWidth = entity.billboard.width;
    entity._originalHeight = entity.billboard.height;
    entity.billboard.image = createSelectedIcon(color);
    entity.billboard.width = 48;
    entity.billboard.height = 48;
    activeViewer?.scene?.requestRender();
  }
}

function unhighlightEntity(entity) {
  if (entity && entity._originalIcon) {
    entity.billboard.image = entity._originalIcon;
    entity.billboard.width = entity._originalWidth;
    entity.billboard.height = entity._originalHeight;
    delete entity._originalIcon;
    delete entity._originalWidth;
    delete entity._originalHeight;
    activeViewer?.scene?.requestRender();
  }
}

export function initDetailPanel(viewer) {
  activeViewer = viewer;
  panelEl = document.getElementById('detail-panel');
  bodyEl = document.getElementById('detail-body');
  titleEl = document.getElementById('detail-title');
  closeBtn = document.getElementById('detail-close');

  closeBtn.addEventListener('click', () => {
    panelEl.classList.add('hidden');
    if (selectedEntity) { unhighlightEntity(selectedEntity); selectedEntity = null; }
  });

  // Click handler on viewer
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id) {
      const entity = picked.id;
      if (entity.entityType === 'flight') {
        showFlightDetail(entity);
      } else if (entity.entityType === 'vessel') {
        showVesselDetail(entity);
      } else if (entity.entityType === 'hotspot') {
        showHotspotDetail(entity, 'info');
      } else if (entity.entityType === 'news-pin') {
        showHotspotDetail(entity, 'news');
      } else if (entity.entityType === 'camera') {
        showCameraDetail(entity);
      } else if (entity.entityType === 'satellite') {
        showSatelliteDetail(entity);
      } else if (entity.entityType === 'planet') {
        showPlanetDetail(entity);
      } else if (entity.entityType === 'jammingCell') {
        showJammingCellDetail(entity);
      } else if (entity.entityType === 'social-content') {
        showSocialContentDetail(entity);
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ============================================
// FLIGHT DETAIL
// ============================================
function showFlightDetail(entity) {
  const ac = entity.acData;
  if (!ac) return;

  // Highlight the selected aircraft with a glowing icon
  highlightEntity(entity);

  // Gentle camera pan — zoom to a comfortable viewing distance
  // Keep the current heading/orientation so the user isn't disoriented
  if (activeViewer && ac.latitude && ac.longitude) {
    // Determine zoom level: if already zoomed in close, just pan. If far out, zoom in gently.
    const currentAlt = activeViewer.camera.positionCartographic.height;
    const targetAlt = Math.max(currentAlt * 0.5, 500000); // zoom to half current or 500km min
    const clampedAlt = Math.min(targetAlt, 3000000); // don't zoom out past 3000km

    activeViewer.scene.requestRenderMode = false;
    activeViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(ac.longitude, ac.latitude, clampedAlt),
      duration: 1.0,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      complete: () => { activeViewer.scene.requestRenderMode = true; },
      cancel: () => { activeViewer.scene.requestRenderMode = true; },
    });
  }

  titleEl.textContent = '◈ AIRCRAFT DETAIL';
  const isMil = ac.isMilitary;

  const nation = ac.nation || {};
  const flag = nation.flag || '🏳️';
  const iconClass = ac.iconClass || 'generic';
  const iconLabel = iconClass.toUpperCase().replace('_', ' ');
  const typeName = ac.typeInfo?.name || null;

  bodyEl.innerHTML = `
    <div class="detail-callsign ${isMil ? 'military' : ''}">${flag} ${ac.callsign}</div>
    <div class="detail-badges">
      <span class="detail-type-badge ${isMil ? 'mil' : 'civ'}">${isMil ? '★ MILITARY' : 'CIVILIAN'}</span>
      <span class="detail-type-badge icon-badge">${iconLabel}</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">IDENTIFICATION</div>
      <div class="detail-row"><span class="detail-key">ICAO HEX</span><span class="detail-val">${ac.icao24}</span></div>
      <div class="detail-row"><span class="detail-key">CALLSIGN</span><span class="detail-val">${ac.callsign}</span></div>
      <div class="detail-row"><span class="detail-key">NATION</span><span class="detail-val">${flag} ${nation.name || ac.origin}</span></div>
      <div class="detail-row"><span class="detail-key">ORIGIN</span><span class="detail-val">${ac.origin}</span></div>
      <div class="detail-row"><span class="detail-key">SQUAWK</span><span class="detail-val">${ac.squawk}</span></div>
      <div class="detail-row"><span class="detail-key">CLASS</span><span class="detail-val ${isMil ? 'military' : 'civilian'}">${iconLabel}</span></div>
      ${typeName ? `<div class="detail-row"><span class="detail-key">TYPE</span><span class="detail-val">${typeName}</span></div>` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">TELEMETRY</div>
      <div class="detail-row"><span class="detail-key">ALTITUDE</span><span class="detail-val">${ac.altitude ? Math.round(ac.altitude * 3.281).toLocaleString() + ' FT' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">SPEED</span><span class="detail-val">${ac.velocity ? Math.round(ac.velocity * 1.944) + ' KTS' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">HEADING</span><span class="detail-val">${ac.heading ? Math.round(ac.heading) + '°' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">VERT RATE</span><span class="detail-val">${ac.verticalRate ? Math.round(ac.verticalRate * 196.85) + ' FPM' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">POSITION</span><span class="detail-val">${ac.latitude?.toFixed(4)}°, ${ac.longitude?.toFixed(4)}°</span></div>
    </div>

    <div id="flight-insight-container"></div>

    ${renderSaveButton('flight', ac.icao24, { callsign: ac.callsign, name: ac.callsign, subtitle: isMil ? 'MILITARY' : 'CIVILIAN' })}
    ${ac.latitude && ac.longitude ? renderGroundViewButton(ac.latitude, ac.longitude, ac.callsign) : ''}
  `;

  panelEl.classList.remove('hidden');
  bindSaveButtons(bodyEl);
  bindGroundViewButtons(bodyEl);

  // Lazy-load AI insight
  loadEntityInsight('flight-insight-container', 'flight', {
    id: ac.icao24, callsign: ac.callsign, origin: ac.origin,
    isMilitary: ac.isMilitary, iconClass: ac.iconClass, altitude: ac.altitude,
    nation: ac.nation,
  });
}

// ============================================
// VESSEL DETAIL
// ============================================
function showVesselDetail(entity) {
  const v = entity.vesselData;
  const cls = entity.vesselClass;
  if (!v) return;

  titleEl.textContent = '◈ VESSEL DETAIL';

  bodyEl.innerHTML = `
    <div class="detail-callsign">${v.name || 'UNKNOWN VESSEL'}</div>
    <div class="detail-type-badge vessel">${cls?.label || 'VESSEL'}</div>

    <div class="detail-section">
      <div class="detail-section-title">IDENTIFICATION</div>
      <div class="detail-row"><span class="detail-key">MMSI</span><span class="detail-val">${v.mmsi || '--'}</span></div>
      <div class="detail-row"><span class="detail-key">NAME</span><span class="detail-val">${v.name || '--'}</span></div>
      <div class="detail-row"><span class="detail-key">FLAG</span><span class="detail-val">${v.flag || '--'}</span></div>
      <div class="detail-row"><span class="detail-key">DESTINATION</span><span class="detail-val">${v.destination || '--'}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">NAVIGATION</div>
      <div class="detail-row"><span class="detail-key">SPEED</span><span class="detail-val">${v.speed ? v.speed.toFixed(1) + ' KTS' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">HEADING</span><span class="detail-val">${v.heading ? Math.round(v.heading) + '°' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">COG</span><span class="detail-val">${v.cog ? Math.round(v.cog) + '°' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">POSITION</span><span class="detail-val">${v.lat?.toFixed(4)}°, ${v.lon?.toFixed(4)}°</span></div>
    </div>

    <div id="vessel-insight-container"></div>

    ${renderSaveButton('vessel', v.mmsi || v.name, { name: v.name || 'Unknown', subtitle: cls?.label || 'VESSEL' })}
    ${v.lat && v.lon ? renderGroundViewButton(v.lat, v.lon, v.name || 'Vessel') : ''}
  `;

  panelEl.classList.remove('hidden');
  bindSaveButtons(bodyEl);
  bindGroundViewButtons(bodyEl);

  loadEntityInsight('vessel-insight-container', 'vessel', {
    id: v.mmsi, name: v.name, flag: v.flag, destination: v.destination,
    shipType: v.shipType, speed: v.speed,
  });
}

// ============================================
// HOTSPOT DETAIL — with INFO / NEWS tabs
// ============================================
let currentHotspot = null;

async function showHotspotDetail(entity, activeTab = 'info') {
  const hs = entity.hotspotData;
  if (!hs) return;
  currentHotspot = hs;

  titleEl.textContent = '◈ HOTSPOT DETAIL';

  const sColor = severityColor(hs.severity);

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color: ${sColor}">${hs.name.toUpperCase()}</div>
    <div class="detail-type-badge hotspot">${hs.severity.toUpperCase()} SEVERITY</div>

    <div class="detail-tabs">
      <button class="detail-tab ${activeTab === 'info' ? 'active' : ''}" data-tab="info">INFO</button>
      <button class="detail-tab ${activeTab === 'news' ? 'active' : ''}" data-tab="news">NEWS ▸</button>
      <button class="detail-tab ${activeTab === 'nexus' ? 'active' : ''}" data-tab="nexus">◆ NEXUS</button>
    </div>

    <div id="detail-tab-content"></div>
  `;

  // Tab click handlers
  bodyEl.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      bodyEl.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'info') {
        renderInfoTab(hs, sColor);
      } else if (tab.dataset.tab === 'news') {
        renderNewsTab(hs, sColor);
      } else if (tab.dataset.tab === 'nexus') {
        renderNexusTab(hs, sColor);
      }
    });
  });

  panelEl.classList.remove('hidden');

  // Render initial tab
  if (activeTab === 'news') {
    renderNewsTab(hs, sColor);
  } else if (activeTab === 'nexus') {
    renderNexusTab(hs, sColor);
  } else {
    renderInfoTab(hs, sColor);
  }
}

function renderInfoTab(hs, sColor) {
  const container = document.getElementById('detail-tab-content');
  if (!container) return;

  container.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">SITUATION</div>
      <div class="detail-row"><span class="detail-key">STATUS</span><span class="detail-val" style="color:${sColor}">${hs.summary}</span></div>
      <div class="detail-row"><span class="detail-key">POSITION</span><span class="detail-val">${hs.lat.toFixed(2)}°, ${hs.lon.toFixed(2)}°</span></div>
      <div class="detail-row"><span class="detail-key">SEVERITY</span><span class="detail-val" style="color:${sColor}">${hs.severity.toUpperCase()}</span></div>
      ${hs.searchQuery ? `<div class="detail-row"><span class="detail-key">INTEL QUERY</span><span class="detail-val" style="font-size:10px">${hs.searchQuery}</span></div>` : ''}
    </div>

    ${renderSaveButton('hotspot', hs.name, { name: hs.name, subtitle: hs.severity.toUpperCase() + ' SEVERITY' })}
    ${renderGroundViewButton(hs.lat, hs.lon, hs.name, { severity: hs.severity })}

    <button class="detail-btn-newsfeed" id="btn-open-feed">VIEW ALL NEWS FOR THIS REGION →</button>
  `;

  bindSaveButtons(container);
  bindGroundViewButtons(container);
  document.getElementById('btn-open-feed')?.addEventListener('click', () => {
    openFeedForHotspot(hs);
  });
}

async function renderNewsTab(hs, sColor) {
  const container = document.getElementById('detail-tab-content');
  if (!container) return;

  container.innerHTML = '<div class="news-loading">Fetching headlines...</div>';

  const articles = await fetchNewsForHotspot(hs);
  const cacheAge = getCacheAge(hs.name);
  const cacheLabel = cacheAge ? `CACHED · ${Math.floor(cacheAge / 60000)}min ago` : '';

  if (articles.length === 0) {
    container.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">◈ HEADLINES</div>
        <div class="news-empty">No headlines available.<br>Set GNEWS_API_KEY for live news.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">◈ HEADLINES ${cacheLabel ? `<span class="news-cache-label-inline">${cacheLabel}</span>` : ''}</div>
      ${articles.map(a => {
        const stateWarn = a.isStateAdjacent
          ? '<span class="news-state-warning" title="State-adjacent media">⚠</span> '
          : '';
        return `
          <div class="detail-news-card">
            <a class="detail-news-title" href="${a.url || '#'}" target="_blank" rel="noopener">
              ${escapeHtml(truncate(a.title || 'Untitled', 80))}
            </a>
            <div class="detail-news-meta">
              ${stateWarn}<span class="detail-news-source ${a.isStateAdjacent ? 'state-adjacent' : ''}">${escapeHtml(a.source?.name || 'Unknown')}</span>
              <span class="detail-news-time">${timeAgo(a.publishedAt)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <button class="detail-btn-newsfeed" id="btn-open-feed">VIEW ALL NEWS →</button>
  `;

  document.getElementById('btn-open-feed')?.addEventListener('click', () => {
    openFeedForHotspot(hs);
  });
}

// ============================================
// SATELLITE DETAIL
// ============================================
function showSatelliteDetail(entity) {
  const sat = entity.satData;
  if (!sat) return;

  titleEl.textContent = '◈ SATELLITE DETAIL';

  const catColors = {
    ISS: '#00ff88', MILITARY: '#ff3344', GPS: '#4488ff',
    WEATHER: '#00ccdd', STARLINK: '#aaaacc', OTHER: '#666688'
  };
  const color = catColors[sat.category] || '#666688';

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color:${color}">${sat.name}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${color}22;border:1px solid ${color}66;color:${color}">🛰 ${sat.category}</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">IDENTIFICATION</div>
      <div class="detail-row"><span class="detail-key">NORAD ID</span><span class="detail-val">${sat.noradId}</span></div>
      <div class="detail-row"><span class="detail-key">NAME</span><span class="detail-val">${sat.name}</span></div>
      <div class="detail-row"><span class="detail-key">CATEGORY</span><span class="detail-val" style="color:${color}">${sat.category}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">ORBITAL DATA</div>
      <div class="detail-row"><span class="detail-key">ALTITUDE</span><span class="detail-val">${sat.altitude ? Math.round(sat.altitude / 1000).toLocaleString() + ' KM' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">VELOCITY</span><span class="detail-val">${sat.velocity ? (sat.velocity).toFixed(1) + ' KM/S' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">POSITION</span><span class="detail-val">${sat.latitude?.toFixed(4)}°, ${sat.longitude?.toFixed(4)}°</span></div>
    </div>

    ${renderSaveButton('satellite', sat.noradId, { name: sat.name, subtitle: sat.category })}
  `;

  panelEl.classList.remove('hidden');
  bindSaveButtons(bodyEl);
}

// ============================================
// PLANET DETAIL
// ============================================
function showPlanetDetail(entity) {
  const p = entity.planetData;
  if (!p) return;

  titleEl.textContent = '◈ PLANETARY INTELLIGENCE';

  const typeLabel = p.isSun ? '☀ STAR' : p.isMoon ? '🌙 MOON' : '🪐 PLANET';

  // Mission status colors
  const statusColors = {
    ACTIVE: '#00ff88', COMPLETED: '#667788', 'EN ROUTE': '#00ddff',
    PLANNED: '#ffaa00', HIBERNATING: '#ff8800', PROPOSED: '#888899',
  };

  const missionsHtml = (p.missions || []).map(m => {
    const sc = statusColors[m.status] || '#888';
    return `
      <div class="planet-mission-card">
        <div class="planet-mission-header">
          <span class="planet-mission-name">${escapeHtml(m.name)}</span>
          <span class="planet-mission-status" style="color:${sc}">${m.status}</span>
        </div>
        <div class="planet-mission-meta">
          <span>${m.agency}</span> · <span>${m.type}</span> · <span>${m.year}</span>
        </div>
        <div class="planet-mission-desc">${escapeHtml(m.desc)}</div>
      </div>
    `;
  }).join('');

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color:${p.color}">${p.name.toUpperCase()}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${p.color}22;border:1px solid ${p.color}66;color:${p.color}">${typeLabel}</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">PHYSICAL DATA</div>
      <div class="detail-row"><span class="detail-key">RADIUS</span><span class="detail-val">${p.radiusKm?.toLocaleString()} KM</span></div>
      <div class="detail-row"><span class="detail-key">DISTANCE</span><span class="detail-val">${p.distanceLabel}</span></div>
      ${p.massKg ? `<div class="detail-row"><span class="detail-key">MASS</span><span class="detail-val">${p.massKg}</span></div>` : ''}
      ${p.gravity ? `<div class="detail-row"><span class="detail-key">GRAVITY</span><span class="detail-val">${p.gravity}</span></div>` : ''}
      ${p.tempRange ? `<div class="detail-row"><span class="detail-key">TEMPERATURE</span><span class="detail-val">${p.tempRange}</span></div>` : ''}
      ${p.atmosphere ? `<div class="detail-row"><span class="detail-key">ATMOSPHERE</span><span class="detail-val">${p.atmosphere}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">DAY LENGTH</span><span class="detail-val">${p.dayLength}</span></div>
      <div class="detail-row"><span class="detail-key">YEAR LENGTH</span><span class="detail-val">${p.yearLength}</span></div>
      <div class="detail-row"><span class="detail-key">MOONS</span><span class="detail-val">${p.moons}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">INTEL BRIEF</div>
      <div style="color:#99aabb;font-size:12px;line-height:1.5">${escapeHtml(p.description)}</div>
    </div>

    ${missionsHtml ? `
    <div class="detail-section">
      <div class="detail-section-title">ACTIVE / RECENT MISSIONS (${p.missions?.length || 0})</div>
      ${missionsHtml}
    </div>
    ` : ''}

    ${p.hasRoverPhotos ? `
    <div class="detail-section">
      <div class="detail-section-title">LATEST SURFACE IMAGERY</div>
      <div id="planet-rover-photos" class="planet-rover-loading">Loading rover imagery...</div>
    </div>
    ` : ''}
  `;

  panelEl.classList.remove('hidden');

  // Fetch Mars rover photos if applicable
  if (p.hasRoverPhotos) {
    fetchRoverPhotos();
  }
}

async function fetchRoverPhotos() {
  const container = document.getElementById('planet-rover-photos');
  if (!container) return;

  try {
    const resp = await fetch(apiUrl('/api/nasa?type=mars-rover'));
    if (!resp.ok) throw new Error('NASA API unavailable');
    const data = await resp.json();
    const photos = data.latest_photos || data.photos || [];

    if (photos.length === 0) {
      container.innerHTML = '<div style="color:#556;font-size:10px">No recent imagery available</div>';
      return;
    }

    container.innerHTML = photos.slice(0, 3).map(photo => `
      <div class="planet-rover-card">
        <img src="${photo.img_src}" alt="Mars rover" loading="lazy" onerror="this.style.display='none'" />
        <div class="planet-rover-meta">
          <span>${photo.rover?.name || 'Rover'}</span> · <span>${photo.camera?.full_name || ''}</span>
          <br><span style="color:#556">${photo.earth_date || ''}</span>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div style="color:#556;font-size:10px">Rover imagery unavailable. <a href="https://mars.nasa.gov/msl/multimedia/images/" target="_blank" style="color:#00ddff">View on NASA.gov</a></div>';
  }
}

// ============================================
// GPS JAMMING CELL DETAIL
// ============================================
function showJammingCellDetail(entity) {
  const data = entity.hexData;
  if (!data) return;

  titleEl.textContent = '◈ GPS INTERFERENCE CELL';

  const sevColors = { normal: '#00ff88', low: '#ffdd44', moderate: '#ffaa00', high: '#ff3344' };
  const color = sevColors[data.severity] || '#ffdd44';
  const sevLabel = (data.severity || 'unknown').toUpperCase();

  const aircraftList = (data.aircraft || []).slice(0, 8).map(ac => `
    <div class="detail-row">
      <span class="detail-key">${ac.icao24 || '?'}</span>
      <span class="detail-val" style="color:${color}">${ac.indicators?.join(', ') || 'scored'} (${(ac.score * 100).toFixed(0)}%)</span>
    </div>
  `).join('');

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color:${color}">GPS ANOMALY — ${sevLabel}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${color}22;border:1px solid ${color}66;color:${color}">📡 ${sevLabel} INTERFERENCE</span>
      <span class="detail-type-badge icon-badge">INFERRED</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">CELL STATISTICS</div>
      <div class="detail-row"><span class="detail-key">AIRCRAFT IN CELL</span><span class="detail-val">${data.count || 0}</span></div>
      <div class="detail-row"><span class="detail-key">AVG ANOMALY SCORE</span><span class="detail-val" style="color:${color}">${data.avgScore ? (data.avgScore * 100).toFixed(0) + '%' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">MAX SCORE</span><span class="detail-val" style="color:${color}">${data.maxScore ? (data.maxScore * 100).toFixed(0) + '%' : '--'}</span></div>
      <div class="detail-row"><span class="detail-key">SEVERITY</span><span class="detail-val" style="color:${color}">${sevLabel}</span></div>
    </div>

    ${aircraftList ? `
    <div class="detail-section">
      <div class="detail-section-title">AFFECTED AIRCRAFT</div>
      ${aircraftList}
    </div>
    ` : ''}

    <div class="detail-section">
      <div class="detail-section-title" style="color:#667">⚠ DISCLAIMER</div>
      <div style="color:#556;font-size:10px;line-height:1.5">
        This is an inferred assessment based on ADS-B telemetry anomalies (altitude divergence, position jumps). It does not confirm active GPS jamming. Multiple factors can cause similar signatures.
      </div>
    </div>
  `;

  panelEl.classList.remove('hidden');
}

// ============================================
// SOCIAL CONTENT DETAIL
// ============================================
function showSocialContentDetail(entity) {
  const item = entity.contentData;
  if (!item) return;

  titleEl.textContent = '◈ SOCIAL CONTENT';

  const typeIcons = { video: '▶', post: '✦', camera: '◉', article: '◈' };
  const typeColors = { video: '#ff4444', post: '#3399ff', camera: '#00cc88', article: '#ffaa00' };
  const color = typeColors[item.type] || '#ffaa00';
  const icon = typeIcons[item.type] || '◈';

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color:${color};font-size:18px">${icon} ${escapeHtml(truncate(item.title || 'Untitled', 60))}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${color}22;border:1px solid ${color}66;color:${color}">${item.source?.toUpperCase()}</span>
      <span class="detail-type-badge icon-badge">${item.type?.toUpperCase()}</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">CONTENT</div>
      ${item.author ? `<div class="detail-row"><span class="detail-key">AUTHOR</span><span class="detail-val">${escapeHtml(item.author)}</span></div>` : ''}
      ${item.subreddit ? `<div class="detail-row"><span class="detail-key">SUBREDDIT</span><span class="detail-val">r/${escapeHtml(item.subreddit)}</span></div>` : ''}
      ${item.timestamp ? `<div class="detail-row"><span class="detail-key">POSTED</span><span class="detail-val">${timeAgo(item.timestamp)}</span></div>` : ''}
      ${item.score ? `<div class="detail-row"><span class="detail-key">SCORE</span><span class="detail-val">${item.score}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">REGION</span><span class="detail-val">${escapeHtml(item.region || entity.contentRegion || '--')}</span></div>
    </div>

    ${item.text ? `<div class="detail-section"><div style="color:#99aabb;font-size:11px;line-height:1.5">${escapeHtml(truncate(item.text, 200))}</div></div>` : ''}

    ${item.thumbnail ? `<div style="margin:8px 0"><img src="${item.thumbnail}" style="width:100%;border-radius:4px;border:1px solid rgba(0,255,136,0.15)" onerror="this.style.display='none'" /></div>` : ''}

    <a href="${item.url}" target="_blank" rel="noopener" style="display:block;width:100%;padding:8px;text-align:center;background:${color}15;border:1px solid ${color}44;color:${color};font-family:var(--font-mono);font-size:11px;letter-spacing:2px;text-decoration:none;border-radius:3px;margin-top:8px">OPEN SOURCE →</a>

    <div class="detail-section" style="margin-top:12px">
      <div style="color:#445;font-size:9px;line-height:1.4">
        ⚠ Public content — unverified. Source: ${escapeHtml(item.source || 'Unknown')}. WarTrack does not endorse or verify social content accuracy.
      </div>
    </div>
  `;

  panelEl.classList.remove('hidden');
}

// ============================================
// NEXUS AI TAB — Hotspot analysis
// ============================================
const nexusCache = new Map(); // cache per hotspot

async function renderNexusTab(hs, sColor) {
  const container = document.getElementById('detail-tab-content');
  if (!container) return;

  // Check cache
  const cached = nexusCache.get(hs.name);
  if (cached && Date.now() - cached.ts < 600000) { // 10 min cache
    container.innerHTML = formatNexusAnalysis(cached.data, sColor);
    return;
  }

  container.innerHTML = '<div class="nexus-loading">◆ NEXUS is analyzing this region...</div>';

  try {
    // Fetch recent news for this hotspot
    const articles = await fetchNewsForHotspot(hs);
    const articleContext = articles.slice(0, 5).map(a => `- ${a.title} (${a.source?.name || 'Unknown'})`).join('\n');

    const resp = await fetch(apiUrl('/api/analysis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region: hs.name,
        severity: hs.severity,
        summary: hs.summary,
        articles: articleContext,
      })
    });

    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();

    if (data.error) {
      container.innerHTML = `<div class="nexus-offline">◆ NEXUS: ${escapeHtml(data.analysis || data.message || 'Analysis unavailable')}</div>`;
      return;
    }

    nexusCache.set(hs.name, { data, ts: Date.now() });
    container.innerHTML = formatNexusAnalysis(data, sColor);
  } catch (err) {
    container.innerHTML = `<div class="nexus-offline">◆ NEXUS analysis unavailable<br><span style="color:#556;font-size:10px">${escapeHtml(err.message)}</span></div>`;
  }
}

function formatNexusAnalysis(data, sColor) {
  return `
    <div class="nexus-analysis">
      <div class="nexus-header">◆ NEXUS ASSESSMENT</div>
      <div class="nexus-text">${escapeHtml(data.analysis || 'No analysis available.')}</div>
      ${data.threatLevel ? `
        <div class="nexus-threat">
          <span class="nexus-threat-label">THREAT ASSESSMENT:</span>
          <span style="color:${sColor}">${escapeHtml(data.threatLevel)}</span>
        </div>
      ` : ''}
      ${data.recommendation ? `
        <div class="nexus-rec">
          <span class="nexus-rec-label">RECOMMENDATION:</span>
          <span>${escapeHtml(data.recommendation)}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================
// CAMERA DETAIL
// ============================================
function showCameraDetail(entity) {
  const cam = entity.cameraData;
  if (!cam) return;

  titleEl.textContent = '◈ CAMERA DETAIL';

  const catColors = {
    traffic: '#ffaa00', airport: '#00ddff', harbor: '#0088ff',
    city: '#00ff88', landscape: '#88cc44', beach: '#44ddcc', other: '#888899'
  };
  const color = catColors[cam.category] || '#888899';
  const locationParts = [cam.city, cam.region, cam.country].filter(Boolean);

  bodyEl.innerHTML = `
    <div class="detail-callsign" style="color:${color}">${escapeHtml(cam.title)}</div>
    <div class="detail-badges">
      <span class="detail-type-badge" style="background:${color}22;border:1px solid ${color}66;color:${color}">📷 ${cam.categoryLabel}</span>
      ${cam.status === 'active' ? '<span class="detail-type-badge" style="background:#00ff8822;border:1px solid #00ff8866;color:#00ff88">LIVE</span>' : ''}
    </div>

    ${cam.thumbnailUrl ? `
      <div class="camera-preview">
        <img src="${cam.thumbnailUrl}" alt="Camera preview" onerror="this.style.display='none'" />
      </div>
    ` : ''}

    <div class="detail-section">
      <div class="detail-section-title">LOCATION</div>
      ${locationParts.length ? `<div class="detail-row"><span class="detail-key">PLACE</span><span class="detail-val">${escapeHtml(locationParts.join(', '))}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">POSITION</span><span class="detail-val">${cam.lat?.toFixed(4)}°, ${cam.lon?.toFixed(4)}°</span></div>
      <div class="detail-row"><span class="detail-key">TYPE</span><span class="detail-val" style="color:${color}">${cam.categoryLabel}</span></div>
      ${cam.lastUpdated ? `<div class="detail-row"><span class="detail-key">UPDATED</span><span class="detail-val">${new Date(cam.lastUpdated * 1000).toLocaleString()}</span></div>` : ''}
      ${cam.viewCount ? `<div class="detail-row"><span class="detail-key">VIEWS</span><span class="detail-val">${cam.viewCount.toLocaleString()}</span></div>` : ''}
    </div>

    ${cam.sourceUrl ? `
      <a href="${cam.sourceUrl}" target="_blank" rel="noopener" class="camera-source-btn">OPEN SOURCE FEED →</a>
    ` : ''}

    ${renderSaveButton('camera', cam.id, { name: cam.title, subtitle: cam.categoryLabel })}
  `;

  panelEl.classList.remove('hidden');
  bindSaveButtons(bodyEl);
}

// ============================================
// REUSABLE: "WHY THIS MATTERS" AI INSIGHT LOADER
// ============================================
async function loadEntityInsight(containerId, entityType, entityData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="nexus-loading">◆ NEXUS analyzing...</div>';

  try {
    const resp = await fetch(apiUrl('/api/entity-insight'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityData })
    });
    const data = await resp.json();

    if (data.error && !data.insight) {
      container.innerHTML = `<div class="nexus-offline">◆ ${escapeHtml(data.insight || 'Assessment unavailable')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="nexus-analysis">
        <div class="nexus-header">◆ WHY THIS MATTERS</div>
        <div class="nexus-text">${escapeHtml(data.insight || 'No assessment available.')}</div>
        ${data.actors ? `<div class="nexus-threat"><span class="nexus-threat-label">ACTORS</span><span>${escapeHtml(data.actors)}</span></div>` : ''}
        ${data.implications ? `<div class="nexus-rec"><span class="nexus-rec-label">IMPLICATIONS</span><span>${escapeHtml(data.implications)}</span></div>` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="nexus-offline">◆ Analysis unavailable</div>`;
  }
}

// ============================================
// HELPERS
// ============================================
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
