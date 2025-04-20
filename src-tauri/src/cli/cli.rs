#[path = "../db.rs"]
mod db;
#[path = "../app.rs"]
mod app;

use rusqlite::Connection;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let conn = Connection::open("notes.db")?;
    conn.pragma_update(None, "journal_mode", &String::from("WAL"))?;
    db::init_db(&conn)?;
    app::run_cli_command(&conn, &args)?;
    Ok(())
}
