use rusqlite::{params, Connection, Result};
use chrono::Utc;

#[derive(Debug)]
pub struct Note {
    pub id: i32,
    pub title: String,
    pub body: String,
    pub created_at: String,
    pub last_edited: String,
    pub folder: String,
    pub deleted_at: Option<String>,
}
// make the database
pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS notes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            last_edited TEXT NOT NULL,
            folder      TEXT DEFAULT 'Default',
            deleted_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS folders (
            name        TEXT PRIMARY KEY,
            order_idx   INTEGER
        );

        -- Always ensure default folders exist
        INSERT OR IGNORE INTO folders (name, order_idx) VALUES ('Default', 0);
        INSERT OR IGNORE INTO folders (name, order_idx) VALUES ('Trash', 999);

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts
            USING fts5(title, body, content='notes', content_rowid='id');

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
        "
    )?;

    // Double-check that default folders exist
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM folders WHERE name IN ('Default', 'Trash')")?;
    let count: i32 = stmt.query_row([], |row| row.get(0))?;
    
    if count < 2 {
        // If either folder is missing, ensure both exist
        conn.execute("INSERT OR IGNORE INTO folders (name, order_idx) VALUES ('Default', 0)", [])?;
        conn.execute("INSERT OR IGNORE INTO folders (name, order_idx) VALUES ('Trash', 999)", [])?;
    }

    Ok(())
}
// add note to db
pub fn add_note(conn: &Connection, title: &str, body: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO notes (title, body, created_at, last_edited, folder) VALUES (?1, ?2, ?3, ?3, 'Default')",
        params![title, body, now],
    )?;
    Ok(())
}
// get list
pub fn list_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare("SELECT id, title, body, created_at, last_edited, folder, deleted_at FROM notes")?;
    let notes_iter = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            created_at: row.get(3)?,
            last_edited: row.get(4)?,
            folder: row.get(5)?,
            deleted_at: row.get(6)?,
        })
    })?;

    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note?);
    }
    Ok(notes)
}
// add searchability
pub fn search_notes(conn: &Connection, query: &str) -> Result<Vec<Note>> {
    {
        let fts_query = format!("{}*", query);
        let mut stmt = conn.prepare(
            "
            SELECT n.id, n.title, n.body, n.created_at, n.last_edited, n.folder, n.deleted_at
            FROM notes_fts f
            JOIN notes n ON f.rowid = n.id
            WHERE notes_fts MATCH ?1
            ORDER BY rank;
            "
        )?;
        let notes_iter = stmt.query_map([&fts_query], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
                last_edited: row.get(4)?,
                folder: row.get(5)?,
                deleted_at: row.get(6)?,
            })
        })?;
        let mut notes = Vec::new();
        for note in notes_iter {
            notes.push(note?);
        }
        Ok(notes)
    }
}
// move note to trash
pub fn move_to_trash(conn: &Connection, id: i32) -> Result<usize> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET folder = 'Trash', deleted_at = ?1 WHERE id = ?2",
        params![now, id],
    )
}
// restore note from trash
pub fn restore_note(conn: &Connection, id: i32) -> Result<usize> {
    conn.execute(
        "UPDATE notes SET folder = 'Default', deleted_at = NULL WHERE id = ?1",
        params![id],
    )
}
// permanently delete note
pub fn delete_note(conn: &Connection, id: i32) -> Result<usize> {
    conn.execute("DELETE FROM notes WHERE id = ?1", [id])
}
// simple edit function 
pub fn edit_note(conn: &Connection, id: i32, new_title: &str, new_body: &str) -> Result<usize> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET title = ?1, body = ?2, last_edited = ?3 WHERE id = ?4",
        params![new_title, new_body, now, id],
    )
}
pub fn get_note_by_id(conn: &Connection, note_id: i32) -> Result<Note> {
    conn.query_row(
        "SELECT id, title, body, created_at, last_edited, folder, deleted_at FROM notes WHERE id = ?1",
        params![note_id],
        |row| Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            created_at: row.get(3)?,
            last_edited: row.get(4)?,
            folder: row.get(5)?,
            deleted_at: row.get(6)?,
        }),
    )
}
// Clean up notes older than 30 days
pub fn cleanup_old_notes(conn: &Connection) -> Result<usize> {
    let thirty_days_ago = Utc::now()
        .checked_sub_signed(chrono::Duration::days(30))
        .unwrap_or(Utc::now())
        .to_rfc3339();
    
    conn.execute(
        "DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
        params![thirty_days_ago],
    )
}