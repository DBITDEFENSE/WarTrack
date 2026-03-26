// ============================================
// DATABASE — SQLite init (soft dependency)
// Falls back gracefully if better-sqlite3 unavailable (e.g., Railway)
// ============================================

let db = null;

try {
  const Database = (await import('better-sqlite3')).default;
  const path = (await import('path')).default;
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'wartrack.db');

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, entity_type, entity_id)
    );
  `);
  console.log('  SQLite database ready');
} catch (err) {
  console.log('  SQLite unavailable (using Supabase only):', err.message?.substring(0, 60));
  db = null;
}

export default db;
