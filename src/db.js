import Database from '@tauri-apps/plugin-sql';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  const dataDir = await appLocalDataDir();
  const dbPath = await join(dataDir, 'notes.db');
  _db = await Database.load(`sqlite:${dbPath}`);
  
  // Create notes table with correct schema
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      last_edited TEXT NOT NULL,
      folder TEXT DEFAULT 'Default'
    )
  `);

  // Create folders table
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      name TEXT PRIMARY KEY,
      order_idx INTEGER
    )
  `);

  // Ensure default folder exists
  await _db.execute(`
    INSERT OR IGNORE INTO folders (name, order_idx) VALUES ('Default', 0)
  `);

  return _db;
}