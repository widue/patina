use sqlx::{Pool, Sqlite};
use std::path::PathBuf;

pub async fn cleanup_old(pool: &Pool<Sqlite>, _dir: &PathBuf, retention_days: u64) {
    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64 - retention_days as i64 * 86_400_000)
        .unwrap_or(0);

    let rows: Vec<(i64, String)> =
        sqlx::query_as("SELECT id, file_path FROM screenshots WHERE captured_at < ?")
            .bind(cutoff)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    for (id, path) in &rows {
        let _ = std::fs::remove_file(path);
        let _ = sqlx::query("DELETE FROM screenshots WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await;
    }
}
