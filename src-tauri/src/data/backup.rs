use crate::data::repositories;
use crate::data::sqlite_pool::wait_for_sqlite_pool;
use crate::domain::backup::{
    BackupMeta, BackupPayload, BackupPreview, CURRENT_BACKUP_SCHEMA_VERSION, CURRENT_BACKUP_VERSION,
};
use serde::Deserialize;
use sqlx::{Pool, Sqlite};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

mod archive;
mod paths;

use archive::{encode_backup_archive, read_backup_payload};
use paths::resolve_backup_path;

pub use paths::{pick_backup_file, pick_backup_save_file};

#[cfg(test)]
use archive::*;
#[cfg(test)]
use paths::backup_file_name_for_timestamp;
#[cfg(test)]
use std::collections::BTreeMap;
#[cfg(test)]
use std::io::{Cursor, Read};
#[cfg(test)]
use std::path::Path;
#[cfg(test)]
use zip::write::SimpleFileOptions;
#[cfg(test)]
use zip::{CompressionMethod, ZipArchive, ZipWriter};

async fn load_backup_payload<R: Runtime>(app: &AppHandle<R>) -> Result<BackupPayload, String> {
    let pool = wait_for_sqlite_pool(app).await?;
    let sessions = repositories::sessions::fetch_all_for_backup(&pool).await?;
    let title_samples = repositories::session_title_samples::fetch_all_for_backup(&pool).await?;
    let settings = repositories::settings::fetch_all_for_backup(&pool).await?;
    let icon_cache = repositories::icon_cache::fetch_all_for_backup(&pool).await?;
    let web_activity_segments = repositories::web_activity::fetch_all_for_backup(&pool).await?;
    let tool_reminders = repositories::tools::fetch_all_reminders_for_backup(&pool).await?;
    let tool_timers = repositories::tools::fetch_all_timers_for_backup(&pool).await?;
    let tool_timer_laps = repositories::tools::fetch_all_timer_laps_for_backup(&pool).await?;
    let tool_pomodoro_runs = repositories::tools::fetch_all_pomodoro_runs_for_backup(&pool).await?;
    let tool_daily_stats = repositories::tools::fetch_all_daily_stats_for_backup(&pool).await?;

    Ok(BackupPayload {
        version: CURRENT_BACKUP_VERSION,
        meta: BackupMeta {
            exported_at_ms: now_ms(),
            schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
        },
        sessions,
        title_samples,
        settings,
        icon_cache,
        web_activity_segments,
        tool_reminders,
        tool_timers,
        tool_timer_laps,
        tool_pomodoro_runs,
        tool_daily_stats,
    })
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RestoreStrategy {
    #[default]
    Replace,
    Merge,
}

pub async fn export_backup(backup_path: Option<String>, app: AppHandle) -> Result<String, String> {
    let payload = load_backup_payload(&app).await?;
    let target_path = resolve_backup_path(&app, backup_path)?;

    let archive = encode_backup_archive(&payload)?;
    fs::write(&target_path, archive)
        .map_err(|error| format!("failed to write backup file: {error}"))?;

    Ok(target_path.to_string_lossy().to_string())
}

pub async fn restore_backup(
    backup_path: String,
    app: AppHandle,
    strategy: RestoreStrategy,
) -> Result<(), String> {
    let backup_path = PathBuf::from(backup_path.trim());
    if backup_path.as_os_str().is_empty() {
        return Err("backup path cannot be empty".to_string());
    }

    let payload = read_backup_payload(&backup_path)?;
    let restore_safety = payload.restore_safety();
    if !restore_safety.supported {
        return Err(restore_safety.message);
    }

    let pool = wait_for_sqlite_pool(&app).await?;
    restore_backup_payload(&pool, &payload, strategy).await?;
    Ok(())
}

async fn restore_backup_payload(
    pool: &Pool<Sqlite>,
    payload: &BackupPayload,
    strategy: RestoreStrategy,
) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("failed to start restore transaction: {error}"))?;
    match strategy {
        RestoreStrategy::Replace => {
            repositories::session_title_samples::clear_for_restore(&mut tx).await?;
            repositories::sessions::clear_for_restore(&mut tx).await?;
            repositories::settings::clear_for_restore(&mut tx).await?;
            repositories::icon_cache::clear_for_restore(&mut tx).await?;
            repositories::web_activity::clear_for_restore(&mut tx).await?;
            repositories::tools::clear_for_restore(&mut tx).await?;

            repositories::sessions::insert_for_restore(&mut tx, &payload.sessions).await?;
            let session_id_map =
                repositories::sessions::resolve_restore_session_id_map(&mut tx, &payload.sessions)
                    .await?;
            repositories::session_title_samples::insert_for_restore(
                &mut tx,
                &payload.title_samples,
                &session_id_map,
            )
            .await?;
            repositories::settings::insert_for_restore(&mut tx, &payload.settings).await?;
            repositories::icon_cache::insert_for_restore(&mut tx, &payload.icon_cache).await?;
            repositories::web_activity::insert_for_restore(&mut tx, &payload.web_activity_segments)
                .await?;
            repositories::tools::insert_for_restore(
                &mut tx,
                &payload.tool_reminders,
                &payload.tool_timers,
                &payload.tool_timer_laps,
                &payload.tool_pomodoro_runs,
                &payload.tool_daily_stats,
            )
            .await?;
        }
        RestoreStrategy::Merge => {
            repositories::sessions::insert_missing_for_restore(&mut tx, &payload.sessions).await?;
            let session_id_map =
                repositories::sessions::resolve_restore_session_id_map(&mut tx, &payload.sessions)
                    .await?;
            repositories::session_title_samples::insert_missing_for_restore(
                &mut tx,
                &payload.title_samples,
                &session_id_map,
            )
            .await?;
            repositories::settings::insert_missing_for_restore(&mut tx, &payload.settings).await?;
            repositories::icon_cache::insert_missing_for_restore(&mut tx, &payload.icon_cache)
                .await?;
            repositories::web_activity::insert_missing_for_restore(
                &mut tx,
                &payload.web_activity_segments,
            )
            .await?;
            repositories::tools::insert_missing_for_restore(
                &mut tx,
                &payload.tool_reminders,
                &payload.tool_timers,
                &payload.tool_timer_laps,
                &payload.tool_pomodoro_runs,
                &payload.tool_daily_stats,
            )
            .await?;
        }
    }

    tx.commit()
        .await
        .map_err(|error| format!("failed to commit restore transaction: {error}"))?;
    Ok(())
}

pub async fn preview_backup(backup_path: String) -> Result<BackupPreview, String> {
    let backup_path = PathBuf::from(backup_path.trim());
    if backup_path.as_os_str().is_empty() {
        return Err("backup path cannot be empty".to_string());
    }

    let payload = read_backup_payload(&backup_path)?;

    Ok(payload.preview())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::schema as db_schema;
    use crate::domain::backup::{BackupIconCache, BackupSession, BackupSetting, BackupTitleSample};
    use sqlx::{Executor, SqlitePool};

    #[test]
    fn backup_file_name_uses_timestamp_zip_format() {
        assert_eq!(
            backup_file_name_for_timestamp("20260515-213045"),
            "Patina-backup-20260515-213045.zip"
        );
    }

    #[test]
    fn backup_archive_uses_manifest_data_and_checksums_layout() {
        let payload = BackupPayload {
            version: CURRENT_BACKUP_VERSION,
            meta: BackupMeta {
                exported_at_ms: 1_714_000_000_000,
                schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                app_version: "test".to_string(),
            },
            sessions: vec![BackupSession {
                id: 1,
                app_name: "App".to_string(),
                exe_name: "app.exe".to_string(),
                window_title: Some("Window".to_string()),
                start_time: 10,
                end_time: Some(20),
                duration: Some(10),
                continuity_group_start_time: Some(10),
            }],
            title_samples: vec![BackupTitleSample {
                id: 1,
                session_id: 1,
                title: "Window".to_string(),
                start_time: 10,
                end_time: Some(20),
            }],
            settings: vec![BackupSetting {
                key: "language".to_string(),
                value: "zh-CN".to_string(),
            }],
            icon_cache: vec![BackupIconCache {
                exe_name: "app.exe".to_string(),
                icon_base64: "aWNvbg==".to_string(),
                last_updated: Some(30),
            }],
            web_activity_segments: Vec::new(),
            tool_reminders: Vec::new(),
            tool_timers: Vec::new(),
            tool_timer_laps: Vec::new(),
            tool_pomodoro_runs: Vec::new(),
            tool_daily_stats: Vec::new(),
        };

        let archive = encode_backup_archive(&payload).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(archive)).unwrap();
        assert!(zip.by_name(BACKUP_MANIFEST_ENTRY_NAME).is_ok());
        let mut manifest_json = String::new();
        zip.by_name(BACKUP_MANIFEST_ENTRY_NAME)
            .unwrap()
            .read_to_string(&mut manifest_json)
            .unwrap();
        let manifest: BackupArchiveManifest =
            serde_json::from_str(&manifest_json).expect("manifest json");
        assert_eq!(manifest.format, BACKUP_FORMAT);
        assert!(zip.by_name(BACKUP_SESSIONS_ENTRY_NAME).is_ok());
        assert!(zip.by_name(BACKUP_TITLE_SAMPLES_ENTRY_NAME).is_ok());
        assert!(zip.by_name(BACKUP_SETTINGS_ENTRY_NAME).is_ok());
        assert!(zip.by_name(BACKUP_ICON_CACHE_ENTRY_NAME).is_ok());
        assert!(zip.by_name(BACKUP_WEB_ACTIVITY_SEGMENTS_ENTRY_NAME).is_ok());
        assert!(zip.by_name(BACKUP_CHECKSUMS_ENTRY_NAME).is_ok());
    }

    #[test]
    fn structured_backup_archive_round_trips_payload() {
        let payload = BackupPayload {
            version: CURRENT_BACKUP_VERSION,
            meta: BackupMeta {
                exported_at_ms: 1_714_000_000_000,
                schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                app_version: "test".to_string(),
            },
            sessions: vec![BackupSession {
                id: 1,
                app_name: "App".to_string(),
                exe_name: "app.exe".to_string(),
                window_title: Some("Window".to_string()),
                start_time: 10,
                end_time: Some(20),
                duration: Some(10),
                continuity_group_start_time: Some(10),
            }],
            title_samples: vec![BackupTitleSample {
                id: 1,
                session_id: 1,
                title: "Window".to_string(),
                start_time: 10,
                end_time: Some(20),
            }],
            settings: vec![BackupSetting {
                key: "language".to_string(),
                value: "zh-CN".to_string(),
            }],
            icon_cache: vec![BackupIconCache {
                exe_name: "app.exe".to_string(),
                icon_base64: "aWNvbg==".to_string(),
                last_updated: Some(30),
            }],
            web_activity_segments: Vec::new(),
            tool_reminders: Vec::new(),
            tool_timers: Vec::new(),
            tool_timer_laps: Vec::new(),
            tool_pomodoro_runs: Vec::new(),
            tool_daily_stats: Vec::new(),
        };

        let archive = encode_backup_archive(&payload).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(archive)).unwrap();
        let decoded = decode_structured_backup_archive(&mut zip, Path::new("backup.zip")).unwrap();
        assert_eq!(decoded.version, payload.version);
        assert_eq!(decoded.meta.exported_at_ms, payload.meta.exported_at_ms);
        assert_eq!(decoded.sessions.len(), 1);
        assert_eq!(decoded.title_samples.len(), 1);
        assert_eq!(decoded.settings.len(), 1);
        assert_eq!(decoded.icon_cache.len(), 1);
    }

    #[test]
    fn structured_backup_archive_without_title_samples_still_decodes() {
        let manifest = BackupArchiveManifest {
            format: BACKUP_FORMAT.to_string(),
            backup_version: CURRENT_BACKUP_VERSION,
            exported_at_ms: 1_714_000_000_000,
            schema_version: CURRENT_BACKUP_SCHEMA_VERSION - 1,
            app_version: "test".to_string(),
            files: BackupArchiveFiles {
                sessions: BACKUP_SESSIONS_ENTRY_NAME.to_string(),
                title_samples: String::new(),
                settings: BACKUP_SETTINGS_ENTRY_NAME.to_string(),
                icon_cache: BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                web_activity_segments: String::new(),
                tool_reminders: String::new(),
                tool_timers: String::new(),
                tool_timer_laps: String::new(),
                tool_pomodoro_runs: String::new(),
                tool_daily_stats: String::new(),
            },
            counts: BackupArchiveCounts {
                sessions: 0,
                title_samples: 0,
                settings: 0,
                icon_cache: 0,
                web_activity_segments: 0,
                tool_reminders: 0,
                tool_timers: 0,
                tool_timer_laps: 0,
                tool_pomodoro_runs: 0,
                tool_daily_stats: 0,
            },
        };
        let manifest_json = serialize_pretty(&manifest, "manifest").unwrap();
        let sessions = "[]";
        let settings = "[]";
        let icon_cache = "[]";
        let checksums = BackupArchiveChecksums {
            algorithm: "crc32".to_string(),
            files: BTreeMap::from([
                (
                    BACKUP_MANIFEST_ENTRY_NAME.to_string(),
                    checksum(&manifest_json),
                ),
                (BACKUP_SESSIONS_ENTRY_NAME.to_string(), checksum(sessions)),
                (BACKUP_SETTINGS_ENTRY_NAME.to_string(), checksum(settings)),
                (
                    BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                    checksum(icon_cache),
                ),
            ]),
        };
        let checksums_json = serialize_pretty(&checksums, "checksums").unwrap();
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip_write_file(
            &mut archive,
            BACKUP_MANIFEST_ENTRY_NAME,
            &manifest_json,
            options,
        )
        .unwrap();
        zip_write_file(&mut archive, BACKUP_SESSIONS_ENTRY_NAME, sessions, options).unwrap();
        zip_write_file(&mut archive, BACKUP_SETTINGS_ENTRY_NAME, settings, options).unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_ICON_CACHE_ENTRY_NAME,
            icon_cache,
            options,
        )
        .unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_CHECKSUMS_ENTRY_NAME,
            &checksums_json,
            options,
        )
        .unwrap();

        let archive_bytes = archive.finish().unwrap().into_inner();
        let mut zip = ZipArchive::new(Cursor::new(archive_bytes)).unwrap();
        let decoded = decode_structured_backup_archive(&mut zip, Path::new("backup.zip")).unwrap();

        assert!(decoded.title_samples.is_empty());
    }

    #[test]
    fn structured_backup_archive_rejects_time_tracker_format() {
        let manifest = BackupArchiveManifest {
            format: "TimeTrackerBackup".to_string(),
            backup_version: CURRENT_BACKUP_VERSION,
            exported_at_ms: 1_714_000_000_000,
            schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
            app_version: "test".to_string(),
            files: BackupArchiveFiles {
                sessions: BACKUP_SESSIONS_ENTRY_NAME.to_string(),
                title_samples: String::new(),
                settings: BACKUP_SETTINGS_ENTRY_NAME.to_string(),
                icon_cache: BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                web_activity_segments: String::new(),
                tool_reminders: String::new(),
                tool_timers: String::new(),
                tool_timer_laps: String::new(),
                tool_pomodoro_runs: String::new(),
                tool_daily_stats: String::new(),
            },
            counts: BackupArchiveCounts {
                sessions: 0,
                title_samples: 0,
                settings: 0,
                icon_cache: 0,
                web_activity_segments: 0,
                tool_reminders: 0,
                tool_timers: 0,
                tool_timer_laps: 0,
                tool_pomodoro_runs: 0,
                tool_daily_stats: 0,
            },
        };
        let manifest_json = serialize_pretty(&manifest, "manifest").unwrap();
        let sessions = "[]";
        let settings = "[]";
        let icon_cache = "[]";
        let checksums = BackupArchiveChecksums {
            algorithm: "crc32".to_string(),
            files: BTreeMap::from([
                (
                    BACKUP_MANIFEST_ENTRY_NAME.to_string(),
                    checksum(&manifest_json),
                ),
                (BACKUP_SESSIONS_ENTRY_NAME.to_string(), checksum(sessions)),
                (BACKUP_SETTINGS_ENTRY_NAME.to_string(), checksum(settings)),
                (
                    BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                    checksum(icon_cache),
                ),
            ]),
        };
        let checksums_json = serialize_pretty(&checksums, "checksums").unwrap();
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip_write_file(
            &mut archive,
            BACKUP_MANIFEST_ENTRY_NAME,
            &manifest_json,
            options,
        )
        .unwrap();
        zip_write_file(&mut archive, BACKUP_SESSIONS_ENTRY_NAME, sessions, options).unwrap();
        zip_write_file(&mut archive, BACKUP_SETTINGS_ENTRY_NAME, settings, options).unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_ICON_CACHE_ENTRY_NAME,
            icon_cache,
            options,
        )
        .unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_CHECKSUMS_ENTRY_NAME,
            &checksums_json,
            options,
        )
        .unwrap();

        let archive_bytes = archive.finish().unwrap().into_inner();
        let mut zip = ZipArchive::new(Cursor::new(archive_bytes)).unwrap();
        let error =
            decode_structured_backup_archive(&mut zip, Path::new("backup.zip")).unwrap_err();

        assert!(error.contains("unsupported format `TimeTrackerBackup`"));
    }

    #[test]
    fn structured_backup_archive_declaring_title_samples_requires_the_file() {
        let manifest = BackupArchiveManifest {
            format: BACKUP_FORMAT.to_string(),
            backup_version: CURRENT_BACKUP_VERSION,
            exported_at_ms: 1_714_000_000_000,
            schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
            app_version: "test".to_string(),
            files: BackupArchiveFiles {
                sessions: BACKUP_SESSIONS_ENTRY_NAME.to_string(),
                title_samples: BACKUP_TITLE_SAMPLES_ENTRY_NAME.to_string(),
                settings: BACKUP_SETTINGS_ENTRY_NAME.to_string(),
                icon_cache: BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                web_activity_segments: String::new(),
                tool_reminders: String::new(),
                tool_timers: String::new(),
                tool_timer_laps: String::new(),
                tool_pomodoro_runs: String::new(),
                tool_daily_stats: String::new(),
            },
            counts: BackupArchiveCounts {
                sessions: 0,
                title_samples: 1,
                settings: 0,
                icon_cache: 0,
                web_activity_segments: 0,
                tool_reminders: 0,
                tool_timers: 0,
                tool_timer_laps: 0,
                tool_pomodoro_runs: 0,
                tool_daily_stats: 0,
            },
        };
        let manifest_json = serialize_pretty(&manifest, "manifest").unwrap();
        let sessions = "[]";
        let settings = "[]";
        let icon_cache = "[]";
        let checksums = BackupArchiveChecksums {
            algorithm: "crc32".to_string(),
            files: BTreeMap::from([
                (
                    BACKUP_MANIFEST_ENTRY_NAME.to_string(),
                    checksum(&manifest_json),
                ),
                (BACKUP_SESSIONS_ENTRY_NAME.to_string(), checksum(sessions)),
                (BACKUP_TITLE_SAMPLES_ENTRY_NAME.to_string(), checksum("[]")),
                (BACKUP_SETTINGS_ENTRY_NAME.to_string(), checksum(settings)),
                (
                    BACKUP_ICON_CACHE_ENTRY_NAME.to_string(),
                    checksum(icon_cache),
                ),
            ]),
        };
        let checksums_json = serialize_pretty(&checksums, "checksums").unwrap();
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip_write_file(
            &mut archive,
            BACKUP_MANIFEST_ENTRY_NAME,
            &manifest_json,
            options,
        )
        .unwrap();
        zip_write_file(&mut archive, BACKUP_SESSIONS_ENTRY_NAME, sessions, options).unwrap();
        zip_write_file(&mut archive, BACKUP_SETTINGS_ENTRY_NAME, settings, options).unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_ICON_CACHE_ENTRY_NAME,
            icon_cache,
            options,
        )
        .unwrap();
        zip_write_file(
            &mut archive,
            BACKUP_CHECKSUMS_ENTRY_NAME,
            &checksums_json,
            options,
        )
        .unwrap();

        let archive_bytes = archive.finish().unwrap().into_inner();
        let mut zip = ZipArchive::new(Cursor::new(archive_bytes)).unwrap();
        let error =
            decode_structured_backup_archive(&mut zip, Path::new("backup.zip")).unwrap_err();

        assert!(error.contains(BACKUP_TITLE_SAMPLES_ENTRY_NAME));
    }

    #[test]
    fn plain_json_backup_payload_is_not_supported() {
        let backup_path = std::env::temp_dir().join(format!(
            "timetracker-legacy-json-{}.json",
            std::process::id()
        ));
        fs::write(&backup_path, r#"{"version":1}"#).unwrap();

        let error = read_backup_payload(&backup_path).unwrap_err();
        let _ = fs::remove_file(&backup_path);
        assert!(error.contains("not a supported structured Patina backup"));
    }

    #[test]
    fn legacy_zip_backup_json_payload_is_not_supported() {
        let backup_path =
            std::env::temp_dir().join(format!("timetracker-legacy-zip-{}.zip", std::process::id()));
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip_write_file(&mut archive, "backup.json", r#"{"version":1}"#, options).unwrap();
        let archive_bytes = archive.finish().unwrap().into_inner();
        fs::write(&backup_path, archive_bytes).unwrap();

        let error = read_backup_payload(&backup_path).unwrap_err();
        let _ = fs::remove_file(&backup_path);
        assert!(error.contains("not a supported structured Patina backup"));
    }

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        pool.execute(db_schema::CURRENT_BASELINE_SCHEMA_SQL)
            .await
            .unwrap();
        pool.execute(db_schema::TOOLS_TABLES_SCHEMA_SQL)
            .await
            .unwrap();
        pool.execute(db_schema::WEB_ACTIVITY_SCHEMA_SQL)
            .await
            .unwrap();
        pool.execute(db_schema::WEB_FAVICON_CACHE_SCHEMA_SQL)
            .await
            .unwrap();
        pool
    }

    #[test]
    fn restore_backup_payload_rolls_back_when_insert_fails() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO sessions (app_name, exe_name, window_title, start_time, end_time, duration)\n                 VALUES ('Baseline App', 'baseline.exe', 'Baseline Window', 1000, 2000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO settings (key, value) VALUES ('baseline_key', 'baseline_value')",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO icon_cache (exe_name, icon_base64, last_updated)\n                 VALUES ('baseline.exe', 'aWNvbg==', 1234)",
            )
            .execute(&pool)
            .await
            .unwrap();

            let bad_payload = BackupPayload {
                version: CURRENT_BACKUP_VERSION,
                meta: BackupMeta {
                    exported_at_ms: 1,
                    schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                    app_version: "test".to_string(),
                },
                sessions: vec![BackupSession {
                    id: 100,
                    app_name: "New App".to_string(),
                    exe_name: "new.exe".to_string(),
                    window_title: Some("New Window".to_string()),
                    start_time: 3000,
                    end_time: Some(4000),
                    duration: Some(1000),
                    continuity_group_start_time: Some(3000),
                }],
                title_samples: vec![BackupTitleSample {
                    id: 100,
                    session_id: 100,
                    title: "New Window".to_string(),
                    start_time: 3000,
                    end_time: Some(4000),
                }],
                settings: vec![
                    BackupSetting {
                        key: "dup_key".to_string(),
                        value: "v1".to_string(),
                    },
                    BackupSetting {
                        key: "dup_key".to_string(),
                        value: "v2".to_string(),
                    },
                ],
                icon_cache: vec![BackupIconCache {
                    exe_name: "new.exe".to_string(),
                    icon_base64: "bmV3aWNvbg==".to_string(),
                    last_updated: Some(5678),
                }],
                web_activity_segments: Vec::new(),
                tool_reminders: Vec::new(),
                tool_timers: Vec::new(),
                tool_timer_laps: Vec::new(),
                tool_pomodoro_runs: Vec::new(),
                tool_daily_stats: Vec::new(),
            };

            let result =
                restore_backup_payload(&pool, &bad_payload, RestoreStrategy::Replace).await;
            assert!(result.is_err());
            assert!(
                result.unwrap_err().contains("failed to restore settings"),
                "restore should fail in settings stage"
            );

            let session_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE exe_name = 'baseline.exe'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            let setting_value: Option<String> =
                sqlx::query_scalar("SELECT value FROM settings WHERE key = 'baseline_key' LIMIT 1")
                    .fetch_optional(&pool)
                    .await
                    .unwrap();
            let icon_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM icon_cache WHERE exe_name = 'baseline.exe'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();

            assert_eq!(session_count, 1, "original session should be preserved");
            assert_eq!(
                setting_value.as_deref(),
                Some("baseline_value"),
                "original setting should be preserved"
            );
            assert_eq!(icon_count, 1, "original icon cache should be preserved");
        });
    }

    #[test]
    fn replace_restore_restores_title_samples() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            let payload = BackupPayload {
                version: CURRENT_BACKUP_VERSION,
                meta: BackupMeta {
                    exported_at_ms: 1,
                    schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                    app_version: "test".to_string(),
                },
                sessions: vec![BackupSession {
                    id: 10,
                    app_name: "Editor".to_string(),
                    exe_name: "editor.exe".to_string(),
                    window_title: Some("Doc B".to_string()),
                    start_time: 1000,
                    end_time: Some(3000),
                    duration: Some(2000),
                    continuity_group_start_time: Some(1000),
                }],
                title_samples: vec![
                    BackupTitleSample {
                        id: 1,
                        session_id: 10,
                        title: "Doc A".to_string(),
                        start_time: 1000,
                        end_time: Some(2000),
                    },
                    BackupTitleSample {
                        id: 2,
                        session_id: 10,
                        title: "Doc B".to_string(),
                        start_time: 2000,
                        end_time: Some(3000),
                    },
                ],
                settings: Vec::new(),
                icon_cache: Vec::new(),
                web_activity_segments: Vec::new(),
                tool_reminders: Vec::new(),
                tool_timers: Vec::new(),
                tool_timer_laps: Vec::new(),
                tool_pomodoro_runs: Vec::new(),
                tool_daily_stats: Vec::new(),
            };

            restore_backup_payload(&pool, &payload, RestoreStrategy::Replace)
                .await
                .unwrap();

            let samples: Vec<(i64, String, i64, Option<i64>)> = sqlx::query_as(
                "SELECT session_id, title, start_time, end_time
                 FROM session_title_samples
                 ORDER BY id ASC",
            )
            .fetch_all(&pool)
            .await
            .unwrap();

            assert_eq!(
                samples,
                vec![
                    (10, "Doc A".to_string(), 1000, Some(2000)),
                    (10, "Doc B".to_string(), 2000, Some(3000)),
                ]
            );
        });
    }

    #[test]
    fn replace_restore_skips_orphan_title_samples() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            let payload = BackupPayload {
                version: CURRENT_BACKUP_VERSION,
                meta: BackupMeta {
                    exported_at_ms: 1,
                    schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                    app_version: "test".to_string(),
                },
                sessions: vec![BackupSession {
                    id: 10,
                    app_name: "Editor".to_string(),
                    exe_name: "editor.exe".to_string(),
                    window_title: Some("Doc".to_string()),
                    start_time: 1000,
                    end_time: Some(2000),
                    duration: Some(1000),
                    continuity_group_start_time: Some(1000),
                }],
                title_samples: vec![
                    BackupTitleSample {
                        id: 1,
                        session_id: 10,
                        title: "Doc".to_string(),
                        start_time: 1000,
                        end_time: Some(2000),
                    },
                    BackupTitleSample {
                        id: 2,
                        session_id: 99,
                        title: "Orphan".to_string(),
                        start_time: 1000,
                        end_time: Some(2000),
                    },
                ],
                settings: Vec::new(),
                icon_cache: Vec::new(),
                web_activity_segments: Vec::new(),
                tool_reminders: Vec::new(),
                tool_timers: Vec::new(),
                tool_timer_laps: Vec::new(),
                tool_pomodoro_runs: Vec::new(),
                tool_daily_stats: Vec::new(),
            };

            restore_backup_payload(&pool, &payload, RestoreStrategy::Replace)
                .await
                .unwrap();

            let samples: Vec<(i64, String)> = sqlx::query_as(
                "SELECT session_id, title
                 FROM session_title_samples
                 ORDER BY id ASC",
            )
            .fetch_all(&pool)
            .await
            .unwrap();

            assert_eq!(samples, vec![(10, "Doc".to_string())]);
        });
    }

    #[test]
    fn merge_restore_payload_preserves_existing_data_and_imports_missing_data() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO sessions (app_name, exe_name, window_title, start_time, end_time, duration, continuity_group_start_time)
                 VALUES ('Existing App', 'existing.exe', 'Existing Window', 1000, 2000, 1000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query("INSERT INTO settings (key, value) VALUES ('language', 'zh-CN')")
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query(
                "INSERT INTO icon_cache (exe_name, icon_base64, last_updated)
                 VALUES ('existing.exe', 'old', 1)",
            )
            .execute(&pool)
            .await
            .unwrap();

            let payload = BackupPayload {
                version: CURRENT_BACKUP_VERSION,
                meta: BackupMeta {
                    exported_at_ms: 1,
                    schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                    app_version: "test".to_string(),
                },
                sessions: vec![
                    BackupSession {
                        id: 1,
                        app_name: "Existing App".to_string(),
                        exe_name: "existing.exe".to_string(),
                        window_title: Some("Existing Window".to_string()),
                        start_time: 1000,
                        end_time: Some(2000),
                        duration: Some(1000),
                        continuity_group_start_time: Some(1000),
                    },
                    BackupSession {
                        id: 2,
                        app_name: "Imported App".to_string(),
                        exe_name: "imported.exe".to_string(),
                        window_title: Some("Imported Window".to_string()),
                        start_time: 3000,
                        end_time: Some(4000),
                        duration: Some(1000),
                        continuity_group_start_time: Some(3000),
                    },
                ],
                title_samples: vec![BackupTitleSample {
                    id: 1,
                    session_id: 2,
                    title: "Imported Window".to_string(),
                    start_time: 3000,
                    end_time: Some(4000),
                }],
                settings: vec![
                    BackupSetting {
                        key: "language".to_string(),
                        value: "en-US".to_string(),
                    },
                    BackupSetting {
                        key: "theme_mode".to_string(),
                        value: "dark".to_string(),
                    },
                ],
                icon_cache: vec![
                    BackupIconCache {
                        exe_name: "existing.exe".to_string(),
                        icon_base64: "new".to_string(),
                        last_updated: Some(2),
                    },
                    BackupIconCache {
                        exe_name: "imported.exe".to_string(),
                        icon_base64: "imported".to_string(),
                        last_updated: Some(3),
                    },
                ],
                web_activity_segments: Vec::new(),
                tool_reminders: Vec::new(),
                tool_timers: Vec::new(),
                tool_timer_laps: Vec::new(),
                tool_pomodoro_runs: Vec::new(),
                tool_daily_stats: Vec::new(),
            };

            restore_backup_payload(&pool, &payload, RestoreStrategy::Merge)
                .await
                .unwrap();

            let session_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
                .fetch_one(&pool)
                .await
                .unwrap();
            let language: String =
                sqlx::query_scalar("SELECT value FROM settings WHERE key = 'language'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            let theme_mode: String =
                sqlx::query_scalar("SELECT value FROM settings WHERE key = 'theme_mode'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            let existing_icon: String = sqlx::query_scalar(
                "SELECT icon_base64 FROM icon_cache WHERE exe_name = 'existing.exe'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            let imported_icon: String = sqlx::query_scalar(
                "SELECT icon_base64 FROM icon_cache WHERE exe_name = 'imported.exe'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();

            assert_eq!(session_count, 2);
            assert_eq!(language, "zh-CN");
            assert_eq!(theme_mode, "dark");
            assert_eq!(existing_icon, "old");
            assert_eq!(imported_icon, "imported");

            let title_sample_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM session_title_samples")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(title_sample_count, 1);

            restore_backup_payload(&pool, &payload, RestoreStrategy::Merge)
                .await
                .unwrap();
            let title_sample_count_after_second_restore: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM session_title_samples")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(title_sample_count_after_second_restore, 1);
        });
    }

    #[test]
    fn merge_restore_maps_title_samples_to_inserted_session_ids() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO sessions (id, app_name, exe_name, window_title, start_time, end_time, duration, continuity_group_start_time)
                 VALUES (2, 'Different App', 'different.exe', 'Different Window', 10, 20, 10, 10)",
            )
            .execute(&pool)
            .await
            .unwrap();

            let payload = BackupPayload {
                version: CURRENT_BACKUP_VERSION,
                meta: BackupMeta {
                    exported_at_ms: 1,
                    schema_version: CURRENT_BACKUP_SCHEMA_VERSION,
                    app_version: "test".to_string(),
                },
                sessions: vec![BackupSession {
                    id: 2,
                    app_name: "Imported App".to_string(),
                    exe_name: "imported.exe".to_string(),
                    window_title: Some("Imported Window".to_string()),
                    start_time: 3000,
                    end_time: Some(4000),
                    duration: Some(1000),
                    continuity_group_start_time: Some(3000),
                }],
                title_samples: vec![BackupTitleSample {
                    id: 8,
                    session_id: 2,
                    title: "Imported Window".to_string(),
                    start_time: 3000,
                    end_time: Some(4000),
                }],
                settings: Vec::new(),
                icon_cache: Vec::new(),
                web_activity_segments: Vec::new(),
                tool_reminders: Vec::new(),
                tool_timers: Vec::new(),
                tool_timer_laps: Vec::new(),
                tool_pomodoro_runs: Vec::new(),
                tool_daily_stats: Vec::new(),
            };

            restore_backup_payload(&pool, &payload, RestoreStrategy::Merge)
                .await
                .unwrap();

            let restored: (i64, String) = sqlx::query_as(
                "SELECT samples.session_id, sessions.exe_name
                 FROM session_title_samples samples
                 JOIN sessions ON sessions.id = samples.session_id
                 WHERE samples.title = 'Imported Window'
                 LIMIT 1",
            )
            .fetch_one(&pool)
            .await
            .unwrap();

            assert_ne!(restored.0, 2);
            assert_eq!(restored.1, "imported.exe");
        });
    }
}
