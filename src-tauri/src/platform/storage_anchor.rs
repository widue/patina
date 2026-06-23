use crate::platform::app_paths;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

pub const DATA_ANCHOR_FORMAT: &str = "patina.data-anchor.v1";
pub const CACHE_ANCHOR_FORMAT: &str = "patina.cache-anchor.v1";
pub const STORAGE_MIGRATION_PENDING_FORMAT: &str = "patina.storage-migration-pending.v1";
pub const STORAGE_MAINTENANCE_STATE_FORMAT: &str = "patina.storage-maintenance-state.v1";
pub const WEBVIEW_CACHE_CLEAR_SOURCE_USER: &str = "user";

const DATA_ANCHOR_FILE_NAME: &str = "data-anchor.json";
const CACHE_ANCHOR_FILE_NAME: &str = "cache-anchor.json";
const STORAGE_MIGRATION_PENDING_FILE_NAME: &str = "storage-migration-pending.json";
const STORAGE_MAINTENANCE_STATE_FILE_NAME: &str = "storage-maintenance-state.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAnchor {
    pub format: String,
    pub profile: String,
    pub data_root: PathBuf,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheAnchor {
    pub format: String,
    pub profile: String,
    pub webview_root: PathBuf,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingStorageMigration {
    pub format: String,
    pub id: String,
    pub source_data_root: PathBuf,
    pub target_data_root: PathBuf,
    pub target_webview_root: PathBuf,
    pub created_at_ms: u64,
    pub state: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageMaintenanceState {
    pub format: String,
    pub last_webview_cache_trim_at_ms: Option<u64>,
    pub pending_webview_cache_clear: bool,
    pub pending_webview_cache_clear_source: Option<String>,
    pub last_maintenance_error: Option<String>,
    pub last_migration_status: Option<String>,
}

impl StorageMaintenanceState {
    pub fn new() -> Self {
        Self {
            format: STORAGE_MAINTENANCE_STATE_FORMAT.to_string(),
            ..Self::default()
        }
    }
}

pub fn data_anchor_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app_paths::product_roaming_data_dir(app)
}

pub fn cache_anchor_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app_paths::product_webview_data_dir(app)
}

pub fn anchor_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    data_anchor_dir(app)
}

pub fn data_anchor_path(anchor_dir: &Path) -> PathBuf {
    anchor_dir.join(DATA_ANCHOR_FILE_NAME)
}

pub fn cache_anchor_path(anchor_dir: &Path) -> PathBuf {
    anchor_dir.join(CACHE_ANCHOR_FILE_NAME)
}

pub fn pending_migration_path(anchor_dir: &Path) -> PathBuf {
    anchor_dir.join(STORAGE_MIGRATION_PENDING_FILE_NAME)
}

pub fn maintenance_state_path(anchor_dir: &Path) -> PathBuf {
    anchor_dir.join(STORAGE_MAINTENANCE_STATE_FILE_NAME)
}

pub fn read_data_anchor<R: Runtime>(app: &AppHandle<R>) -> Result<Option<DataAnchor>, String> {
    read_data_anchor_from_dir(&data_anchor_dir(app)?, app_paths::app_profile(app).key())
}

pub fn read_data_anchor_from_dir(
    anchor_dir: &Path,
    expected_profile: &str,
) -> Result<Option<DataAnchor>, String> {
    let Some(anchor) = read_json_optional::<DataAnchor>(&data_anchor_path(anchor_dir))? else {
        return Ok(None);
    };

    if anchor.format != DATA_ANCHOR_FORMAT {
        return Err(format!(
            "unsupported data anchor format `{}`",
            anchor.format
        ));
    }

    if anchor.profile != expected_profile {
        return Ok(None);
    }

    Ok(Some(anchor))
}

pub fn read_cache_anchor<R: Runtime>(app: &AppHandle<R>) -> Result<Option<CacheAnchor>, String> {
    read_cache_anchor_from_dir(&cache_anchor_dir(app)?, app_paths::app_profile(app).key())
}

pub fn read_cache_anchor_from_dir(
    anchor_dir: &Path,
    expected_profile: &str,
) -> Result<Option<CacheAnchor>, String> {
    let Some(anchor) = read_json_optional::<CacheAnchor>(&cache_anchor_path(anchor_dir))? else {
        return Ok(None);
    };

    if anchor.format != CACHE_ANCHOR_FORMAT {
        return Err(format!(
            "unsupported cache anchor format `{}`",
            anchor.format
        ));
    }

    if anchor.profile != expected_profile {
        return Ok(None);
    }

    Ok(Some(anchor))
}

pub fn write_data_anchor<R: Runtime>(app: &AppHandle<R>, data_root: PathBuf) -> Result<(), String> {
    let anchor = DataAnchor {
        format: DATA_ANCHOR_FORMAT.to_string(),
        profile: app_paths::app_profile(app).key().to_string(),
        data_root,
        updated_at_ms: now_ms(),
    };
    write_json_atomic(&data_anchor_path(&data_anchor_dir(app)?), &anchor)
}

pub fn write_cache_anchor<R: Runtime>(
    app: &AppHandle<R>,
    webview_root: PathBuf,
) -> Result<(), String> {
    let anchor = CacheAnchor {
        format: CACHE_ANCHOR_FORMAT.to_string(),
        profile: app_paths::app_profile(app).key().to_string(),
        webview_root,
        updated_at_ms: now_ms(),
    };
    write_json_atomic(&cache_anchor_path(&cache_anchor_dir(app)?), &anchor)
}

pub fn read_pending_migration<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<PendingStorageMigration>, String> {
    read_pending_migration_from_dir(&anchor_dir(app)?)
}

pub fn read_pending_migration_from_dir(
    anchor_dir: &Path,
) -> Result<Option<PendingStorageMigration>, String> {
    let Some(pending) =
        read_json_optional::<PendingStorageMigration>(&pending_migration_path(anchor_dir))?
    else {
        return Ok(None);
    };

    if pending.format != STORAGE_MIGRATION_PENDING_FORMAT {
        return Err(format!(
            "unsupported storage migration format `{}`",
            pending.format
        ));
    }

    Ok(Some(pending))
}

pub fn write_pending_migration<R: Runtime>(
    app: &AppHandle<R>,
    pending: &PendingStorageMigration,
) -> Result<(), String> {
    if pending.format != STORAGE_MIGRATION_PENDING_FORMAT {
        return Err("cannot write unsupported storage migration format".to_string());
    }
    write_json_atomic(&pending_migration_path(&anchor_dir(app)?), pending)
}

pub fn remove_pending_migration<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    remove_file_if_exists(&pending_migration_path(&anchor_dir(app)?))
}

pub fn remove_data_anchor<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    remove_file_if_exists(&data_anchor_path(&data_anchor_dir(app)?))
}

pub fn remove_cache_anchor<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    remove_file_if_exists(&cache_anchor_path(&cache_anchor_dir(app)?))
}

pub fn read_maintenance_state<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<StorageMaintenanceState, String> {
    read_maintenance_state_from_dir(&anchor_dir(app)?)
}

pub fn read_maintenance_state_from_dir(
    anchor_dir: &Path,
) -> Result<StorageMaintenanceState, String> {
    let Some(state) =
        read_json_optional::<StorageMaintenanceState>(&maintenance_state_path(anchor_dir))?
    else {
        return Ok(StorageMaintenanceState::new());
    };

    if state.format != STORAGE_MAINTENANCE_STATE_FORMAT {
        return Err(format!(
            "unsupported storage maintenance format `{}`",
            state.format
        ));
    }

    Ok(state)
}

pub fn write_maintenance_state<R: Runtime>(
    app: &AppHandle<R>,
    state: &StorageMaintenanceState,
) -> Result<(), String> {
    write_maintenance_state_to_dir(&anchor_dir(app)?, state)
}

pub fn write_maintenance_state_to_dir(
    anchor_dir: &Path,
    state: &StorageMaintenanceState,
) -> Result<(), String> {
    if state.format != STORAGE_MAINTENANCE_STATE_FORMAT {
        return Err("cannot write unsupported storage maintenance format".to_string());
    }
    let path = maintenance_state_path(anchor_dir);
    if !maintenance_state_requires_file(state) {
        return remove_file_if_exists(&path);
    }
    write_json_atomic(&path, state)
}

pub fn record_maintenance_error<R: Runtime>(
    app: &AppHandle<R>,
    message: String,
) -> Result<(), String> {
    let mut state = read_maintenance_state(app).unwrap_or_else(|_| StorageMaintenanceState::new());
    state.last_maintenance_error = Some(message);
    write_maintenance_state(app, &state)
}

pub fn set_pending_webview_cache_clear<R: Runtime>(
    app: &AppHandle<R>,
    pending_clear: bool,
) -> Result<StorageMaintenanceState, String> {
    let mut state = read_maintenance_state(app).unwrap_or_else(|_| StorageMaintenanceState::new());
    state.pending_webview_cache_clear = pending_clear;
    state.pending_webview_cache_clear_source =
        pending_clear.then(|| WEBVIEW_CACHE_CLEAR_SOURCE_USER.to_string());
    write_maintenance_state(app, &state)?;
    Ok(state)
}

pub fn mark_webview_cache_trimmed<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let mut state = read_maintenance_state(app).unwrap_or_else(|_| StorageMaintenanceState::new());
    state.pending_webview_cache_clear = false;
    state.pending_webview_cache_clear_source = None;
    state.last_webview_cache_trim_at_ms = Some(now_ms());
    state.last_maintenance_error = None;
    write_maintenance_state(app, &state)
}

pub fn record_migration_status<R: Runtime>(
    app: &AppHandle<R>,
    status: String,
) -> Result<(), String> {
    let mut state = read_maintenance_state(app).unwrap_or_else(|_| StorageMaintenanceState::new());
    state.last_migration_status = Some(status);
    state.last_maintenance_error = None;
    write_maintenance_state(app, &state)
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn maintenance_state_requires_file(state: &StorageMaintenanceState) -> bool {
    is_pending_webview_cache_clear(state) || state.last_maintenance_error.is_some()
}

pub fn is_pending_webview_cache_clear(state: &StorageMaintenanceState) -> bool {
    state.pending_webview_cache_clear
        && state.pending_webview_cache_clear_source.as_deref()
            == Some(WEBVIEW_CACHE_CLEAR_SOURCE_USER)
}

fn read_json_optional<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read `{}`: {error}", path.display()))?;
    serde_json::from_str::<T>(&raw)
        .map(Some)
        .map_err(|error| format!("failed to parse `{}`: {error}", path.display()))
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create `{}`: {error}", parent.display()))?;
    }

    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("failed to serialize `{}`: {error}", path.display()))?;
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, raw)
        .map_err(|error| format!("failed to write `{}`: {error}", temp_path.display()))?;
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("failed to replace `{}`: {error}", path.display()))?;
    }
    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!(
            "failed to replace `{}` with `{}`: {error}",
            path.display(),
            temp_path.display()
        )
    })
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to remove `{}`: {error}", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "patina-storage-anchor-{label}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn data_anchor_rejects_unsupported_format() {
        let dir = temp_dir("unsupported-format");
        fs::write(
            data_anchor_path(&dir),
            r#"{"format":"old","profile":"production","dataRoot":"D:\\Patina","updatedAtMs":1}"#,
        )
        .unwrap();

        let error = read_data_anchor_from_dir(&dir, "production").unwrap_err();
        let _ = fs::remove_dir_all(&dir);

        assert!(error.contains("unsupported data anchor format"));
    }

    #[test]
    fn cache_anchor_ignores_other_profiles() {
        let dir = temp_dir("profile");
        fs::write(
            cache_anchor_path(&dir),
            r#"{"format":"patina.cache-anchor.v1","profile":"dev","webviewRoot":"D:\\Patina\\EBWebView","updatedAtMs":1}"#,
        )
        .unwrap();

        let anchor = read_cache_anchor_from_dir(&dir, "production").unwrap();
        let _ = fs::remove_dir_all(&dir);

        assert!(anchor.is_none());
    }

    #[test]
    fn data_and_cache_anchor_paths_are_separate() {
        let dir = temp_dir("separate-paths");

        assert_eq!(data_anchor_path(&dir), dir.join("data-anchor.json"));
        assert_eq!(cache_anchor_path(&dir), dir.join("cache-anchor.json"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn completed_maintenance_state_does_not_create_file() {
        let dir = temp_dir("maintenance-completed");
        let mut state = StorageMaintenanceState::new();
        state.last_migration_status = Some("Storage migrated".to_string());
        state.last_webview_cache_trim_at_ms = Some(1);

        write_maintenance_state_to_dir(&dir, &state).unwrap();

        assert!(!maintenance_state_path(&dir).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pending_cache_clear_maintenance_state_is_persisted() {
        let dir = temp_dir("maintenance-pending-cache");
        let mut state = StorageMaintenanceState::new();
        state.pending_webview_cache_clear = true;
        state.pending_webview_cache_clear_source =
            Some(WEBVIEW_CACHE_CLEAR_SOURCE_USER.to_string());

        write_maintenance_state_to_dir(&dir, &state).unwrap();
        let restored = read_maintenance_state_from_dir(&dir).unwrap();

        assert!(maintenance_state_path(&dir).exists());
        assert!(is_pending_webview_cache_clear(&restored));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pending_cache_clear_without_source_is_treated_as_completed() {
        let dir = temp_dir("maintenance-stale-pending-cache");
        let mut state = StorageMaintenanceState::new();
        state.pending_webview_cache_clear = true;

        write_maintenance_state_to_dir(&dir, &state).unwrap();

        assert!(!maintenance_state_path(&dir).exists());
        assert!(!is_pending_webview_cache_clear(&state));
        let _ = fs::remove_dir_all(&dir);
    }
}
