// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{generate_context, Manager};
use tauri_plugin_sql::Builder as SqlBuilder;
use window_vibrancy::{apply_blur, apply_vibrancy, NSVisualEffectMaterial};
use tauri_plugin_decorum::WebviewWindowExt;
use tauri::TitleBarStyle;
use dirs::data_local_dir;
use rusqlite::Connection;
use stuck_lib::db;
use std::path::PathBuf;

fn main() {
    let context = generate_context!();
    
    // Initialize database
    if let Some(data_dir) = data_local_dir() {
        let db_path = data_dir.join("notes.db");
        if let Ok(conn) = Connection::open(&db_path) {
            // Set WAL mode for better concurrency
            let _ = conn.pragma_update(None, "journal_mode", &String::from("WAL"));
            // Initialize database schema
            if let Err(e) = db::init_db(&conn) {
                eprintln!("Failed to initialize database: {}", e);
            }
        }
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")] {
                window.set_traffic_lights_inset(12.0, 12.0).unwrap();
                window.set_title_bar_style(TitleBarStyle::Overlay).ok();
                window.create_overlay_titlebar().unwrap();
                let _ = window.set_title("");
                window.make_transparent().unwrap();
                
                // Use Sidebar material which is optimized for larger surfaces
                apply_vibrancy(&window, NSVisualEffectMaterial::Popover, None, None)
                    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
            }
            #[cfg(target_os = "windows")]
            apply_blur(&window, Some((18, 18, 18, 125)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
            Ok(())
        })
        .plugin(SqlBuilder::default().build())
        .run(context)
        .expect("error while running Tauri application");
}
