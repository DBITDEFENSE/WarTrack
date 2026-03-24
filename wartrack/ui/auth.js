// ============================================
// AUTH UI — Sign In / Sign Up modal, session state
// ============================================

let currentUser = null;
let authToken = null;

// ============================================
// PUBLIC API
// ============================================
export function isAuthenticated() { return !!authToken; }
export function getCurrentUser() { return currentUser; }
export function getAuthToken() { return authToken; }

export function getAuthHeaders() {
  if (!authToken) return {};
  return { 'Authorization': `Bearer ${authToken}` };
}

// ============================================
// INIT — check for saved session
// ============================================
export async function initAuth() {
  const savedToken = localStorage.getItem('wartrack_token');
  if (savedToken) {
    authToken = savedToken;
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        currentUser = data.user;
        updateHUD();
      } else {
        // Token expired/invalid
        logout();
      }
    } catch {
      // Server not reachable — keep token, try again later
    }
  }
  updateHUD();
  bindEvents();
}

// ============================================
// HUD STATE
// ============================================
function updateHUD() {
  const userSection = document.getElementById('hud-user');
  if (!userSection) return;

  if (currentUser) {
    userSection.innerHTML = `
      <span class="hud-username">${currentUser.username.toUpperCase()}</span>
      <button id="btn-logout" class="hud-btn-auth">LOGOUT</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  } else {
    userSection.innerHTML = `
      <button id="btn-signin" class="hud-btn-auth">SIGN IN</button>
    `;
    document.getElementById('btn-signin')?.addEventListener('click', () => showModal('signin'));
  }
}

// ============================================
// MODAL
// ============================================
function showModal(mode = 'signin') {
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    document.body.appendChild(modal);
  }

  const isSignUp = mode === 'signup';

  modal.innerHTML = `
    <div class="auth-backdrop"></div>
    <div class="auth-panel">
      <div class="auth-header">
        <span class="auth-title">◈ ${isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</span>
        <button class="auth-close">✕</button>
      </div>
      <form class="auth-form" id="auth-form">
        ${isSignUp ? `
          <label class="auth-label">CALLSIGN</label>
          <input type="text" name="username" class="auth-input" placeholder="Your username" minlength="3" maxlength="20" required />
        ` : ''}
        <label class="auth-label">EMAIL</label>
        <input type="email" name="email" class="auth-input" placeholder="operator@domain.com" required />
        <label class="auth-label">PASSWORD</label>
        <input type="password" name="password" class="auth-input" placeholder="Min 8 characters" minlength="8" required />
        <div class="auth-error" id="auth-error"></div>
        <button type="submit" class="auth-submit">${isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
      </form>
      <div class="auth-switch">
        ${isSignUp
          ? 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>'
          : 'Need an account? <a href="#" id="auth-switch-link">Create one</a>'
        }
      </div>
    </div>
  `;

  modal.classList.add('visible');

  // Events
  modal.querySelector('.auth-backdrop').addEventListener('click', hideModal);
  modal.querySelector('.auth-close').addEventListener('click', hideModal);
  modal.querySelector('#auth-switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    showModal(isSignUp ? 'signin' : 'signup');
  });
  modal.querySelector('#auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(isSignUp);
  });
}

function hideModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('visible');
}

// ============================================
// FORM SUBMIT
// ============================================
async function handleSubmit(isSignUp) {
  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const formData = new FormData(form);

  const payload = {};
  for (const [key, val] of formData.entries()) {
    payload[key] = val;
  }

  const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

  try {
    errorEl.textContent = '';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      errorEl.textContent = data.error || 'Something went wrong';
      return;
    }

    // Success
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('wartrack_token', authToken);
    updateHUD();
    hideModal();

    // Notify favorites module
    window.dispatchEvent(new CustomEvent('wartrack-auth-change', { detail: { user: currentUser } }));

  } catch (err) {
    errorEl.textContent = 'Connection error — try again';
  }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('wartrack_token');
  updateHUD();
  window.dispatchEvent(new CustomEvent('wartrack-auth-change', { detail: { user: null } }));
}

// ============================================
// BIND EVENTS
// ============================================
function bindEvents() {
  // The SIGN IN button is rendered by updateHUD, events bound there
}
