//! Save and open dialogs for user files (backups and note exports).
//!
//! The web layer never names a path: it hands over a suggested file name and the text, or
//! asks for a file of a kind, and the native dialog decides where. Contents stay in the
//! TypeScript layer, which validates every import before it is written anywhere.

use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Largest file read or written through these commands (backups are capped at 50 M characters).
const MAX_BYTES: u64 = 200 * 1024 * 1024;

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    Json,
    Markdown,
}

impl FileKind {
    fn filter(self) -> (&'static str, &'static [&'static str]) {
        match self {
            FileKind::Json => ("JSON", &["json"]),
            FileKind::Markdown => ("Markdown", &["md", "markdown"]),
        }
    }
}

/// Shows the native save dialog and writes the text there. Returns false if the reader cancelled.
#[tauri::command]
pub async fn save_text_file(app: AppHandle, suggested_name: String, contents: String, kind: FileKind) -> Result<bool, String> {
    if suggested_name.is_empty() || suggested_name.len() > 120 || suggested_name.contains(['/', '\\', '\0']) {
        return Err("invalid file name".into());
    }
    if contents.len() as u64 > MAX_BYTES {
        return Err("file too large".into());
    }
    let (label, extensions) = kind.filter();
    let dialog = app.dialog().file().set_file_name(suggested_name).add_filter(label, extensions);
    // The dialog blocks until the reader answers, so it must not run on the main thread.
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file())
        .await
        .map_err(|e| e.to_string())?;
    let Some(path) = picked else { return Ok(false) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Shows the native open dialog and returns the chosen file's text, or None if cancelled.
#[tauri::command]
pub async fn pick_text_file(app: AppHandle, kind: FileKind) -> Result<Option<String>, String> {
    let (label, extensions) = kind.filter();
    let dialog = app.dialog().file().add_filter(label, extensions);
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_file())
        .await
        .map_err(|e| e.to_string())?;
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_BYTES {
        return Err("file too large".into());
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map(Some).map_err(|_| "file is not UTF-8 text".into())
}
