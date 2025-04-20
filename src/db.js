import Database from '@tauri-apps/plugin-sql';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await Database.load('sqlite:notes.db');
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