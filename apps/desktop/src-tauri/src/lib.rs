// The Rust side only wires the window and the SQLite bridge. Business logic lives in the
// shared TypeScript packages.
mod app_icon;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(db::Databases::new())
        .invoke_handler(tauri::generate_handler![db::study_run, db::study_all, db::bible_all, app_icon::set_app_icon])
        .run(tauri::generate_context!())
        .expect("error while running BibleOS");
}
