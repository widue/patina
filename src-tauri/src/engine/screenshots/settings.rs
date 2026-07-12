use sqlx::{Pool, Sqlite};
use crate::engine::screenshots::{SCREENSHOTS_ENABLED, ScreenshotSettings};
use std::sync::atomic::Ordering;

const DEFAULT_INTERVAL_SECS: u64 = 60;
const DEFAULT_RETENTION_DAYS: u64 = 7;

pub async fn load_settings(pool: &Pool<Sqlite>) -> ScreenshotSettings {
    let enabled = get_setting(pool, "screenshots_enabled")
        .await
        .map(|v| parse_bool_setting(&v))
        .unwrap_or(false);
    let interval_secs = get_setting(pool, "screenshots_interval_secs")
        .await
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_INTERVAL_SECS);
    let retention_days = get_setting(pool, "screenshots_retention_days")
        .await
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_RETENTION_DAYS);
    ScreenshotSettings {
        enabled,
        interval_secs,
        retention_days,
    }
}

pub async fn save_settings(pool: &Pool<Sqlite>, settings: &ScreenshotSettings) -> Result<(), String> {
    set_setting(pool, "screenshots_enabled", if settings.enabled { "true" } else { "false" }).await;
    set_setting(pool, "screenshots_interval_secs", &settings.interval_secs.to_string()).await;
    set_setting(pool, "screenshots_retention_days", &settings.retention_days.to_string()).await;
    SCREENSHOTS_ENABLED.store(settings.enabled, Ordering::Relaxed);
    Ok(())
}

fn parse_bool_setting(value: &str) -> bool {
    let normalized = value.trim().to_lowercase();
    matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
}

async fn get_setting(pool: &Pool<Sqlite>, key: &str) -> Option<String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn set_setting(pool: &Pool<Sqlite>, key: &str, value: &str) {
    let _ = sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await;
}
