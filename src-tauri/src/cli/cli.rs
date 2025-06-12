#[path = "../db.rs"]
mod db;
#[path = "../app.rs"]
mod app;

use rusqlite::Connection;
use std::env;
use std::path::PathBuf;
use dirs::data_local_dir;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    
    // Get the database path
    let data_dir = data_local_dir().ok_or("Could not find local data directory")?;
    let db_path = data_dir.join("notes.db");
    
    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "journal_mode", &String::from("WAL"))?;
    db::init_db(&conn)?;
    
    app::run_cli_command(&conn, &args)
}
