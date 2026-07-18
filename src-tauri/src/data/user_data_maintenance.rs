use crate::data::sqlite_error::SqliteOperationError;
use crate::data::sqlite_pool::run_recoverable_sqlite_write;
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Runtime};

pub async fn delete_sessions_before<R: Runtime>(
    app: &AppHandle<R>,
    cutoff_time: i64,
) -> Result<(), SqliteOperationError> {
    run_recoverable_sqlite_write(
        app,
        "failed to delete historical activity",
        move |pool| async move { delete_sessions_before_in_pool(&pool, cutoff_time).await },
    )
    .await
}

pub async fn clear_all_session_window_titles<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), SqliteOperationError> {
    run_recoverable_sqlite_write(
        app,
        "failed to clear session window titles",
        |pool| async move { clear_all_session_window_titles_in_pool(&pool).await },
    )
    .await
}

pub async fn delete_sessions_by_exe_names<R: Runtime>(
    app: &AppHandle<R>,
    exe_names: Vec<String>,
) -> Result<(), SqliteOperationError> {
    let exe_names = non_empty_values(exe_names);
    if exe_names.is_empty() {
        return Ok(());
    }

    run_recoverable_sqlite_write(
        app,
        "failed to delete sessions by executable",
        move |pool| {
            let exe_names = exe_names.clone();
            async move { delete_sessions_by_exe_names_in_pool(&pool, &exe_names).await }
        },
    )
    .await
}

pub async fn delete_sessions_by_exe_names_between<R: Runtime>(
    app: &AppHandle<R>,
    exe_names: Vec<String>,
    start_time: i64,
    end_time: i64,
) -> Result<(), SqliteOperationError> {
    let exe_names = non_empty_values(exe_names);
    if exe_names.is_empty() {
        return Ok(());
    }

    run_recoverable_sqlite_write(
        app,
        "failed to delete sessions by executable range",
        move |pool| {
            let exe_names = exe_names.clone();
            async move {
                delete_sessions_by_exe_names_between_in_pool(
                    &pool, &exe_names, start_time, end_time,
                )
                .await
            }
        },
    )
    .await
}

pub async fn delete_web_activity_segments_before<R: Runtime>(
    app: &AppHandle<R>,
    cutoff_time: i64,
) -> Result<(), SqliteOperationError> {
    run_recoverable_sqlite_write(app, "failed to delete web activity", move |pool| async move {
        delete_web_activity_segments_before_in_pool(&pool, cutoff_time).await
    })
    .await
}

pub async fn delete_web_activity_segments_by_domain<R: Runtime>(
    app: &AppHandle<R>,
    normalized_domain: String,
) -> Result<(), SqliteOperationError> {
    let normalized_domain = normalized_domain.trim().to_ascii_lowercase();
    if normalized_domain.is_empty() {
        return Ok(());
    }

    run_recoverable_sqlite_write(
        app,
        "failed to delete web activity by domain",
        move |pool| {
            let normalized_domain = normalized_domain.clone();
            async move {
                sqlx::query("DELETE FROM web_activity_segments WHERE normalized_domain = ?")
                    .bind(normalized_domain)
                    .execute(&pool)
                    .await
                    .map(|_| ())
                    .map_err(|error| {
                        SqliteOperationError::from_sqlx("delete web activity by domain", error)
                    })
            }
        },
    )
    .await
}

fn non_empty_values(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .filter(|value| !value.trim().is_empty())
        .collect()
}

fn in_clause_placeholders(value_count: usize) -> String {
    std::iter::repeat_n("?", value_count)
        .collect::<Vec<_>>()
        .join(", ")
}

async fn delete_sessions_before_in_pool(
    pool: &Pool<Sqlite>,
    cutoff_time: i64,
) -> Result<(), SqliteOperationError> {
    let mut tx = pool.begin().await.map_err(|error| {
        SqliteOperationError::from_sqlx("start historical activity cleanup", error)
    })?;

    sqlx::query(
        "DELETE FROM session_title_samples WHERE session_id IN (SELECT id FROM sessions WHERE start_time < ?)",
    )
    .bind(cutoff_time)
    .execute(&mut *tx)
    .await
    .map_err(|error| SqliteOperationError::from_sqlx("delete historical title samples", error))?;
    sqlx::query("DELETE FROM sessions WHERE start_time < ?")
        .bind(cutoff_time)
        .execute(&mut *tx)
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("delete historical sessions", error))?;
    sqlx::query("DELETE FROM import_exact_sessions WHERE start_time < ?")
        .bind(cutoff_time)
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            SqliteOperationError::from_sqlx("delete historical imported exact sessions", error)
        })?;
    sqlx::query("DELETE FROM import_time_buckets WHERE bucket_start_time < ?")
        .bind(cutoff_time)
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            SqliteOperationError::from_sqlx("delete historical imported time buckets", error)
        })?;
    sqlx::query("DELETE FROM web_activity_segments WHERE start_time < ?")
        .bind(cutoff_time)
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            SqliteOperationError::from_sqlx("delete historical web activity", error)
        })?;
    refresh_import_batch_counts(&mut tx).await?;

    tx.commit().await.map_err(|error| {
        SqliteOperationError::from_sqlx("commit historical activity cleanup", error)
    })
}

async fn clear_all_session_window_titles_in_pool(
    pool: &Pool<Sqlite>,
) -> Result<(), SqliteOperationError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("start title cleanup", error))?;

    sqlx::query("DELETE FROM session_title_samples")
        .execute(&mut *tx)
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("delete title samples", error))?;
    sqlx::query("UPDATE sessions SET window_title = '' WHERE COALESCE(window_title, '') <> ''")
        .execute(&mut *tx)
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("clear session window titles", error))?;
    sqlx::query(
        "UPDATE import_exact_sessions SET window_title = '' WHERE COALESCE(window_title, '') <> ''",
    )
    .execute(&mut *tx)
    .await
    .map_err(|error| {
        SqliteOperationError::from_sqlx("clear imported session window titles", error)
    })?;

    tx.commit()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("commit title cleanup", error))
}

async fn delete_sessions_by_exe_names_in_pool(
    pool: &Pool<Sqlite>,
    exe_names: &[String],
) -> Result<(), SqliteOperationError> {
    let placeholders = in_clause_placeholders(exe_names.len());
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("start app record deletion", error))?;

    let title_query = format!(
        "DELETE FROM session_title_samples
         WHERE session_id IN (SELECT id FROM sessions WHERE exe_name IN ({placeholders}))"
    );
    let mut title_query = sqlx::query(&title_query);
    for exe_name in exe_names {
        title_query = title_query.bind(exe_name);
    }
    title_query.execute(&mut *tx).await.map_err(|error| {
        SqliteOperationError::from_sqlx("delete app title samples by executable", error)
    })?;

    for (table, operation) in [
        ("sessions", "delete native app records by executable"),
        (
            "import_exact_sessions",
            "delete imported exact app records by executable",
        ),
        (
            "import_time_buckets",
            "delete imported bucket app records by executable",
        ),
    ] {
        let query = format!("DELETE FROM {table} WHERE exe_name IN ({placeholders})");
        let mut query = sqlx::query(&query);
        for exe_name in exe_names {
            query = query.bind(exe_name);
        }
        query
            .execute(&mut *tx)
            .await
            .map_err(|error| SqliteOperationError::from_sqlx(operation, error))?;
    }

    refresh_import_batch_counts(&mut tx).await?;
    tx.commit()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("commit app record deletion", error))
}

async fn delete_sessions_by_exe_names_between_in_pool(
    pool: &Pool<Sqlite>,
    exe_names: &[String],
    start_time: i64,
    end_time: i64,
) -> Result<(), SqliteOperationError> {
    let placeholders = in_clause_placeholders(exe_names.len());
    let mut tx = pool.begin().await.map_err(|error| {
        SqliteOperationError::from_sqlx("start ranged app record deletion", error)
    })?;

    let title_query = format!(
        "DELETE FROM session_title_samples
         WHERE session_id IN (
           SELECT id FROM sessions
           WHERE exe_name IN ({placeholders}) AND start_time >= ? AND start_time < ?
         )"
    );
    let mut title_query = sqlx::query(&title_query);
    for exe_name in exe_names {
        title_query = title_query.bind(exe_name);
    }
    title_query
        .bind(start_time)
        .bind(end_time)
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            SqliteOperationError::from_sqlx("delete ranged app title samples", error)
        })?;

    for (table, time_column, operation) in [
        ("sessions", "start_time", "delete ranged native app records"),
        (
            "import_exact_sessions",
            "start_time",
            "delete ranged imported exact app records",
        ),
        (
            "import_time_buckets",
            "bucket_start_time",
            "delete ranged imported bucket app records",
        ),
    ] {
        let query = format!(
            "DELETE FROM {table}
             WHERE exe_name IN ({placeholders}) AND {time_column} >= ? AND {time_column} < ?"
        );
        let mut query = sqlx::query(&query);
        for exe_name in exe_names {
            query = query.bind(exe_name);
        }
        query
            .bind(start_time)
            .bind(end_time)
            .execute(&mut *tx)
            .await
            .map_err(|error| SqliteOperationError::from_sqlx(operation, error))?;
    }

    refresh_import_batch_counts(&mut tx).await?;
    tx.commit().await.map_err(|error| {
        SqliteOperationError::from_sqlx("commit ranged app record deletion", error)
    })
}

async fn refresh_import_batch_counts(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
) -> Result<(), SqliteOperationError> {
    sqlx::query(
        "UPDATE import_batches
         SET exact_session_count = (
               SELECT COUNT(*) FROM import_exact_sessions
               WHERE import_exact_sessions.batch_id = import_batches.id
             ),
             hour_bucket_count = (
               SELECT COUNT(*) FROM import_time_buckets
               WHERE import_time_buckets.batch_id = import_batches.id
             )",
    )
    .execute(&mut **tx)
    .await
    .map_err(|error| SqliteOperationError::from_sqlx("refresh import batch counts", error))?;
    sqlx::query(
        "DELETE FROM import_batches
         WHERE exact_session_count = 0 AND hour_bucket_count = 0",
    )
    .execute(&mut **tx)
    .await
    .map(|_| ())
    .map_err(|error| SqliteOperationError::from_sqlx("delete empty import batches", error))
}

async fn delete_web_activity_segments_before_in_pool(
    pool: &Pool<Sqlite>,
    cutoff_time: i64,
) -> Result<(), SqliteOperationError> {
    sqlx::query("DELETE FROM web_activity_segments WHERE start_time < ?")
        .bind(cutoff_time)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| {
            SqliteOperationError::from_sqlx("delete web activity before cutoff", error)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::schema as db_schema;
    use sqlx::{Executor, Row, SqlitePool};

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        pool.execute(db_schema::CURRENT_BASELINE_SCHEMA_SQL)
            .await
            .unwrap();
        pool.execute(db_schema::WEB_ACTIVITY_SCHEMA_SQL)
            .await
            .unwrap();
        pool.execute(
            "CREATE TABLE import_batches (
                id TEXT PRIMARY KEY,
                imported_at INTEGER NOT NULL,
                source_name TEXT NOT NULL,
                source_kind TEXT NOT NULL,
                file_fingerprint TEXT NOT NULL UNIQUE,
                exact_session_count INTEGER NOT NULL DEFAULT 0,
                hour_bucket_count INTEGER NOT NULL DEFAULT 0
            )",
        )
        .await
        .unwrap();
        pool.execute(
            "CREATE TABLE import_exact_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                fingerprint TEXT NOT NULL UNIQUE,
                app_name TEXT NOT NULL,
                exe_name TEXT NOT NULL,
                window_title TEXT NOT NULL DEFAULT '',
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                source_category TEXT,
                source_path TEXT
            )",
        )
        .await
        .unwrap();
        pool.execute(
            "CREATE TABLE import_time_buckets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                fingerprint TEXT NOT NULL UNIQUE,
                app_name TEXT NOT NULL,
                exe_name TEXT NOT NULL,
                bucket_start_time INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                source_category TEXT,
                source_path TEXT
            )",
        )
        .await
        .unwrap();
        pool
    }

    #[test]
    fn delete_sessions_by_exe_names_uses_bound_values() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            sqlx::query(
                "INSERT INTO sessions (
                    app_name, exe_name, window_title, start_time, end_time, duration
                 ) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind("Browser")
            .bind("browser.exe")
            .bind("Inbox")
            .bind(1000_i64)
            .bind(2000_i64)
            .bind(1000_i64)
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO sessions (
                    app_name, exe_name, window_title, start_time, end_time, duration
                 ) VALUES ('Editor', 'editor.exe', 'Keep', 1000, 2000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_batches (
                    id, imported_at, source_name, source_kind, file_fingerprint,
                    exact_session_count, hour_bucket_count
                 ) VALUES ('batch-1', 1000, 'external.csv', 'patina-csv', 'batch-1', 1, 1)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_exact_sessions (
                    batch_id, fingerprint, app_name, exe_name, window_title,
                    start_time, end_time, duration
                 ) VALUES ('batch-1', 'exact-1', 'Browser', 'browser.exe', '', 1000, 2000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_time_buckets (
                    batch_id, fingerprint, app_name, exe_name, bucket_start_time, duration
                 ) VALUES ('batch-1', 'bucket-1', 'Editor', 'editor.exe', 0, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();

            delete_sessions_by_exe_names_in_pool(&pool, &[String::from("browser.exe")])
                .await
                .unwrap();

            let browser_count: i64 = sqlx::query(
                "SELECT COUNT(*) AS count FROM (
                   SELECT exe_name FROM sessions WHERE exe_name = 'browser.exe'
                   UNION ALL
                   SELECT exe_name FROM import_exact_sessions WHERE exe_name = 'browser.exe'
                   UNION ALL
                   SELECT exe_name FROM import_time_buckets WHERE exe_name = 'browser.exe'
                 )",
            )
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("count");
            let editor_native_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM sessions WHERE exe_name = 'editor.exe'")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let batch_row = sqlx::query(
                "SELECT exact_session_count, hour_bucket_count FROM import_batches WHERE id = 'batch-1'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(browser_count, 0);
            assert_eq!(editor_native_count, 1);
            assert_eq!(batch_row.get::<i64, _>("exact_session_count"), 0);
            assert_eq!(batch_row.get::<i64, _>("hour_bucket_count"), 1);
        });
    }

    #[test]
    fn historical_cleanup_treats_native_and_imported_records_consistently() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            for (id, start_time) in [(1_i64, 1000_i64), (2_i64, 5000_i64)] {
                sqlx::query(
                    "INSERT INTO sessions (
                        id, app_name, exe_name, window_title, start_time, end_time, duration
                     ) VALUES (?, 'Editor', 'editor.exe', '', ?, ?, 1000)",
                )
                .bind(id)
                .bind(start_time)
                .bind(start_time + 1000)
                .execute(&pool)
                .await
                .unwrap();
            }
            sqlx::query(
                "INSERT INTO import_batches (
                    id, imported_at, source_name, source_kind, file_fingerprint,
                    exact_session_count, hour_bucket_count
                 ) VALUES ('batch-1', 1000, 'external.csv', 'patina-csv', 'batch-cleanup', 2, 2)",
            )
            .execute(&pool)
            .await
            .unwrap();
            for (suffix, start_time) in [("old", 1000_i64), ("new", 5000_i64)] {
                sqlx::query(
                    "INSERT INTO import_exact_sessions (
                        batch_id, fingerprint, app_name, exe_name, window_title,
                        start_time, end_time, duration
                     ) VALUES ('batch-1', ?, 'Editor', 'editor.exe', '', ?, ?, 1000)",
                )
                .bind(format!("exact-{suffix}"))
                .bind(start_time)
                .bind(start_time + 1000)
                .execute(&pool)
                .await
                .unwrap();
                sqlx::query(
                    "INSERT INTO import_time_buckets (
                        batch_id, fingerprint, app_name, exe_name, bucket_start_time, duration
                     ) VALUES ('batch-1', ?, 'Editor', 'editor.exe', ?, 1000)",
                )
                .bind(format!("bucket-{suffix}"))
                .bind(start_time)
                .execute(&pool)
                .await
                .unwrap();
            }

            delete_sessions_before_in_pool(&pool, 3000).await.unwrap();

            let native_count: i64 = sqlx::query("SELECT COUNT(*) AS count FROM sessions")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get("count");
            let exact_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM import_exact_sessions")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let bucket_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM import_time_buckets")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let batch = sqlx::query(
                "SELECT exact_session_count, hour_bucket_count FROM import_batches WHERE id = 'batch-1'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(native_count, 1);
            assert_eq!(exact_count, 1);
            assert_eq!(bucket_count, 1);
            assert_eq!(batch.get::<i64, _>("exact_session_count"), 1);
            assert_eq!(batch.get::<i64, _>("hour_bucket_count"), 1);
        });
    }

    #[test]
    fn app_record_deletion_rolls_back_native_rows_when_external_delete_fails() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            sqlx::query(
                "INSERT INTO sessions (
                    app_name, exe_name, window_title, start_time, end_time, duration
                 ) VALUES ('Editor', 'editor.exe', 'Native', 1000, 2000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_exact_sessions (
                    batch_id, fingerprint, app_name, exe_name, window_title,
                    start_time, end_time, duration
                 ) VALUES ('batch-1', 'exact-rollback', 'Editor', 'editor.exe',
                           'Imported', 1000, 2000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "CREATE TRIGGER fail_external_app_delete
                 BEFORE DELETE ON import_exact_sessions
                 BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
            )
            .execute(&pool)
            .await
            .unwrap();

            assert!(
                delete_sessions_by_exe_names_in_pool(&pool, &[String::from("editor.exe")])
                    .await
                    .is_err()
            );

            let native_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM sessions WHERE exe_name = 'editor.exe'")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let external_count: i64 = sqlx::query(
                "SELECT COUNT(*) AS count FROM import_exact_sessions WHERE exe_name = 'editor.exe'",
            )
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("count");
            assert_eq!(native_count, 1);
            assert_eq!(external_count, 1);
        });
    }

    #[test]
    fn clear_all_session_window_titles_removes_sample_rows() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            sqlx::query(
                "INSERT INTO sessions (id, app_name, exe_name, window_title, start_time) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(1_i64)
            .bind("Editor")
            .bind("editor.exe")
            .bind("Project")
            .bind(1000_i64)
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO session_title_samples (session_id, title, start_time) VALUES (?, ?, ?)",
            )
            .bind(1_i64)
            .bind("Project")
            .bind(1000_i64)
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_batches (
                    id, imported_at, source_name, source_kind, file_fingerprint
                 ) VALUES (?, ?, ?, ?, ?)",
            )
            .bind("batch-1")
            .bind(1000_i64)
            .bind("external.csv")
            .bind("patina-csv")
            .bind("batch-fingerprint")
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_exact_sessions (
                    batch_id, fingerprint, app_name, exe_name, window_title,
                    start_time, end_time, duration
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind("batch-1")
            .bind("record-fingerprint")
            .bind("Imported Editor")
            .bind("editor.exe")
            .bind("Imported Project")
            .bind(2000_i64)
            .bind(3000_i64)
            .bind(1000_i64)
            .execute(&pool)
            .await
            .unwrap();

            clear_all_session_window_titles_in_pool(&pool)
                .await
                .unwrap();

            let title: String = sqlx::query("SELECT window_title FROM sessions WHERE id = 1")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get("window_title");
            let sample_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM session_title_samples")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let imported_row = sqlx::query(
                "SELECT window_title, duration FROM import_exact_sessions WHERE id = 1",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(title, "");
            assert_eq!(sample_count, 0);
            assert_eq!(imported_row.get::<String, _>("window_title"), "");
            assert_eq!(imported_row.get::<i64, _>("duration"), 1000);
        });
    }

    #[test]
    fn clear_all_session_window_titles_rolls_back_every_owner_on_failure() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;
            sqlx::query(
                "INSERT INTO sessions (id, app_name, exe_name, window_title, start_time)
                 VALUES (1, 'Editor', 'editor.exe', 'Native title', 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO session_title_samples (session_id, title, start_time)
                 VALUES (1, 'Native title', 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO import_exact_sessions (
                    batch_id, fingerprint, app_name, exe_name, window_title,
                    start_time, end_time, duration
                 ) VALUES ('batch-1', 'record-1', 'Imported', 'editor.exe',
                           'Imported title', 2000, 3000, 1000)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "CREATE TRIGGER fail_imported_title_cleanup
                 BEFORE UPDATE OF window_title ON import_exact_sessions
                 BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
            )
            .execute(&pool)
            .await
            .unwrap();

            assert!(clear_all_session_window_titles_in_pool(&pool)
                .await
                .is_err());

            let native_title: String =
                sqlx::query("SELECT window_title FROM sessions WHERE id = 1")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("window_title");
            let sample_count: i64 =
                sqlx::query("SELECT COUNT(*) AS count FROM session_title_samples")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("count");
            let imported_title: String =
                sqlx::query("SELECT window_title FROM import_exact_sessions WHERE id = 1")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    .get("window_title");
            assert_eq!(native_title, "Native title");
            assert_eq!(sample_count, 1);
            assert_eq!(imported_title, "Imported title");
        });
    }
}
