// The Rust side only wires the window, the SQLite bridge, file dialogs, backup copies and updates.
// Business logic lives in the shared TypeScript packages.
mod app_icon;
mod backups;
mod db;
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    // Updates are checked and installed from the web layer; these plugins only expose the calls.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    builder
        .manage(db::Databases::new())
        .invoke_handler(tauri::generate_handler![
            db::study_run,
            db::study_all,
            db::bible_all,
            app_icon::set_app_icon,
            files::save_text_file,
            files::pick_text_file,
            backups::list_backups,
            backups::backup_study_if_due
        ])
        .run(tauri::generate_context!())
        .expect("error while running BibleOS");
}
