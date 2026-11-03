//! Daily copies of the study database in the app data folder (backups/study-YYYY-MM-DD.sqlite).
//!
//! The web layer decides whether backups are on and passes the schedule; this module only
//! copies the file (SQLite `VACUUM INTO` on the one study connection, so the copy is
//! consistent) and prunes old copies.

use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::db::{with_study, Databases};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    name: String,
    bytes: u64,
    /// Milliseconds since the Unix epoch.
    modified_at: u64,
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn is_backup_name(name: &str) -> bool {
    name.is_ascii()
        && name.len() == "study-YYYY-MM-DD.sqlite".len()
        && name.starts_with("study-")
        && name.ends_with(".sqlite")
        && name[6..16].chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() })
}

/// Backups, newest first.
fn read_backups(app: &AppHandle) -> Result<Vec<BackupInfo>, String> {
    let mut list = Vec::new();
    for entry in std::fs::read_dir(backups_dir(app)?).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_backup_name(&name) {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified = meta.modified().unwrap_or(UNIX_EPOCH).duration_since(UNIX_EPOCH).unwrap_or_default();
        list.push(BackupInfo { name, bytes: meta.len(), modified_at: u64::try_from(modified.as_millis()).unwrap_or(0) });
    }
    list.sort_by(|a, b| b.name.cmp(&a.name).then(b.modified_at.cmp(&a.modified_at)));
    Ok(list)
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    read_backups(&app)
}

/// Copies the study database when the newest backup is older than `every_hours`, then keeps
/// only the newest `keep` copies. `today` (YYYY-MM-DD, the reader's local day) names the file.
/// Returns the new backup, or None when none was due.
#[tauri::command]
pub fn backup_study_if_due(
    app: AppHandle,
    dbs: State<'_, Databases>,
    today: String,
    every_hours: u32,
    keep: u32,
) -> Result<Option<BackupInfo>, String> {
    let name = format!("study-{today}.sqlite");
    if !is_backup_name(&name) || !(1..=24 * 30).contains(&every_hours) || !(1..=365).contains(&keep) {
        return Err("invalid backup schedule".into());
    }
    let existing = read_backups(&app)?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let due_after = Duration::from_secs(u64::from(every_hours) * 3600);
    let newest_age = existing.iter().map(|b| now.saturating_sub(Duration::from_millis(b.modified_at))).min();
    if newest_age.is_some_and(|age| age < due_after) || existing.iter().any(|b| b.name == name) {
        return Ok(None);
    }

    let target = backups_dir(&app)?.join(&name);
    let target_text = target.to_str().ok_or("backup path is not UTF-8")?.to_owned();
    with_study(&app, &dbs, |conn| conn.execute("VACUUM INTO ?1", [&target_text]).map(|_| ()).map_err(|e| e.to_string()))?;

    let list = read_backups(&app)?;
    for old in list.iter().skip(usize::try_from(keep).unwrap_or(usize::MAX)) {
        std::fs::remove_file(backups_dir(&app)?.join(&old.name)).map_err(|e| e.to_string())?;
    }
    Ok(list.into_iter().find(|b| b.name == name))
}
