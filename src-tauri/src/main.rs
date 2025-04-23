// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{generate_context, Builder, Manager};
use tauri_plugin_sql::Builder as SqlBuilder;
use window_vibrancy::{apply_blur, apply_vibrancy, NSVisualEffectMaterial};
use tauri_plugin_decorum::WebviewWindowExt;
use tauri::TitleBarStyle;

fn main() {
    let context = generate_context!();
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();


            #[cfg(target_os = "macos")] {
            window.set_traffic_lights_inset(12.0, 12.0).unwrap();
            window.set_title_bar_style(TitleBarStyle::Overlay).unwrap();
            window.create_overlay_titlebar().unwrap();
            window.set_title("stuck.") ;
        
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            }
            #[cfg(target_os = "windows")]
            apply_blur(&window, Some((18, 18, 18, 125)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
            Ok(())
        })
        .plugin(SqlBuilder::default().build())
        .invoke_handler(tauri::generate_handler![])
        .run(context)
        .expect("error while running Tauri application");
}
