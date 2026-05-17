// main.rs
// Tauri application entry point.
// Registers all Rust commands exposed to the TypeScript frontend.

// Prevents an extra console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod process_scanner;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            process_scanner::get_active_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
