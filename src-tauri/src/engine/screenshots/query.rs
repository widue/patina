use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use sqlx::{Pool, Sqlite};
use crate::engine::screenshots::ScreenshotEntry;

pub async fn query_screenshots(
    pool: &Pool<Sqlite>,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<ScreenshotEntry>, String> {
    let rows = sqlx::query_as::<_, (i64, i64, i64, i64, String, Option<i64>)>(
        "SELECT id, captured_at, width, height, thumbnail_base64, session_id
         FROM screenshots
         WHERE captured_at >= ?1 AND captured_at <= ?2
         ORDER BY captured_at ASC",
    )
    .bind(start_time)
    .bind(end_time)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("query: {e}"))?;

    Ok(rows
        .into_iter()
        .map(map_screenshot_row)
        .collect())
}

pub async fn query_screenshots_paginated(
    pool: &Pool<Sqlite>,
    start_time: i64,
    end_time: i64,
    page: i64,
    page_size: i64,
) -> Result<crate::engine::screenshots::ScreenshotQueryResult, String> {
    let page = page.max(1);
    let page_size = page_size.clamp(1, 500);
    let offset = (page - 1) * page_size;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM screenshots WHERE captured_at >= ?1 AND captured_at <= ?2",
    )
    .bind(start_time)
    .bind(end_time)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let rows = sqlx::query_as::<_, (i64, i64, i64, i64, String, Option<i64>)>(
        "SELECT id, captured_at, width, height, thumbnail_base64, session_id
         FROM screenshots
         WHERE captured_at >= ?1 AND captured_at <= ?2
         ORDER BY captured_at ASC
         LIMIT ?3 OFFSET ?4",
    )
    .bind(start_time)
    .bind(end_time)
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("query: {e}"))?;

    let items: Vec<ScreenshotEntry> = rows.into_iter().map(map_screenshot_row).collect();
    let items_count = items.len() as i64;
    let has_more = offset + items_count < total;

    Ok(crate::engine::screenshots::ScreenshotQueryResult {
        items,
        total,
        page,
        page_size,
        has_more,
    })
}

pub async fn count_screenshots(
    pool: &Pool<Sqlite>,
    start_time: i64,
    end_time: i64,
) -> Result<i64, String> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM screenshots WHERE captured_at >= ?1 AND captured_at <= ?2",
    )
    .bind(start_time)
    .bind(end_time)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    Ok(count)
}

pub async fn get_screenshot_stats(
    pool: &Pool<Sqlite>,
) -> Result<crate::engine::screenshots::ScreenshotStats, String> {
    let row: Option<(i64, Option<i64>, Option<i64>)> = sqlx::query_as(
        "SELECT COUNT(*), MIN(captured_at), MAX(captured_at) FROM screenshots",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("query stats: {e}"))?;

    let (total_count, oldest_captured_at, newest_captured_at) = row.unwrap_or((0, None, None));

    let total_bytes = estimate_total_bytes(pool, total_count).await;

    Ok(crate::engine::screenshots::ScreenshotStats {
        total_count,
        total_bytes,
        oldest_captured_at,
        newest_captured_at,
    })
}

async fn estimate_total_bytes(pool: &Pool<Sqlite>, count: i64) -> i64 {
    if count == 0 {
        return 0;
    }

    let avg_thumb_len: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(LENGTH(thumbnail_base64)) FROM screenshots LIMIT 100",
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(avg) = avg_thumb_len {
        let estimated_per_file = (avg * 0.75) as i64;
        let estimated_files = count * 150 * 1024;
        estimated_files.max(count * estimated_per_file / 3)
    } else {
        count * 300 * 1024
    }
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
