pub mod common;
pub mod csv_exporter;
pub mod parquet_exporter;
pub mod sqlite_exporter;

use crate::data::sqlite_pool::wait_for_sqlite_pool;
use serde::Deserialize;
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDataRequest {
    pub format: String,
    pub output_path: String,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub selected_fields: Option<Vec<String>>,
}

pub async fn export_data(app: &AppHandle, request: ExportDataRequest) -> Result<u64, String> {
    common::validate_time_range(request.start_time, request.end_time)?;
    let pool = wait_for_sqlite_pool(app).await?;
    let selected_fields = request.selected_fields.as_deref();

    match request.format.as_str() {
        "csv" => {
            csv_exporter::export_to_csv(
                &pool,
                &request.output_path,
                request.start_time,
                request.end_time,
                selected_fields,
            )
            .await
        }
        "sqlite" => {
            sqlite_exporter::export_to_sqlite(
                &pool,
                &request.output_path,
                request.start_time,
                request.end_time,
                selected_fields,
            )
            .await
        }
        "parquet" => {
            parquet_exporter::export_to_parquet(
                &pool,
                &request.output_path,
                selected_fields,
                request.start_time,
                request.end_time,
            )
            .await
        }
        _ => Err(format!("unsupported export format: {}", request.format)),
    }
}

#[cfg(test)]
mod tests {
    use super::{csv_exporter, sqlite_exporter};
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::{Pool, Row, Sqlite};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    async fn source_pool() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("test source db should open");

        sqlx::query(
            "CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                exe_name TEXT NOT NULL,
                window_title TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration INTEGER
            )",
        )
        .execute(&pool)
        .await
        .expect("sessions table should be created");
        sqlx::query(
            "CREATE TABLE web_activity_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL,
                normalized_domain TEXT NOT NULL,
                url TEXT,
                title TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration INTEGER
            )",
        )
        .execute(&pool)
        .await
        .expect("web table should be created");

        pool
    }

    async fn insert_session(
        pool: &Pool<Sqlite>,
        app_name: &str,
        title: &str,
        start_time: i64,
        end_time: i64,
    ) {
        sqlx::query(
            "INSERT INTO sessions (app_name, exe_name, window_title, start_time, end_time, duration)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(app_name)
        .bind(format!("{}.exe", app_name.to_lowercase()))
        .bind(title)
        .bind(start_time)
        .bind(end_time)
        .bind(end_time - start_time)
        .execute(pool)
        .await
        .expect("session row should be inserted");
    }

    async fn insert_web(pool: &Pool<Sqlite>, title: &str, start_time: i64, end_time: i64) {
        sqlx::query(
            "INSERT INTO web_activity_segments
             (domain, normalized_domain, url, title, start_time, end_time, duration)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("example.com")
        .bind("example.com")
        .bind("https://example.com")
        .bind(title)
        .bind(start_time)
        .bind(end_time)
        .bind(end_time - start_time)
        .execute(pool)
        .await
        .expect("web row should be inserted");
    }

    fn output_path(extension: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "patina-export-test-{}-{suffix}.{extension}",
            std::process::id()
        ))
    }

    fn field_list(fields: &[&str]) -> Vec<String> {
        fields.iter().map(|field| field.to_string()).collect()
    }

    #[tokio::test]
    async fn csv_export_uses_overlap_range_and_sanitizes_text() {
        let pool = source_pool().await;
        insert_session(&pool, "Inside", "=cmd", 1_100, 1_200).await;
        insert_session(&pool, "BeforeOverlap", "+SUM(1,1)", 900, 1_050).await;
        insert_session(&pool, "AfterOverlap", "plain", 1_900, 2_300).await;
        insert_session(&pool, "Outside", "outside", 2_100, 2_200).await;
        insert_web(&pool, "  @HYPERLINK(\"x\")", 1_500, 1_600).await;

        let path = output_path("csv");
        let fields = field_list(&["record_type", "app_name", "window_title", "page_title"]);
        let row_count = csv_exporter::export_to_csv(
            &pool,
            path.to_str().expect("temp path should be utf-8"),
            Some(1_000),
            Some(2_000),
            Some(&fields),
        )
        .await
        .expect("csv export should succeed");

        let csv = std::fs::read_to_string(&path).expect("csv output should be readable");
        let _ = std::fs::remove_file(&path);

        assert_eq!(row_count, 4);
        assert!(csv.contains("'=cmd"));
        assert!(csv.contains("'+SUM(1,1)"));
        assert!(csv.contains("'  @HYPERLINK"));
        assert!(csv.contains("AfterOverlap"));
        assert!(!csv.contains("Outside"));
    }

    #[tokio::test]
    async fn sqlite_export_replaces_existing_file_without_appending() {
        let pool = source_pool().await;
        insert_session(&pool, "Inside", "plain", 1_100, 1_200).await;

        let path = output_path("db");
        let path_str = path.to_str().expect("temp path should be utf-8");
        let fields = field_list(&["record_type", "app_name"]);

        sqlite_exporter::export_to_sqlite(&pool, path_str, Some(1_000), Some(2_000), Some(&fields))
            .await
            .expect("first sqlite export should succeed");
        sqlite_exporter::export_to_sqlite(&pool, path_str, Some(1_000), Some(2_000), Some(&fields))
            .await
            .expect("second sqlite export should replace prior output");

        let options = SqliteConnectOptions::new().filename(&path).read_only(true);
        let exported = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("exported sqlite db should open");
        let count: i64 = sqlx::query("SELECT COUNT(*) AS count FROM sessions")
            .fetch_one(&exported)
            .await
            .expect("sessions count should be readable")
            .get("count");
        exported.close().await;
        let _ = std::fs::remove_file(&path);

        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn explicit_empty_field_selection_is_rejected_by_exporters() {
        let pool = source_pool().await;
        let fields: Vec<String> = Vec::new();
        let path = output_path("csv");

        let error = csv_exporter::export_to_csv(
            &pool,
            path.to_str().expect("temp path should be utf-8"),
            None,
            None,
            Some(&fields),
        )
        .await
        .expect_err("empty fields should be rejected");

        assert!(error.contains("select at least one export field"));
        assert!(!path.exists());
    }
}
