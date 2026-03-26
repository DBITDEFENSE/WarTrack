// ============================================
// AUTH MIDDLEWARE — Clerk + Supabase JWT + SQLite fallback
// Tries Clerk first, then Supabase, then local JWT
// ============================================

import jwt from 'jsonwebtoken';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'wartrack-dev-secret-change-in-production';
const JWT_EXPIRY = '7d';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';

// Generate JWT token (SQLite fallback mode)
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// ============================================
// REQUIRE AUTH — multi-mode verification
// Returns normalized { userId, username, email }
// ============================================
export async function requireAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw { status: 401, message: 'Authentication required' };
  }

  // --- TRY CLERK ---
  if (CLERK_SECRET_KEY) {
    try {
      const { verifyToken } = await import('@clerk/backend');
      const payload = await verifyToken(token, {
        secretKey: CLERK_SECRET_KEY,
      });
      if (payload?.sub) {
        return {
          userId: payload.sub,
          username: payload.username || payload.email?.split('@')[0] || 'user',
          email: payload.email || '',
        };
      }
    } catch {
      // Not a Clerk token — try other methods
    }
  }

  // --- TRY SUPABASE ---
  if (supabaseConfigured) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return {
          userId: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          email: user.email,
          role: user.user_metadata?.role || 'user',
          isAdmin: user.user_metadata?.role === 'admin',
        };
      }
    } catch {
      // Not a Supabase token — try JWT
    }
  }

  // --- TRY LOCAL JWT ---
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
    };
  } catch {
    throw { status: 401, message: 'Invalid or expired token' };
  }
}

export { JWT_SECRET, supabaseConfigured };
