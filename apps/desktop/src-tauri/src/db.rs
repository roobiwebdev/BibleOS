//! SQLite bridge for the web layer.
//!
//! Two kinds of database, each opened only from a known location:
//! - the study database (notes, highlights, reading history) in the app data folder,
//!   one read-write connection so a transaction never splits across connections;
//! - the bundled Bible translations under resources/bibles, read-only, by translation id.
//!
//! The web layer never names a file path. Queries and rules live in the TypeScript
//! packages (local-db, local-api); this module only moves values in and out.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, OpenFlags};
use serde::Serialize;
use serde_json::{Map, Number, Value as Json};
use tauri::{AppHandle, Manager, State};

pub struct Databases {
    study: Mutex<Option<Connection>>,
    bibles: Mutex<HashMap<String, Connection>>,
}

impl Databases {
    pub fn new() -> Self {
        Self { study: Mutex::new(None), bibles: Mutex::new(HashMap::new()) }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    changes: usize,
    last_insert_rowid: i64,
}

fn to_value(json: &Json) -> Result<Value, String> {
    Ok(match json {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Integer(i64::from(*b)),
        Json::Number(n) => match n.as_i64() {
            Some(i) => Value::Integer(i),
            None => Value::Real(n.as_f64().ok_or("number out of range")?),
        },
        Json::String(s) => Value::Text(s.clone()),
        Json::Array(bytes) => Value::Blob(
            bytes
                .iter()
                .map(|b| b.as_u64().and_then(|v| u8::try_from(v).ok()).ok_or("blob must be bytes"))
                .collect::<Result<Vec<u8>, _>>()?,
        ),
        Json::Object(_) => return Err("objects cannot be bound as SQL parameters".into()),
    })
}

fn to_json(value: ValueRef<'_>) -> Json {
    match value {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(i) => Json::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f).map_or(Json::Null, Json::Number),
        ValueRef::Text(t) => Json::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Json::Array(b.iter().map(|x| Json::Number((*x).into())).collect()),
    }
}

fn bind(params: &[Json]) -> Result<Vec<Value>, String> {
    params.iter().map(to_value).collect()
}

/// Rows keep the database's column order (serde_json "preserve_order"): the Drizzle
/// proxy on the TypeScript side maps columns by position.
fn select(conn: &Connection, sql: &str, params: &[Json]) -> Result<Vec<Map<String, Json>>, String> {
    let mut stmt = conn.prepare_cached(sql).map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt.column_names().map(str::to_string).collect();
    let mut rows = stmt.query(params_from_iter(bind(params)?)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut object = Map::new();
        for (i, name) in names.iter().enumerate() {
            object.insert(name.clone(), to_json(row.get_ref(i).map_err(|e| e.to_string())?));
        }
        out.push(object);
    }
    Ok(out)
}

fn open_study(app: &AppHandle) -> Result<Connection, String> {
    let dir: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("study.sqlite")).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn with_study<T>(
    app: &AppHandle,
    dbs: &State<'_, Databases>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = dbs.study.lock().map_err(|_| "study database lock poisoned")?;
    if guard.is_none() {
        *guard = Some(open_study(app)?);
    }
    let conn = guard.as_ref().ok_or("study database unavailable")?;
    f(conn)
}

#[tauri::command]
pub fn study_run(app: AppHandle, dbs: State<'_, Databases>, sql: String, params: Vec<Json>) -> Result<RunResult, String> {
    with_study(&app, &dbs, |conn| {
        let changes = conn.execute(&sql, params_from_iter(bind(&params)?)).map_err(|e| e.to_string())?;
        Ok(RunResult { changes, last_insert_rowid: conn.last_insert_rowid() })
    })
}

#[tauri::command]
pub fn study_all(
    app: AppHandle,
    dbs: State<'_, Databases>,
    sql: String,
    params: Vec<Json>,
) -> Result<Vec<Map<String, Json>>, String> {
    with_study(&app, &dbs, |conn| select(conn, &sql, &params))
}

/// Reads from one bundled translation. Only ids made of a-z, 0-9 and "-" are accepted,
/// so a request can never reach a file outside resources/bibles.
#[tauri::command]
pub fn bible_all(
    app: AppHandle,
    dbs: State<'_, Databases>,
    translation: String,
    sql: String,
    params: Vec<Json>,
) -> Result<Vec<Map<String, Json>>, String> {
    if translation.is_empty() || !translation.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err("unknown translation".into());
    }
    let mut cache = dbs.bibles.lock().map_err(|_| "bible lock poisoned")?;
    if !cache.contains_key(&translation) {
        let path = app
            .path()
            .resolve(format!("bibles/{translation}.sqlite"), tauri::path::BaseDirectory::Resource)
            .map_err(|e| e.to_string())?;
        if !path.exists() {
            return Err("unknown translation".into());
        }
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
            .map_err(|e| e.to_string())?;
        cache.insert(translation.clone(), conn);
    }
    let conn = cache.get(&translation).ok_or("unknown translation")?;
    select(conn, &sql, &params)
}
