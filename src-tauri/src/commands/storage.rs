use crate::data::storage_migration;
use crate::domain::storage::{
    StorageMaintenanceSnapshot, StorageMigrationPreview, StorageMigrationRequest,
    StoragePathSnapshot, StoragePendingMigrationSnapshot, StorageSnapshot,
    WebviewCacheMigrationRequest,
};
use crate::platform::{storage_anchor, storage_paths, storage_usage, webview_cache};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub fn cmd_pick_storage_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cmd_get_storage_snapshot<R: Runtime>(
    app: AppHandle<R>,
) -> Result<StorageSnapshot, String> {
    storage_snapshot(&app)
}

#[tauri::command]
pub async fn cmd_get_webview_cache_snapshot<R: Runtime>(
    app: AppHandle<R>,
) -> Result<crate::domain::storage::WebviewCacheSnapshot, String> {
    webview_cache::webview_cache_snapshot(&app)
}

#[tauri::command]
pub async fn cmd_preview_storage_migration<R: Runtime>(
    app: AppHandle<R>,
    target_data_root: String,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::preview_storage_migration(&app, StorageMigrationRequest { target_data_root })
        .await
}

#[tauri::command]
pub async fn cmd_preview_webview_cache_migration<R: Runtime>(
    app: AppHandle<R>,
    target_webview_root: String,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::preview_webview_cache_migration(
        &app,
        WebviewCacheMigrationRequest {
            target_webview_root,
        },
    )
    .await
}

#[tauri::command]
pub async fn cmd_preview_restore_default_storage_migration<R: Runtime>(
    app: AppHandle<R>,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::preview_restore_default_storage_migration(&app).await
}

#[tauri::command]
pub async fn cmd_preview_restore_default_webview_cache_migration<R: Runtime>(
    app: AppHandle<R>,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::preview_restore_default_webview_cache_migration(&app).await
}

#[tauri::command]
pub async fn cmd_schedule_storage_migration(
    app: AppHandle,
    target_data_root: String,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::schedule_storage_migration(app, StorageMigrationRequest { target_data_root })
        .await
}

#[tauri::command]
pub async fn cmd_schedule_webview_cache_migration(
    app: AppHandle,
    target_webview_root: String,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::schedule_webview_cache_migration(
        app,
        WebviewCacheMigrationRequest {
            target_webview_root,
        },
    )
    .await
}

#[tauri::command]
pub async fn cmd_schedule_restore_default_storage_migration(
    app: AppHandle,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::schedule_restore_default_storage_migration(app).await
}

#[tauri::command]
pub async fn cmd_schedule_restore_default_webview_cache_migration(
    app: AppHandle,
) -> Result<StorageMigrationPreview, String> {
    storage_migration::schedule_restore_default_webview_cache_migration(app).await
}

#[tauri::command]
pub fn cmd_cancel_pending_storage_migration<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    storage_migration::cancel_pending_storage_migration(&app)
}

#[tauri::command]
pub fn cmd_schedule_webview_cache_clear<R: Runtime>(
    app: AppHandle<R>,
) -> Result<crate::domain::storage::WebviewCacheSnapshot, String> {
    webview_cache::schedule_webview_cache_clear(&app)
}

#[tauri::command]
pub fn cmd_open_storage_directory(path: String) -> Result<(), String> {
    open_directory(Path::new(&path))
}

fn storage_snapshot<R: Runtime>(app: &AppHandle<R>) -> Result<StorageSnapshot, String> {
    let paths = storage_paths::resolve_storage_paths(app)?;
    let install_dir = install_dir()?;
    let maintenance = storage_anchor::read_maintenance_state(app)
        .unwrap_or_else(|_| storage_anchor::StorageMaintenanceState::new());
    let pending = storage_anchor::read_pending_migration(app)
        .ok()
        .flatten()
        .map(|pending| StoragePendingMigrationSnapshot {
            id: pending.id,
            source_data_root: pending.source_data_root.to_string_lossy().to_string(),
            target_data_root: pending.target_data_root.to_string_lossy().to_string(),
            target_webview_root: pending.target_webview_root.to_string_lossy().to_string(),
            created_at_ms: pending.created_at_ms,
            state: pending.state,
        });

    Ok(StorageSnapshot {
        paths: StoragePathSnapshot {
            install_dir: install_dir.to_string_lossy().to_string(),
            data_root: paths.data_root.to_string_lossy().to_string(),
            database_path: paths.db_path.to_string_lossy().to_string(),
            backup_dir: paths.backup_dir.to_string_lossy().to_string(),
            remote_backup_temp_dir: paths.remote_backup_temp_dir.to_string_lossy().to_string(),
            webview_root: paths.webview_root.to_string_lossy().to_string(),
            is_custom_data_root: paths.is_custom_data_root,
            is_custom_webview_root: paths.is_custom_webview_root,
        },
        sizes: storage_usage::storage_size_snapshot(&install_dir, &paths),
        webview_cache: webview_cache::webview_cache_snapshot(app)?,
        maintenance: StorageMaintenanceSnapshot {
            last_error: maintenance.last_maintenance_error,
            last_migration_status: maintenance.last_migration_status,
        },
        pending_migration: pending,
    })
}

fn install_dir() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("failed to resolve current executable: {error}"))?;
    executable.parent().map(Path::to_path_buf).ok_or_else(|| {
        format!(
            "failed to resolve install directory for `{}`",
            executable.display()
        )
    })
}

fn open_directory(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("directory `{}` does not exist", path.display()));
    }
    if !path.is_dir() {
        return Err(format!("path `{}` is not a directory", path.display()));
    }

    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("failed to open `{}`: {error}", path.display()))
    }

    #[cfg(not(windows))]
    {
        Err("opening local directories is only supported on Windows".to_string())
    }
}
