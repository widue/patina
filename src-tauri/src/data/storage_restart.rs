use crate::data::storage_migration::{checkpoint_current_database, timestamp_for_file};
use crate::platform::{storage_anchor, storage_paths};
use tauri::{AppHandle, Runtime};

const RESTART_OPERATION_PREPARED: &str = "pending-restart";

pub fn switch_anchors<R: Runtime>(
    app: &AppHandle<R>,
    pending: &storage_anchor::PendingStorageMigration,
    source: &storage_paths::StoragePaths,
    target_data_is_custom: bool,
    target_webview_is_custom: bool,
) -> Result<(), String> {
    storage_anchor::switch_storage_anchors(
        app,
        storage_anchor::anchor_selection(
            pending.source_data_root.clone(),
            source.is_custom_data_root,
        ),
        storage_anchor::anchor_selection(pending.target_data_root.clone(), target_data_is_custom),
        storage_anchor::anchor_selection(
            source.webview_root.clone(),
            source.is_custom_webview_root,
        ),
        storage_anchor::anchor_selection(
            pending.target_webview_root.clone(),
            target_webview_is_custom,
        ),
    )
}

pub async fn schedule_webview_cache_clear(app: AppHandle) -> Result<(), String> {
    let current = storage_paths::resolve_storage_paths(&app)?;
    if storage_anchor::read_pending_migration(&app)?.is_some() {
        return Err("another storage restart operation is already pending".to_string());
    }

    checkpoint_current_database(&app).await?;
    let pending = storage_anchor::PendingStorageMigration {
        format: storage_anchor::STORAGE_MIGRATION_PENDING_FORMAT.to_string(),
        id: timestamp_for_file(),
        source_data_root: current.data_root.clone(),
        target_data_root: current.data_root,
        target_webview_root: current.webview_root,
        created_at_ms: storage_anchor::now_ms(),
        state: RESTART_OPERATION_PREPARED.to_string(),
        clear_webview_cache: true,
    };
    storage_anchor::write_pending_migration(&app, &pending)?;

    let persisted = storage_anchor::read_pending_migration(&app)?
        .ok_or_else(|| "cache clear restart operation was not persisted".to_string())?;
    if persisted.id != pending.id || !persisted.clear_webview_cache {
        let _ = storage_anchor::remove_pending_migration(&app);
        return Err("cache clear restart operation verification failed".to_string());
    }
    Ok(())
}
