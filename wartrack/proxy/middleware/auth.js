// ============================================
// AUTH MIDDLEWARE — Dual-mode: Supabase or JWT fallback
// ============================================

import jwt from 'jsonwebtoken';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'wartrack-dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

// Generate JWT token (SQLite mode only)
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Validate auth and return normalized user shape { userId, username, email }
export async function requireAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw { status: 401, message: 'Authentication required' };
  }

  // --- SUPABASE MODE ---
  if (supabaseConfigured) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        throw { status: 401, message: 'Invalid or expired token' };
      }
      return {
        userId: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        email: user.email,
      };
    } catch (err) {
      if (err.status) throw err;
      throw { status: 401, message: 'Invalid or expired token' };
    }
  }

  // --- SQLITE/JWT FALLBACK ---
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw { status: 401, message: 'Invalid or expired token' };
  }
}

export { JWT_SECRET, supabaseConfigured };
