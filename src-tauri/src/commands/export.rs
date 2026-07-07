use crate::engine::export::{self, ExportDataRequest};
use rfd::FileDialog;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDataResult {
    pub row_count: u64,
}

#[tauri::command]
pub fn cmd_pick_export_save_file(format: String, initial_path: Option<String>) -> Option<String> {
    let (filter_name, extensions, default_name) = match format.as_str() {
        "csv" => ("CSV files", vec!["csv"], "patina_export.csv"),
        "sqlite" => ("SQLite files", vec!["db", "sqlite"], "patina_export.db"),
        "parquet" => ("Parquet files", vec!["parquet"], "patina_export.parquet"),
        _ => return None,
    };
    let mut dialog = FileDialog::new()
        .add_filter(filter_name, &extensions)
        .set_file_name(default_name);
    if let Some(dir) = initial_path {
        if !dir.trim().is_empty() {
            dialog = dialog.set_directory(dir.trim());
        }
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cmd_export_data(
    request: ExportDataRequest,
    app: AppHandle,
) -> Result<ExportDataResult, String> {
    let row_count = export::export_data(&app, request).await?;
    Ok(ExportDataResult { row_count })
}
