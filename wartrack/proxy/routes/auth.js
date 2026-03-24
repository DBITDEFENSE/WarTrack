// ============================================
// AUTH ROUTES — Dual-mode: Supabase or SQLite fallback
// ============================================

import bcrypt from 'bcryptjs';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

// SQLite fallback — lazy import (only if needed)
let db = null;
async function getDB() {
  if (!db) {
    const mod = await import('../db/init.js');
    db = mod.default;
  }
  return db;
}

// Simple rate limiter (SQLite mode only — Supabase has its own)
const authAttempts = new Map();
function checkRateLimit(req) {
  if (supabaseConfigured) return true; // Supabase handles rate limiting
  const ip = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const maxAttempts = 10;
  if (!authAttempts.has(ip)) authAttempts.set(ip, []);
  const attempts = authAttempts.get(ip).filter(t => now - t < window);
  authAttempts.set(ip, attempts);
  if (attempts.length >= maxAttempts) return false;
  attempts.push(now);
  return true;
}

export async function handleAuth(req, res, urlPath, body) {
  // Rate limit login/register
  if ((urlPath === '/api/auth/login' || urlPath === '/api/auth/register') && req.method === 'POST') {
    if (!checkRateLimit(req)) {
      res.writeHead(429);
      return res.end(JSON.stringify({ error: 'Too many attempts. Try again in 15 minutes.' }));
    }
  }

  // ============================================
  // REGISTER
  // ============================================
  if (urlPath === '/api/auth/register' && req.method === 'POST') {
    const { username, email, password } = body || {};

    if (!username || !email || !password) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Username, email, and password are required' }));
    }
    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Username must be 3-20 alphanumeric characters' }));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Invalid email format' }));
    }
    if (password.length < 8) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Password must be at least 8 characters' }));
    }

    // --- SUPABASE MODE ---
    if (supabaseConfigured) {
      try {
        // Check if username is taken
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
        if (existing) {
          res.writeHead(409);
          return res.end(JSON.stringify({ error: 'Username already taken' }));
        }

        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username }
        });

        if (error) {
          const status = error.message?.includes('already') ? 409 : 400;
          res.writeHead(status);
          return res.end(JSON.stringify({ error: error.message }));
        }

        // Sign in to get a session token
        const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          res.writeHead(500);
          return res.end(JSON.stringify({ error: 'Account created but login failed. Try signing in.' }));
        }

        res.writeHead(201);
        return res.end(JSON.stringify({
          token: signIn.session.access_token,
          user: { id: data.user.id, username, email }
        }));
      } catch (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: err.message || 'Registration failed' }));
      }
    }

    // --- SQLITE FALLBACK ---
    const sqlite = await getDB();
    const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      res.writeHead(409);
      return res.end(JSON.stringify({ error: 'Username or email already taken' }));
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = sqlite.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, hash);
    const user = { id: result.lastInsertRowid, username, email };
    const token = generateToken(user);
    res.writeHead(201);
    return res.end(JSON.stringify({ token, user: { id: user.id, username, email } }));
  }

  // ============================================
  // LOGIN
  // ============================================
  if (urlPath === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = body || {};

    if (!email || !password) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Email and password are required' }));
    }

    // --- SUPABASE MODE ---
    if (supabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          res.writeHead(401);
          return res.end(JSON.stringify({ error: 'Invalid email or password' }));
        }

        const username = data.user.user_metadata?.username || email.split('@')[0];
        res.writeHead(200);
        return res.end(JSON.stringify({
          token: data.session.access_token,
          user: { id: data.user.id, username, email: data.user.email }
        }));
      } catch (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: err.message || 'Login failed' }));
      }
    }

    // --- SQLITE FALLBACK ---
    const sqlite = await getDB();
    const user = sqlite.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Invalid email or password' }));
    }
    const token = generateToken(user);
    res.writeHead(200);
    return res.end(JSON.stringify({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    }));
  }

  // ============================================
  // GET CURRENT USER
  // ============================================
  if (urlPath === '/api/auth/me' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req);

      // Supabase: fetch profile for username
      if (supabaseConfigured) {
        const { data: profile } = await supabase.from('profiles').select('username, created_at').eq('id', payload.userId).maybeSingle();
        res.writeHead(200);
        return res.end(JSON.stringify({
          user: {
            id: payload.userId,
            username: profile?.username || payload.username,
            email: payload.email,
            created_at: profile?.created_at
          }
        }));
      }

      // SQLite fallback
      const sqlite = await getDB();
      const user = sqlite.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(payload.userId);
      if (!user) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'User not found' }));
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ user }));
    } catch (err) {
      res.writeHead(err.status || 401);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ============================================
  // LOGOUT (client-side action; server acknowledges)
  // ============================================
  if (urlPath === '/api/auth/logout' && req.method === 'POST') {
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'Logged out' }));
  }

  return false;
}
