use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use sqlx::{Pool, Sqlite};
use crate::engine::screenshots::ScreenshotEntry;

pub async fn query_screenshots(
    pool: &Pool<Sqlite>,
    start_time: i64,
    end_time: i64,
    limit: Option<i64>,
) -> Result<Vec<ScreenshotEntry>, String> {
    let limit = limit.unwrap_or(500).clamp(1, 1000);

    let rows = sqlx::query_as::<_, (i64, i64, i64, i64, String, Option<i64>)>(
        "SELECT id, captured_at, width, height, thumbnail_base64, session_id
         FROM screenshots
         WHERE captured_at >= ?1 AND captured_at <= ?2
         ORDER BY captured_at ASC
         LIMIT ?3",
    )
    .bind(start_time)
    .bind(end_time)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("query: {e}"))?;

    Ok(rows
        .into_iter()
        .map(map_screenshot_row)
        .collect())
}

pub async fn get_screenshot_data(pool: &Pool<Sqlite>, id: i64) -> Result<String, String> {
    let file_path: String = sqlx::query_scalar("SELECT file_path FROM screenshots WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("query: {e}"))?
        .ok_or_else(|| format!("screenshot {id} not found"))?;

    let data = std::fs::read(&file_path).map_err(|e| format!("read: {e}"))?;
    Ok(BASE64.encode(data))
}

pub async fn get_screenshot_file_path(pool: &Pool<Sqlite>, id: i64) -> Result<String, String> {
    let file_path: String = sqlx::query_scalar("SELECT file_path FROM screenshots WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("query: {e}"))?
        .ok_or_else(|| format!("screenshot {id} not found"))?;
    Ok(file_path)
}

pub async fn reveal_screenshot_in_folder(pool: &Pool<Sqlite>, id: i64) -> Result<(), String> {
    let file_path = get_screenshot_file_path(pool, id).await?;
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("file not found: {file_path}"));
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| format!("failed to open explorer: {e}"))?;
    }

    #[cfg(not(windows))]
    {
        let _ = file_path;
        return Err("unsupported platform".into());
    }

    Ok(())
}

fn map_screenshot_row(row: (i64, i64, i64, i64, String, Option<i64>)) -> ScreenshotEntry {
    let (id, captured_at, width, height, thumb, session_id) = row;
    ScreenshotEntry {
        id,
        captured_at,
        width: width as u32,
        height: height as u32,
        thumbnail_base64: thumb,
        session_id,
    }
}
