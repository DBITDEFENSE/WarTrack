// ============================================
// FAVORITES UI — Save/unsave entities, panel
// ============================================

import { isAuthenticated, getAuthHeaders } from './auth.js';
import { apiUrl } from '../config.js';

let favorites = [];
let panelEl, bodyEl;

// ============================================
// INIT
// ============================================
export function initFavorites() {
  panelEl = document.getElementById('favorites-panel');
  bodyEl = document.getElementById('favorites-body');

  const openBtn = document.getElementById('btn-favorites');
  const closeBtn = document.getElementById('favorites-close');

  openBtn?.addEventListener('click', () => {
    panelEl.classList.toggle('hidden');
    if (!panelEl.classList.contains('hidden')) {
      loadFavorites();
    }
  });

  closeBtn?.addEventListener('click', () => {
    panelEl.classList.add('hidden');
  });

  // Listen for auth changes
  window.addEventListener('wartrack-auth-change', (e) => {
    if (e.detail.user) {
      loadFavorites();
    } else {
      favorites = [];
      renderPanel();
    }
  });

  // Initial load if authenticated
  if (isAuthenticated()) {
    loadFavorites();
  }
}

// ============================================
// API CALLS
// ============================================
async function loadFavorites() {
  if (!isAuthenticated()) {
    favorites = [];
    renderPanel();
    return;
  }

  try {
    const resp = await fetch(apiUrl('/api/favorites'), { headers: getAuthHeaders() });
    if (resp.ok) {
      const data = await resp.json();
      favorites = data.favorites || [];
    }
  } catch { /* ignore */ }
  renderPanel();
}

export async function addFavorite(entityType, entityId, metadata) {
  if (!isAuthenticated()) return null;

  try {
    const resp = await fetch(apiUrl('/api/favorites'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, metadata })
    });
    if (resp.ok) {
      const data = await resp.json();
      favorites.push(data.favorite);
      renderPanel();
      return data.favorite;
    }
  } catch { /* ignore */ }
  return null;
}

export async function removeFavorite(favoriteId) {
  if (!isAuthenticated()) return;

  try {
    const resp = await fetch(apiUrl(`/api/favorites/${favoriteId}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (resp.ok) {
      favorites = favorites.filter(f => f.id !== favoriteId);
      renderPanel();
    }
  } catch { /* ignore */ }
}

export function isFavorited(entityType, entityId) {
  return favorites.find(f => f.entity_type === entityType && f.entity_id === entityId) || null;
}

// ============================================
// RENDER PANEL
// ============================================
function renderPanel() {
  if (!bodyEl) return;

  if (!isAuthenticated()) {
    bodyEl.innerHTML = '<div class="fav-empty">Sign in to save items</div>';
    return;
  }

  if (favorites.length === 0) {
    bodyEl.innerHTML = '<div class="fav-empty">No saved items yet.<br>Click ★ on any entity to save it.</div>';
    return;
  }

  const typeIcons = {
    flight: '✈', vessel: '⚓', hotspot: '⚠', news: '📰'
  };
  const typeColors = {
    flight: '#00ddff', vessel: '#0088ff', hotspot: '#ff3344', news: '#ffaa00'
  };

  bodyEl.innerHTML = favorites.map(f => {
    const meta = f.metadata || {};
    const icon = typeIcons[f.entity_type] || '●';
    const color = typeColors[f.entity_type] || '#888';
    const title = meta.name || meta.callsign || meta.title || f.entity_id;
    const subtitle = meta.subtitle || f.entity_type.toUpperCase();

    return `
      <div class="fav-card" data-id="${f.id}" data-type="${f.entity_type}" data-entity-id="${f.entity_id}">
        <div class="fav-icon" style="color: ${color}">${icon}</div>
        <div class="fav-info">
          <div class="fav-title">${escapeHtml(title)}</div>
          <div class="fav-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <button class="fav-remove" data-fav-id="${f.id}" title="Remove">✕</button>
      </div>
    `;
  }).join('');

  // Bind remove buttons
  bodyEl.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.favId);
      removeFavorite(id);
    });
  });
}

// ============================================
// SAVE BUTTON HELPER — generates HTML for detail panels
// ============================================
export function renderSaveButton(entityType, entityId, metadata) {
  const existing = isFavorited(entityType, entityId);
  const saved = !!existing;

  return `
    <button class="detail-btn-save ${saved ? 'saved' : ''}"
            data-entity-type="${entityType}"
            data-entity-id="${escapeHtml(entityId)}"
            data-fav-id="${existing ? existing.id : ''}"
            data-metadata='${escapeHtml(JSON.stringify(metadata || {}))}'>
      ${saved ? '★ SAVED' : '☆ SAVE'}
    </button>
  `;
}

export function bindSaveButtons(container) {
  container.querySelectorAll('.detail-btn-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isAuthenticated()) {
        // Trigger sign in modal
        document.getElementById('btn-signin')?.click();
        return;
      }

      const type = btn.dataset.entityType;
      const id = btn.dataset.entityId;
      const favId = btn.dataset.favId;

      if (favId) {
        // Remove
        await removeFavorite(parseInt(favId));
        btn.classList.remove('saved');
        btn.textContent = '☆ SAVE';
        btn.dataset.favId = '';
      } else {
        // Add
        let metadata;
        try { metadata = JSON.parse(btn.dataset.metadata); } catch { metadata = {}; }
        const fav = await addFavorite(type, id, metadata);
        if (fav) {
          btn.classList.add('saved');
          btn.textContent = '★ SAVED';
          btn.dataset.favId = fav.id;
        }
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
