use rusqlite::Connection;
use crate::db::{add_note, list_notes, search_notes, delete_note, edit_note, move_to_trash, restore_note, cleanup_old_notes};

// CLI commandz
pub fn run_cli_command(conn: &Connection, args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    match args.get(1).map(|s| s.as_str()) {
        Some("add") => {
            let title = args.get(2).map(|s| s.trim()).unwrap_or_default().to_string();
            let body = args.get(3).map(|s| s.trim()).unwrap_or_default().to_string();

            if title.is_empty() && body.is_empty() {
                println!("Not saving empty note.");
            } else {
                let safe_title = if title.is_empty() { "Untitled".to_string() } else { title };
                add_note(conn, &safe_title, &body)?;
                println!("Note added!");
            }
        }

        Some("list") => {
            let notes = list_notes(conn)?;
            for note in notes {
                let folder_info = if note.folder == "Trash" {
                    format!(" [Trash]")
                } else if note.folder != "Default" {
                    format!(" [{}]", note.folder)
                } else {
                    String::new()
                };
                println!("#{}\n📄 {}{}\n{}\n📅 {}\n---", note.id, note.title, folder_info, note.body, note.created_at);
            }
        }

        Some("search") => {
            let query = args.get(2).map(|s| s.trim()).unwrap_or_default();
            if query.is_empty() {
                println!("🔍 Please provide a search query.");
            } else {
                let results = search_notes(conn, query)?;
                if results.is_empty() {
                    println!("🤷 No matching notes found.");
                } else {
                    for note in results {
                        let folder_info = if note.folder == "Trash" {
                            format!(" [Trash]")
                        } else if note.folder != "Default" {
                            format!(" [{}]", note.folder)
                        } else {
                            String::new()
                        };
                        println!("#{}\n📄 {}{}\n{}\n📅 {}\n---", note.id, note.title, folder_info, note.body, note.created_at);
                    }
                }
            }
        }

        Some("delete") => {
            let id_arg = args.get(2);
            match id_arg {
                Some(id_str) => match id_str.parse::<i32>() {
                    Ok(id) => {
                        let deleted = move_to_trash(conn, id)?;
                        if deleted > 0 {
                            println!("Note #{} moved to trash.", id);
                        } else {
                            println!("No note found with ID {}.", id);
                        }
                    }
                    Err(_) => println!("Invalid ID: must be a number."),
                },
                None => println!("Usage: stuck delete <note_id>"),
            }
        }

        Some("restore") => {
            let id_arg = args.get(2);
            match id_arg {
                Some(id_str) => match id_str.parse::<i32>() {
                    Ok(id) => {
                        let restored = restore_note(conn, id)?;
                        if restored > 0 {
                            println!("Note #{} restored from trash.", id);
                        } else {
                            println!("No note found with ID {}.", id);
                        }
                    }
                    Err(_) => println!("Invalid ID: must be a number."),
                },
                None => println!("Usage: stuck restore <note_id>"),
            }
        }

        Some("trash") => {
            let notes = list_notes(conn)?;
            let trash_notes: Vec<_> = notes.into_iter().filter(|n| n.folder == "Trash").collect();
            if trash_notes.is_empty() {
                println!("🗑️  Trash is empty.");
            } else {
                println!("🗑️  Trash contents:");
                for note in trash_notes {
                    println!("#{}\n📄 {}\n{}\n📅 {}\n---", note.id, note.title, note.body, note.created_at);
                }
            }
        }

        Some("cleanup") => {
            let deleted = cleanup_old_notes(conn)?;
            println!("🧹 Cleaned up {} old notes from trash.", deleted);
        }

        Some("edit") => {
            let id = match args.get(2).and_then(|s| s.parse::<i32>().ok()) {
                Some(num) => num,
                None => {
                    println!("Invalid or missing ID.");
                    return Ok(());
                }
            };

            let new_title = args.get(3).map(|s| s.trim()).unwrap_or_default().to_string();
            let new_body = args.get(4).map(|s| s.trim()).unwrap_or_default().to_string();

            if new_title.is_empty() && new_body.is_empty() {
                println!("No changes provided.");
                return Ok(());
            }

            let updated = edit_note(conn, id, &new_title, &new_body)?;
            if updated > 0 {
                println!("Note #{} updated.", id);
            } else {
                println!("No note found with ID {}.", id);
            }
        }

        _ => {
            println!("Usage:");
            println!("  stuck add \"title\" \"body\"");
            println!("  stuck list");
            println!("  stuck search \"query\"");
            println!("  stuck delete <id>");
            println!("  stuck restore <id>");
            println!("  stuck trash");
            println!("  stuck cleanup");
            println!("  stuck edit <id> \"new title\" \"new body\"");
        }
    }

    Ok(())
}


#[derive(Clone)]
pub struct NoteItem {
    pub id: i32,
    pub title: String,
    pub body: String,
    pub created_at: String,
}