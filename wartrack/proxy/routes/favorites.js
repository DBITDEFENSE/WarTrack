// ============================================
// FAVORITES ROUTES — Dual-mode: Supabase or SQLite
// ============================================

import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

// SQLite fallback — lazy import
let db = null;
async function getDB() {
  if (!db) {
    const mod = await import('../db/init.js');
    db = mod.default;
  }
  return db;
}

export async function handleFavorites(req, res, urlPath, body) {
  // All favorites routes require auth
  let user;
  try {
    user = await requireAuth(req);
  } catch (err) {
    res.writeHead(err.status || 401);
    return res.end(JSON.stringify({ error: err.message }));
  }

  // ============================================
  // GET /api/favorites
  // ============================================
  if (urlPath === '/api/favorites' && req.method === 'GET') {
    if (supabaseConfigured) {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false });

      if (error) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: error.message }));
      }
      // metadata is already JSONB — no parsing needed
      res.writeHead(200);
      return res.end(JSON.stringify({ favorites: data || [] }));
    }

    // SQLite fallback
    const sqlite = await getDB();
    const favorites = sqlite.prepare(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(user.userId);
    const parsed = favorites.map(f => ({
      ...f,
      metadata: f.metadata ? JSON.parse(f.metadata) : null
    }));
    res.writeHead(200);
    return res.end(JSON.stringify({ favorites: parsed }));
  }

  // ============================================
  // POST /api/favorites
  // ============================================
  if (urlPath === '/api/favorites' && req.method === 'POST') {
    const { entity_type, entity_id, metadata } = body || {};

    if (!entity_type || !entity_id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'entity_type and entity_id are required' }));
    }

    const validTypes = ['flight', 'vessel', 'hotspot', 'news', 'satellite', 'camera'];
    if (!validTypes.includes(entity_type)) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: `entity_type must be one of: ${validTypes.join(', ')}` }));
    }

    if (supabaseConfigured) {
      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.userId,
          entity_type,
          entity_id,
          metadata: metadata || null
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // unique violation
          res.writeHead(409);
          return res.end(JSON.stringify({ error: 'Already saved' }));
        }
        res.writeHead(500);
        return res.end(JSON.stringify({ error: error.message }));
      }

      res.writeHead(201);
      return res.end(JSON.stringify({ favorite: data }));
    }

    // SQLite fallback
    const sqlite = await getDB();
    try {
      const metadataStr = metadata ? JSON.stringify(metadata) : null;
      const result = sqlite.prepare(
        'INSERT INTO favorites (user_id, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)'
      ).run(user.userId, entity_type, entity_id, metadataStr);

      res.writeHead(201);
      return res.end(JSON.stringify({
        favorite: {
          id: result.lastInsertRowid,
          user_id: user.userId,
          entity_type,
          entity_id,
          metadata: metadata || null
        }
      }));
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        res.writeHead(409);
        return res.end(JSON.stringify({ error: 'Already saved' }));
      }
      throw err;
    }
  }

  // ============================================
  // DELETE /api/favorites/:id
  // ============================================
  if (urlPath.startsWith('/api/favorites/') && req.method === 'DELETE') {
    const id = urlPath.split('/').pop();
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Invalid favorite ID' }));
    }

    if (supabaseConfigured) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', id)
        .eq('user_id', user.userId);

      if (error) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: error.message }));
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ message: 'Removed' }));
    }

    // SQLite fallback
    const sqlite = await getDB();
    const result = sqlite.prepare(
      'DELETE FROM favorites WHERE id = ? AND user_id = ?'
    ).run(parseInt(id), user.userId);

    if (result.changes === 0) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Favorite not found' }));
    }
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'Removed' }));
  }

  return false;
}
