use chrono::DateTime;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const ALL_EXPORT_FIELDS: &[&str] = &[
    "record_type",
    "start_time",
    "end_time",
    "duration_ms",
    "app_name",
    "exe_name",
    "window_title",
    "domain",
    "normalized_domain",
    "url",
    "page_title",
];

pub fn resolve_export_fields(
    selected_fields: Option<&[String]>,
) -> Result<Vec<&'static str>, String> {
    let Some(selected_fields) = selected_fields else {
        return Ok(ALL_EXPORT_FIELDS.to_vec());
    };

    if selected_fields.is_empty() {
        return Err("select at least one export field".to_string());
    }

    let allowed: HashSet<&str> = ALL_EXPORT_FIELDS.iter().copied().collect();
    let mut seen = HashSet::new();
    let mut ordered = Vec::new();

    for field in selected_fields {
        if !allowed.contains(field.as_str()) {
            return Err(format!("unknown export field: {field}"));
        }

        if seen.insert(field.as_str()) {
            ordered.push(
                ALL_EXPORT_FIELDS
                    .iter()
                    .find(|candidate| **candidate == field.as_str())
                    .copied()
                    .expect("validated export field should exist"),
            );
        }
    }

    Ok(ordered)
}

pub fn validate_time_range(start_time: Option<i64>, end_time: Option<i64>) -> Result<(), String> {
    if let (Some(start_time), Some(end_time)) = (start_time, end_time) {
        if start_time >= end_time {
            return Err("export start time must be before end time".to_string());
        }
    }

    Ok(())
}

#[derive(Clone, Copy, Debug)]
pub struct ExportTimeFilter {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub effective_now_ms: i64,
}

pub fn build_overlap_where_clause(filter: ExportTimeFilter) -> (String, Vec<i64>) {
    match (filter.start_time, filter.end_time) {
        (Some(start_time), Some(end_time)) => (
            "WHERE start_time < ? AND COALESCE(end_time, ?) > ?".to_string(),
            vec![end_time, filter.effective_now_ms, start_time],
        ),
        (Some(start_time), None) => (
            "WHERE COALESCE(end_time, ?) > ?".to_string(),
            vec![filter.effective_now_ms, start_time],
        ),
        (None, Some(end_time)) => ("WHERE start_time < ?".to_string(), vec![end_time]),
        (None, None) => (String::new(), Vec::new()),
    }
}

pub fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default()
}

pub fn ms_to_datetime_str(ms: i64) -> String {
    let secs = ms / 1000;
    let millis = ms.rem_euclid(1000);
    let nanos = (millis * 1_000_000) as u32;
    let odt = DateTime::from_timestamp(secs, nanos)
        .unwrap_or_default()
        .with_timezone(&chrono::Local);
    odt.format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn sanitize_csv_text_for_excel(value: &str) -> String {
    let first_non_whitespace = value.chars().find(|ch| !ch.is_whitespace());
    if matches!(
        first_non_whitespace,
        Some('=') | Some('+') | Some('-') | Some('@')
    ) {
        format!("'{value}")
    } else {
        value.to_string()
    }
}

pub fn unique_temp_path(output_path: &str, extension: &str) -> Result<PathBuf, String> {
    let output = Path::new(output_path);
    let directory = output.parent().unwrap_or_else(|| Path::new("."));
    let file_name = output
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "output path must include a file name".to_string())?;
    let extension = extension.trim_start_matches('.');
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    Ok(directory.join(format!(
        ".{file_name}.tmp-{}-{suffix}.{extension}",
        std::process::id()
    )))
}

pub fn replace_output_file(temp_path: &Path, output_path: &str) -> Result<(), String> {
    let output_path = Path::new(output_path);
    if output_path.exists() {
        std::fs::remove_file(output_path)
            .map_err(|e| format!("failed to replace existing output file: {e}"))?;
    }

    std::fs::rename(temp_path, output_path)
        .map_err(|e| format!("failed to move export into place: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_user_field_selection_is_rejected() {
        let fields: Vec<String> = Vec::new();
        assert!(resolve_export_fields(Some(&fields)).is_err());
        assert_eq!(
            resolve_export_fields(None).unwrap(),
            ALL_EXPORT_FIELDS.to_vec()
        );
    }

    #[test]
    fn duplicate_export_fields_are_deduped_in_user_order() {
        let fields = vec![
            "url".to_string(),
            "url".to_string(),
            "record_type".to_string(),
        ];
        assert_eq!(
            resolve_export_fields(Some(&fields)).unwrap(),
            vec!["url", "record_type"]
        );
    }

    #[test]
    fn overlap_clause_matches_existing_read_model_shape() {
        let filter = ExportTimeFilter {
            start_time: Some(100),
            end_time: Some(200),
            effective_now_ms: 180,
        };

        assert_eq!(
            build_overlap_where_clause(filter),
            (
                "WHERE start_time < ? AND COALESCE(end_time, ?) > ?".to_string(),
                vec![200, 180, 100]
            )
        );
    }

    #[test]
    fn csv_excel_formula_prefixes_are_escaped_after_whitespace() {
        assert_eq!(sanitize_csv_text_for_excel("=1+1"), "'=1+1");
        assert_eq!(sanitize_csv_text_for_excel("  @cmd"), "'  @cmd");
        assert_eq!(sanitize_csv_text_for_excel("plain"), "plain");
    }

    #[test]
    fn invalid_time_range_is_rejected() {
        assert!(validate_time_range(Some(10), Some(10)).is_err());
        assert!(validate_time_range(Some(10), Some(11)).is_ok());
    }
}
