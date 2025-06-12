import Database from '@tauri-apps/plugin-sql';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

let _db = null;

export async function getDb() {
  if (_db) {
    console.log('Returning existing database connection');
    return _db;
  }
  
  try {
    console.log('Initializing new database connection...');
    // In development, use a local path
    const dataDir = await appLocalDataDir();
    console.log('App data directory:', dataDir);
    const dbPath = await join(dataDir, 'notes.db');
    console.log('Database path:', dbPath);
    
    _db = await Database.load(`sqlite:${dbPath}`);
    console.log('Database loaded successfully');
    
    // Create notes table if it doesn't exist
    console.log('Creating notes table if needed...');
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_edited TEXT NOT NULL,
        folder TEXT DEFAULT 'Default',
        deleted_at TEXT
      )
    `);
    console.log('Notes table verified');

    // Create folders table if it doesn't exist
    console.log('Creating folders table if needed...');
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        name TEXT PRIMARY KEY,
        order_idx INTEGER
      )
    `);
    console.log('Folders table verified');

    // Ensure default folders exist
    console.log('Ensuring default folders exist...');
    await _db.execute(`
      INSERT OR IGNORE INTO folders (name, order_idx) VALUES 
      ('Default', 0),
      ('Trash', 999)
    `);
    console.log('Default folders verified');

    // Create FTS table for search if it doesn't exist
    console.log('Creating FTS table if needed...');
    await _db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts
      USING fts5(title, body, content='notes', content_rowid='id')
    `);
    console.log('FTS table verified');

    // Create triggers for FTS if they don't exist
    console.log('Creating FTS triggers if needed...');
    await _db.execute(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body)
        VALUES('delete', old.id, old.title, old.body);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body)
        VALUES('delete', old.id, old.title, old.body);
        INSERT INTO notes_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;
    `);
    console.log('FTS triggers verified');

    return _db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// ... rest of the file ...