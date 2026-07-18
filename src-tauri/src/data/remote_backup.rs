use crate::data::backup;
use crate::domain::backup::BackupPreview;
use crate::platform::credentials;
use crate::platform::storage_paths;
use crate::platform::webdav::{normalize_remote_dir, WebDavClient, WebDavConfig};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::AppHandle;
use tokio::sync::Mutex;

const INDEX_FILE_NAME: &str = "backup-index.json";
const INDEX_VERSION: u32 = 1;
const INDEX_PRODUCT: &str = "Patina";
const MAX_BACKUP_LIST_ITEMS: usize = 50;
static REMOTE_BACKUP_COUNTER: AtomicU64 = AtomicU64::new(0);
static REMOTE_INDEX_LOCK: Mutex<()> = Mutex::const_new(());
static REMOTE_TRANSFER_LOCK: Mutex<()> = Mutex::const_new(());

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavBackupConfigDto {
    pub url: String,
    pub username: String,
    pub remote_dir: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavTestResult {
    pub ok: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBackupEntry {
    pub id: String,
    pub file_name: String,
    pub remote_path: String,
    pub created_at_ms: u64,
    pub size_bytes: u64,
    pub app_version: String,
    #[serde(default = "legacy_format_kind")]
    pub format_kind: String,
    pub backup_version: u32,
    pub schema_version: u32,
    pub session_count: usize,
    pub title_sample_count: usize,
    #[serde(default)]
    pub import_batch_count: usize,
    #[serde(default)]
    pub import_exact_session_count: usize,
    #[serde(default)]
    pub import_time_bucket_count: usize,
    pub setting_count: usize,
    pub icon_cache_count: usize,
}

fn legacy_format_kind() -> String {
    "legacy_structured".to_string()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteBackupIndex {
    version: u32,
    product: String,
    updated_at_ms: u64,
    backups: Vec<RemoteBackupEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBackupUploadResult {
    pub entry: RemoteBackupEntry,
    pub index_updated: bool,
    pub index_message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBackupDownloadResult {
    pub path: String,
    pub preview: BackupPreview,
}

fn config_to_webdav(config: WebDavBackupConfigDto) -> Result<WebDavConfig, String> {
    let username = config.username.trim().to_string();
    if username.is_empty() {
        return Err("WebDAV username cannot be empty".to_string());
    }

    Ok(WebDavConfig {
        url: config.url.trim().to_string(),
        username,
        remote_dir: normalize_remote_dir(&config.remote_dir)?,
    })
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn remote_backup_id() -> String {
    format!(
        "{}-{:04}",
        Local::now().format("%Y%m%d-%H%M%S-%3f"),
        REMOTE_BACKUP_COUNTER.fetch_add(1, Ordering::Relaxed) % 10_000
    )
}

fn remote_backup_file_name(id: &str) -> String {
    format!("Patina-backup-{id}.zip")
}

fn remote_path(remote_dir: &str, file_name: &str) -> String {
    format!("{remote_dir}/{file_name}")
}

fn index_path(remote_dir: &str) -> String {
    remote_path(remote_dir, INDEX_FILE_NAME)
}

fn parse_index(raw: &str) -> Result<RemoteBackupIndex, String> {
    let index: RemoteBackupIndex = serde_json::from_str(raw)
        .map_err(|error| format!("failed to parse WebDAV backup index: {error}"))?;
    if index.version != INDEX_VERSION {
        return Err(format!(
            "unsupported WebDAV backup index version {}",
            index.version
        ));
    }
    if index.product != INDEX_PRODUCT {
        return Err("WebDAV backup index belongs to another product".to_string());
    }
    Ok(index)
}

fn empty_index() -> RemoteBackupIndex {
    RemoteBackupIndex {
        version: INDEX_VERSION,
        product: INDEX_PRODUCT.to_string(),
        updated_at_ms: now_ms(),
        backups: Vec::new(),
    }
}

async fn load_index(client: &WebDavClient, remote_dir: &str) -> Result<RemoteBackupIndex, String> {
    match client.read_text_optional(&index_path(remote_dir)).await? {
        Some(raw) => parse_index(&raw),
        None => Ok(empty_index()),
    }
}

async fn save_index(
    client: &WebDavClient,
    remote_dir: &str,
    index: &RemoteBackupIndex,
) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(index)
        .map_err(|error| format!("failed to serialize WebDAV backup index: {error}"))?;
    client.write_text(&index_path(remote_dir), &raw).await
}

fn temp_backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = storage_paths::resolve_storage_paths(app)?.remote_backup_temp_dir;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create temp backup dir: {error}"))?;
    Ok(dir)
}

fn temp_backup_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    validate_backup_file_name(file_name)?;
    Ok(temp_backup_dir(app)?.join(file_name))
}

fn remove_empty_temp_backup_dir(temp_dir: &Path) -> Result<(), String> {
    match fs::remove_dir(temp_dir) {
        Ok(()) => Ok(()),
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::DirectoryNotEmpty
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(format!(
            "failed to delete empty remote backup temp directory: {error}"
        )),
    }
}

fn remove_temp_backup_file(path: &Path, temp_dir: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("failed to delete remote backup temp file: {error}")),
    }
    remove_empty_temp_backup_dir(temp_dir)
}

fn validate_backup_file_name(file_name: &str) -> Result<(), String> {
    let path = std::path::Path::new(file_name);
    if file_name.is_empty()
        || !file_name.ends_with(".zip")
        || path.file_name().and_then(|name| name.to_str()) != Some(file_name)
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.chars().any(|character| character.is_control())
    {
        return Err("WebDAV backup index contains an unsafe file name".to_string());
    }
    Ok(())
}

fn build_entry(
    id: String,
    file_name: String,
    remote_path: String,
    size_bytes: u64,
    preview: &BackupPreview,
) -> RemoteBackupEntry {
    RemoteBackupEntry {
        id,
        file_name,
        remote_path,
        created_at_ms: now_ms(),
        size_bytes,
        app_version: preview.app_version.clone(),
        format_kind: preview.format_kind.clone(),
        backup_version: preview.version,
        schema_version: preview.schema_version,
        session_count: preview.session_count,
        title_sample_count: preview.title_sample_count,
        import_batch_count: preview.import_batch_count,
        import_exact_session_count: preview.import_exact_session_count,
        import_time_bucket_count: preview.import_time_bucket_count,
        setting_count: preview.setting_count,
        icon_cache_count: preview.icon_cache_count,
    }
}

fn webdav_client(config: WebDavBackupConfigDto) -> Result<(WebDavConfig, WebDavClient), String> {
    let config = config_to_webdav(config)?;
    let password = credentials::read_webdav_backup_password()?
        .ok_or_else(|| "WebDAV password is missing".to_string())?;
    let client = WebDavClient::new(&config, password)?;
    Ok((config, client))
}

fn webdav_client_with_password(
    config: WebDavBackupConfigDto,
    password: Option<String>,
) -> Result<(WebDavConfig, WebDavClient), String> {
    let config = config_to_webdav(config)?;
    let password = match password {
        Some(password) if !password.is_empty() => password,
        _ => credentials::read_webdav_backup_password()?
            .ok_or_else(|| "WebDAV password is missing".to_string())?,
    };
    let client = WebDavClient::new(&config, password)?;
    Ok((config, client))
}

pub fn save_webdav_backup_secret(username: String, password: String) -> Result<(), String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("WebDAV username cannot be empty".to_string());
    }
    if password.is_empty() {
        return Err("WebDAV password cannot be empty".to_string());
    }
    credentials::save_webdav_backup_password(username, &password)
}

pub fn delete_webdav_backup_secret() -> Result<(), String> {
    credentials::delete_webdav_backup_password()
}

pub fn has_webdav_backup_secret() -> Result<bool, String> {
    credentials::has_webdav_backup_password()
}

pub fn reveal_webdav_backup_secret() -> Result<Option<String>, String> {
    credentials::read_webdav_backup_password()
}

pub async fn test_webdav_backup_target(
    config: WebDavBackupConfigDto,
    password: Option<String>,
) -> Result<WebDavTestResult, String> {
    let (config, client) = webdav_client_with_password(config, password)?;
    client.ping(&config.remote_dir).await?;
    Ok(WebDavTestResult { ok: true })
}

pub async fn upload_webdav_backup(
    app: AppHandle,
    config: WebDavBackupConfigDto,
) -> Result<RemoteBackupUploadResult, String> {
    let _transfer_guard = REMOTE_TRANSFER_LOCK.lock().await;
    let (config, client) = webdav_client(config)?;
    client.ensure_dir(&config.remote_dir).await?;

    let id = remote_backup_id();
    let file_name = remote_backup_file_name(&id);
    let local_path = temp_backup_path(&app, &file_name)?;
    let temp_dir = local_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "remote backup temp path has no parent directory".to_string())?;
    let local_path_string = local_path.to_string_lossy().to_string();
    let upload_result = async {
        backup::export_backup(Some(local_path_string.clone()), app).await?;
        let preview = backup::preview_backup(local_path_string).await?;
        let size_bytes = fs::metadata(&local_path)
            .map_err(|error| format!("failed to read local backup metadata: {error}"))?
            .len();
        let remote_path = remote_path(&config.remote_dir, &file_name);
        client.upload_file(&local_path, &remote_path).await?;
        Ok::<_, String>(build_entry(
            id,
            file_name,
            remote_path,
            size_bytes,
            &preview,
        ))
    }
    .await;
    let _ = remove_temp_backup_file(&local_path, &temp_dir);
    let entry = upload_result?;
    let _index_guard = REMOTE_INDEX_LOCK.lock().await;
    match load_index(&client, &config.remote_dir).await {
        Ok(mut index) => {
            index.backups.retain(|item| item.id != entry.id);
            index.backups.insert(0, entry.clone());
            index
                .backups
                .sort_by_key(|entry| Reverse(entry.created_at_ms));
            index.updated_at_ms = now_ms();
            match save_index(&client, &config.remote_dir, &index).await {
                Ok(()) => Ok(RemoteBackupUploadResult {
                    entry,
                    index_updated: true,
                    index_message: None,
                }),
                Err(error) => Ok(RemoteBackupUploadResult {
                    entry,
                    index_updated: false,
                    index_message: Some(error),
                }),
            }
        }
        Err(error) => Ok(RemoteBackupUploadResult {
            entry,
            index_updated: false,
            index_message: Some(error),
        }),
    }
}

pub async fn list_webdav_backups(
    config: WebDavBackupConfigDto,
) -> Result<Vec<RemoteBackupEntry>, String> {
    let (config, client) = webdav_client(config)?;
    let mut index = load_index(&client, &config.remote_dir).await?;
    index
        .backups
        .sort_by_key(|entry| Reverse(entry.created_at_ms));
    index.backups.truncate(MAX_BACKUP_LIST_ITEMS);
    Ok(index.backups)
}

pub async fn download_webdav_backup(
    app: AppHandle,
    config: WebDavBackupConfigDto,
    id: String,
) -> Result<RemoteBackupDownloadResult, String> {
    let _transfer_guard = REMOTE_TRANSFER_LOCK.lock().await;
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        return Err("remote backup id cannot be empty".to_string());
    }

    let (config, client) = webdav_client(config)?;
    let index = load_index(&client, &config.remote_dir).await?;
    let entry = index
        .backups
        .iter()
        .find(|entry| entry.id == trimmed_id)
        .ok_or_else(|| "remote backup was not found in the WebDAV index".to_string())?;
    validate_backup_file_name(&entry.file_name)?;
    let local_path = temp_backup_path(&app, &entry.file_name)?;
    let temp_dir = local_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "remote backup temp path has no parent directory".to_string())?;
    let trusted_remote_path = remote_path(&config.remote_dir, &entry.file_name);
    if let Err(error) = client
        .download_file(&trusted_remote_path, &local_path)
        .await
    {
        let _ = remove_temp_backup_file(&local_path, &temp_dir);
        return Err(error);
    }
    let local_path_string = local_path.to_string_lossy().to_string();
    let preview = match backup::preview_backup(local_path_string.clone()).await {
        Ok(preview) => preview,
        Err(error) => {
            let _ = remove_temp_backup_file(&local_path, &temp_dir);
            return Err(error);
        }
    };
    Ok(RemoteBackupDownloadResult {
        path: local_path_string,
        preview,
    })
}

pub(crate) fn cleanup_remote_backup_temp_if_owned(
    app: &AppHandle,
    raw_path: &str,
) -> Result<bool, String> {
    let path = PathBuf::from(raw_path);
    let temp_dir = storage_paths::resolve_storage_paths(app)?.remote_backup_temp_dir;
    if path.parent() != Some(temp_dir.as_path()) {
        return Ok(false);
    }
    validate_backup_file_name(
        path.file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "remote backup temp path has no valid file name".to_string())?,
    )?;
    remove_temp_backup_file(&path, &temp_dir)?;
    Ok(true)
}

pub fn delete_remote_backup_temp(app: AppHandle, raw_path: String) -> Result<(), String> {
    if cleanup_remote_backup_temp_if_owned(&app, &raw_path)? {
        Ok(())
    } else {
        Err("refusing to delete a file outside the remote backup temp directory".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        parse_index, remote_backup_file_name, remote_path, remove_temp_backup_file,
        validate_backup_file_name,
    };
    use std::fs;

    #[test]
    fn remote_file_name_uses_zip_format() {
        assert_eq!(
            remote_backup_file_name("20260603-213000"),
            "Patina-backup-20260603-213000.zip"
        );
    }

    #[test]
    fn temp_cleanup_removes_file_and_empty_directory() {
        let root = std::env::temp_dir().join(format!(
            "patina-remote-backup-cleanup-empty-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let backup_path = root.join("Patina-backup-test.zip");
        fs::write(&backup_path, b"backup").unwrap();

        remove_temp_backup_file(&backup_path, &root).unwrap();

        assert!(!backup_path.exists());
        assert!(!root.exists());
    }

    #[test]
    fn temp_cleanup_keeps_directory_with_another_transfer() {
        let root = std::env::temp_dir().join(format!(
            "patina-remote-backup-cleanup-nonempty-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let backup_path = root.join("Patina-backup-test.zip");
        let sibling_path = root.join("Patina-backup-other.zip");
        fs::write(&backup_path, b"backup").unwrap();
        fs::write(&sibling_path, b"other").unwrap();

        remove_temp_backup_file(&backup_path, &root).unwrap();

        assert!(!backup_path.exists());
        assert!(root.exists());
        assert!(sibling_path.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn remote_path_joins_normalized_dir_and_file() {
        assert_eq!(
            remote_path("/Patina/backups", "backup.zip"),
            "/Patina/backups/backup.zip"
        );
    }

    #[test]
    fn parse_index_rejects_time_tracker_product() {
        let raw = r#"{"version":1,"product":"Time Tracker","updatedAtMs":1,"backups":[]}"#;
        assert!(parse_index(raw).is_err());
    }

    #[test]
    fn parse_index_rejects_other_products() {
        let raw = r#"{"version":1,"product":"Other","updatedAtMs":1,"backups":[]}"#;
        assert!(parse_index(raw).is_err());
    }

    #[test]
    fn parse_old_index_defaults_external_counts_to_zero() {
        let raw = r#"{
            "version": 1,
            "product": "Patina",
            "updatedAtMs": 1,
            "backups": [{
                "id": "old",
                "fileName": "Patina-backup-old.zip",
                "remotePath": "/Patina/Patina-backup-old.zip",
                "createdAtMs": 1,
                "sizeBytes": 2,
                "appVersion": "1.8.3",
                "backupVersion": 1,
                "schemaVersion": 6,
                "sessionCount": 3,
                "titleSampleCount": 4,
                "settingCount": 5,
                "iconCacheCount": 6
            }]
        }"#;

        let index = parse_index(raw).unwrap();
        let entry = &index.backups[0];
        assert_eq!(entry.import_batch_count, 0);
        assert_eq!(entry.import_exact_session_count, 0);
        assert_eq!(entry.import_time_bucket_count, 0);
    }

    #[test]
    fn backup_file_name_rejects_path_traversal() {
        assert!(validate_backup_file_name("../outside.zip").is_err());
        assert!(validate_backup_file_name("C:\\outside.zip").is_err());
        assert!(validate_backup_file_name("safe.zip").is_ok());
    }
}
