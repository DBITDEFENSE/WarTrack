// ============================================
// AUTH UI — Clerk-powered authentication
// Uses Clerk CDN script (auto-initializes via data-clerk-publishable-key)
// Falls back to server-side auth if Clerk unavailable
// ============================================

import { apiUrl } from '../config.js';
let clerkInstance = null;
let currentUser = null;

// ============================================
// PUBLIC API
// ============================================
export function isAuthenticated() { return !!currentUser; }
export function getCurrentUser() { return currentUser; }

export async function getAuthHeaders() {
  if (clerkInstance?.session) {
    try {
      const token = await clerkInstance.session.getToken();
      if (token) return { 'Authorization': `Bearer ${token}` };
    } catch { /* session expired */ }
  }
  // Fallback to localStorage token
  const saved = localStorage.getItem('wartrack_token');
  if (saved) return { 'Authorization': `Bearer ${saved}` };
  return {};
}

export function getAuthToken() {
  return localStorage.getItem('wartrack_token') || null;
}

// ============================================
// INIT — Wait for Clerk CDN to load, then initialize
// ============================================
export async function initAuth() {
  const publishableKey = window.CLERK_PUBLISHABLE_KEY;

  if (publishableKey) {
    try {
      // Load Clerk JS SDK via dynamic script
      await loadClerkScript(publishableKey);

      // Wait for window.Clerk to be available (set by the script)
      await waitFor(() => window.Clerk, 6000);

      clerkInstance = window.Clerk;

      // Call load() to initialize Clerk with UI components
      if (clerkInstance && typeof clerkInstance.load === 'function') {
        await clerkInstance.load({
          appearance: {
            variables: {
              colorPrimary: '#00ff88',
              colorBackground: '#0a1220',
              colorText: '#e0e8f0',
              colorInputBackground: '#111a28',
              colorInputText: '#e0e8f0',
              borderRadius: '4px',
            },
          },
        });
      }

      // Check existing session
      if (clerkInstance?.user) {
        currentUser = normalizeUser(clerkInstance.user);
      }

      // Listen for auth changes
      clerkInstance?.addListener?.((event) => {
        if (event.user) {
          currentUser = normalizeUser(event.user);
        } else {
          currentUser = null;
        }
        updateHUD();
        window.dispatchEvent(new CustomEvent('wartrack-auth-change', { detail: { user: currentUser } }));
      });

      console.log('Clerk auth ready', currentUser ? `(${currentUser.username})` : '(signed out)');
    } catch (err) {
      console.warn('Clerk load failed, using fallback auth:', err.message || err);
      clerkInstance = null;
    }
  }

  // Fallback: check for existing server-side token
  if (!clerkInstance) {
    const saved = localStorage.getItem('wartrack_token');
    if (saved) {
      try {
        const resp = await fetch(apiUrl('/api/auth/me'), { headers: { 'Authorization': `Bearer ${saved}` } });
        if (resp.ok) {
          const data = await resp.json();
          currentUser = data.user;
        } else {
          localStorage.removeItem('wartrack_token');
        }
      } catch { /* server not available */ }
    }
  }

  updateHUD();
}

// Load Clerk script tag dynamically with publishable key attribute
function loadClerkScript(publishableKey) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-clerk-publishable-key]')) {
      resolve();
      return;
    }
    // Extract the Frontend API domain from the publishable key
    // pk_test_xxxx → decode base64 part after pk_test_ to get the domain
    let frontendApi = '';
    try {
      const encoded = publishableKey.replace('pk_test_', '').replace('pk_live_', '');
      frontendApi = atob(encoded).replace(/\$$/, ''); // remove trailing $
    } catch { /* ignore */ }

    const script = document.createElement('script');
    script.setAttribute('data-clerk-publishable-key', publishableKey);
    script.async = true;
    script.crossOrigin = 'anonymous';

    // Use the Frontend API CDN URL (Clerk's recommended approach)
    if (frontendApi) {
      script.src = `https://${frontendApi}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    } else {
      script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
    }

    script.onload = resolve;
    script.onerror = () => {
      // Fallback to generic CDN
      script.remove();
      const fb = document.createElement('script');
      fb.setAttribute('data-clerk-publishable-key', publishableKey);
      fb.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
      fb.onload = resolve;
      fb.onerror = reject;
      document.head.appendChild(fb);
    };
    document.head.appendChild(script);
  });
}

// Generic wait utility
function waitFor(check, timeout) {
  return new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (check()) { clearInterval(interval); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(interval); reject(new Error('timeout')); }
    }, 100);
  });
}

// ============================================
// NORMALIZE CLERK USER
// ============================================
function normalizeUser(clerkUser) {
  if (!clerkUser) return null;
  return {
    id: clerkUser.id,
    username: clerkUser.username || clerkUser.firstName || clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'operator',
    email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || '',
    imageUrl: clerkUser.imageUrl,
  };
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
    document.getElementById('btn-signin')?.addEventListener('click', openSignIn);
  }

  // Update settings account section
  const accountInfo = document.getElementById('settings-account-info');
  if (accountInfo) {
    accountInfo.textContent = currentUser ? `Signed in as ${currentUser.username}` : 'Not signed in';
  }
}

// ============================================
// SIGN IN / SIGN UP
// ============================================
function openSignIn() {
  if (clerkInstance?.openSignIn) {
    clerkInstance.openSignIn({});
    return;
  }
  // Fallback modal
  showFallbackModal('signin');
}

function openSignUp() {
  if (clerkInstance?.openSignUp) {
    clerkInstance.openSignUp({});
    return;
  }
  showFallbackModal('signup');
}

// ============================================
// LOGOUT
// ============================================
async function logout() {
  if (clerkInstance?.signOut) {
    await clerkInstance.signOut();
  }
  localStorage.removeItem('wartrack_token');
  currentUser = null;
  updateHUD();
  window.dispatchEvent(new CustomEvent('wartrack-auth-change', { detail: { user: null } }));
}

// ============================================
// FALLBACK MODAL (when Clerk not available)
// ============================================
function showFallbackModal(mode = 'signin') {
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
        ${isSignUp ? '<label class="auth-label">CALLSIGN</label><input type="text" name="username" class="auth-input" placeholder="Username" minlength="3" maxlength="20" required />' : ''}
        <label class="auth-label">EMAIL</label>
        <input type="email" name="email" class="auth-input" placeholder="operator@domain.com" required />
        <label class="auth-label">PASSWORD</label>
        <input type="password" name="password" class="auth-input" placeholder="Min 8 characters" minlength="8" required />
        <div class="auth-error" id="auth-error"></div>
        <button type="submit" class="auth-submit">${isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
      </form>
      <div class="auth-switch">
        ${isSignUp ? 'Have an account? <a href="#" id="auth-switch-link">Sign In</a>' : 'Need an account? <a href="#" id="auth-switch-link">Create one</a>'}
      </div>
    </div>
  `;

  modal.classList.add('visible');
  modal.querySelector('.auth-backdrop').addEventListener('click', () => modal.classList.remove('visible'));
  modal.querySelector('.auth-close').addEventListener('click', () => modal.classList.remove('visible'));
  modal.querySelector('#auth-switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    showFallbackModal(isSignUp ? 'signin' : 'signup');
  });
  modal.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    try {
      errorEl.textContent = '';
      const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await resp.json();
      if (!resp.ok) { errorEl.textContent = data.error || 'Error'; return; }
      localStorage.setItem('wartrack_token', data.token);
      currentUser = data.user;
      updateHUD();
      modal.classList.remove('visible');
      window.dispatchEvent(new CustomEvent('wartrack-auth-change', { detail: { user: currentUser } }));
    } catch { errorEl.textContent = 'Connection error'; }
  });
}
