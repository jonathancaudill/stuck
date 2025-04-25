import Database from '@tauri-apps/plugin-sql';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  const dataDir = await appLocalDataDir();
  const dbPath = await join(dataDir, 'notes.db');
  _db = await Database.load(`sqlite:${dbPath}`);
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      last_edited TEXT
    )
  `);
  return _db;
}