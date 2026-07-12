use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotSettings {
    pub enabled: bool,
    pub interval_secs: u64,
    pub retention_days: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotEntry {
    pub id: i64,
    pub captured_at: i64,
    pub width: u32,
    pub height: u32,
    pub thumbnail_base64: String,
    pub session_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotQueryResult {
    pub items: Vec<ScreenshotEntry>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotStats {
    pub total_count: i64,
    pub total_bytes: i64,
    pub oldest_captured_at: Option<i64>,
    pub newest_captured_at: Option<i64>,
}
