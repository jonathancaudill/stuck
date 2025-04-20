use rusqlite::Connection;
use stuck::db;
use slint::{ModelRc, VecModel, SharedString};
use std::sync::{Arc, Mutex};

// Import the Slint-generated component and its NoteItem type
use slint_generatedMainWindow::NoteItem as SlintNoteItem;

use winit::window::Window;
use winit::window::WindowLevel;
use winit::event_loop::EventLoop;
use winit::platform::macos::WindowAttributesExtMacOS;
use i_slint_backend_winit::WinitWindowAccessor;

slint::include_modules!();

// macOS blur helper
#[cfg(target_os = "macos")]
use stuck::platform::macos_blur::apply_macos_blur;

// Windows Mica stub
#[cfg(target_os = "windows")]
fn apply_windows_mica(window: &Window) {
    println!("Applying Windows Mica (stub)");
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize SQLite connection and database
    let conn = Connection::open("notes.db")?;
    conn.pragma_update(None, "journal_mode", &String::from("WAL"))?;
    db::init_db(&conn)?;

    let conn = Arc::new(conn);

    // Configure Slint backend with transparency / blur
    let mut backend = i_slint_backend_winit::Backend::new()?;
    backend.window_attributes_hook = Some(Box::new(|mut builder| {
        builder
            .with_blur(true)
            .with_transparent(true)
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
    }));
    slint::platform::set_platform(Box::new(backend))?;

    let mut app = MainWindow::new().unwrap();

    // Initialize body content height to zero
    app.set_body_content_height(0.0);

    // 1) Build & set your notes list model
    let notes = db::list_notes(&conn)?;
    // 1) Tell Rust exactly what `items` is:
    let items: Vec<SlintNoteItem> = notes.into_iter()
    .map(|db_note| {
        // Destructure your db::Note
        let db::Note { id, title, body, created_at } = db_note;

        // Build a 30‑char Unicode‑safe preview
        let preview_str: String = body.chars().take(30).collect();
        let preview = if body.chars().count() > 30 {
            format!("{}…", preview_str)
        } else {
            preview_str
        };

        // 2) Return a SlintNoteItem struct from the closure
        SlintNoteItem {
            id,
            title: SharedString::from(title),
            preview: SharedString::from(preview),
            body: SharedString::from(body),
            created_at: SharedString::from(created_at),
        }
    })
    .collect();  // now collects into Vec<SlintNoteItem>
    app.set_notes_model(ModelRc::new(VecModel::from(items)));

    // 1) create a shared slot to stash the currently‑selected note ID
    let current_note = Arc::new(Mutex::new(None::<i32>));

    // clone for the selection handler
    let current_note_sel = current_note.clone();
    let conn_sel = conn.clone();
    let app_sel = app.as_weak();

    app.on_note_selected(move |id| {
        // store the new current note
        *current_note_sel.lock().unwrap() = Some(id);
        // fetch it from the DB and populate both editors
        if let Some(app) = app_sel.upgrade() {
            if let Ok(note) = db::get_note_by_id(&conn_sel, id) {
                let body_str = note.body;
                app.set_editor_title(SharedString::from(note.title));
                app.set_editor_body(SharedString::from(body_str.clone()));

                // Compute and set body content height based on line count
                let lines = body_str.matches('\n').count() + 1;
                let content_h = lines as f32 * 36.0;
                app.set_body_content_height(content_h);
            }
        }
    });

    // 2) hook title‐changes → write back to DB
    let current_note_title = current_note.clone();
    let conn_title = conn.clone();
    let app_title = app.as_weak();

    app.on_title_changed(move |new_title: SharedString| {
        if let Some(app) = app_title.upgrade() {
            if let Some(id) = *current_note_title.lock().unwrap() {
                // grab the current body from the UI
                let body = app.get_editor_body().to_string();
                // update both title and body in the DB
                let _ = db::edit_note(&conn_title, id, &new_title, &body);
            }
        }
    });

    // 3) hook body‐changes → write back to DB
    let current_note_body = current_note.clone();
    let conn_body = conn.clone();
    let app_body = app.as_weak();

    app.on_body_changed(move |new_body| {
        // 1) recompute height
        let body_str = new_body.to_string();
        let lines = body_str.matches('\n').count() + 1;
        let content_h = lines as f32 * 36.0;

        // 2) upgrade app and update UI first
        if let Some(app) = app_body.upgrade() {
            app.set_body_content_height(content_h);

            // 3) then save to DB
            if let Some(id) = *current_note_body.lock().unwrap() {
                let title = app.get_editor_title().to_string();
                let _ = db::edit_note(&conn_body, id, &title, &body_str);
            }
        }
    });

    // Start the UI
    app.run()?;
    Ok(())
}
