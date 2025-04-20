use rusqlite::{params, Connection, Result};
use chrono::Utc;

#[derive(Debug)]
pub struct Note {
    pub id: i32,
    pub title: String,
    pub body: String,
    pub created_at: String,
}
// make the database
pub fn init_db(conn: &Connection) -> Result<()> {
    {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS notes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                body        TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
    
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
        Ok(())
    }
}
// add note to db
pub fn add_note(conn: &Connection, title: &str, body: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO notes (title, body, created_at) VALUES (?1, ?2, ?3)",
        params![title, body, now],
    )?;
    Ok(())
}
// get list
pub fn list_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare("SELECT id, title, body, created_at FROM notes")?;
    let notes_iter = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            created_at: row.get(3)?,
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
            SELECT n.id, n.title, n.body, n.created_at
            FROM notes_fts f
            JOIN notes n ON f.rowid = n.id
            WHERE notes_fts MATCH ?1
            ORDER BY rank;
            "
        )?;
        let notes_iter = stmt.query_map([&fts_query], |row| {
            Ok(Note {
                id:          row.get(0)?,
                title:       row.get(1)?,
                body:        row.get(2)?,
                created_at:  row.get(3)?,
            })
        })?;
        let mut notes = Vec::new();
        for note in notes_iter {
            notes.push(note?);
        }
        Ok(notes)
    }
}
// add delete-ability!
pub fn delete_note(conn: &Connection, id: i32) -> Result<usize> {
    conn.execute("DELETE FROM notes WHERE id = ?1", [id])
}

// simple edit function -- use later with sync daemon?
pub fn edit_note(conn: &Connection, id: i32, new_title: &str, new_body: &str) -> Result<usize> {
    conn.execute(
        "UPDATE notes SET title = ?1, body = ?2 WHERE id = ?3",
        (new_title, new_body, id),
    )
}


pub fn get_note_by_id(conn: &Connection, note_id: i32) -> Result<Note> {
    conn.query_row(
        "SELECT id, title, body, created_at FROM notes WHERE id = ?1",
        params![note_id],
        |row| Ok(Note {
            id:          row.get(0)?,
            title:       row.get(1)?,
            body:        row.get(2)?,
            created_at:  row.get(3)?,
        }),
    )
}