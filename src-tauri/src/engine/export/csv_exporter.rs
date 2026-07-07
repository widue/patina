use super::common::{
    build_overlap_where_clause, current_time_ms, ms_to_datetime_str, replace_output_file,
    resolve_export_fields, sanitize_csv_text_for_excel, unique_temp_path, ExportTimeFilter,
};
use sqlx::{Pool, Row, Sqlite};
use std::io::Write;

pub async fn export_to_csv(
    pool: &Pool<Sqlite>,
    output_path: &str,
    start_time: Option<i64>,
    end_time: Option<i64>,
    selected_fields: Option<&[String]>,
) -> Result<u64, String> {
    let fields = resolve_export_fields(selected_fields)?;
    let filter = ExportTimeFilter {
        start_time,
        end_time,
        effective_now_ms: current_time_ms(),
    };

    let sessions = load_sessions(pool, filter).await?;
    let web = load_web_activity(pool, filter).await?;
    let total_rows = (sessions.len() + web.len()) as u64;

    let temp_path = unique_temp_path(output_path, "csv")?;
    let write_result = (|| -> Result<(), String> {
        let mut file = std::fs::File::create(&temp_path)
            .map_err(|e| format!("failed to create output file: {e}"))?;
        file.write_all(&[0xEF, 0xBB, 0xBF])
            .map_err(|e| format!("failed to write BOM: {e}"))?;

        let mut writer = csv::Writer::from_writer(file);
        writer
            .write_record(&fields)
            .map_err(|e| format!("failed to write csv header: {e}"))?;

        let total = sessions.len() + web.len();
        for index in 0..total {
            let record: Vec<String> = fields
                .iter()
                .map(|field| get_csv_value(field, &sessions, &web, index))
                .collect();
            writer
                .write_record(&record)
                .map_err(|e| format!("failed to write csv row: {e}"))?;
        }

        writer
            .flush()
            .map_err(|e| format!("failed to flush csv writer: {e}"))?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error);
    }

    replace_output_file(&temp_path, output_path)?;
    Ok(total_rows)
}

#[derive(Clone, Debug)]
struct SessionRow {
    app_name: String,
    exe_name: String,
    window_title: Option<String>,
    start_time: i64,
    end_time: Option<i64>,
    duration: Option<i64>,
}

#[derive(Clone, Debug)]
struct WebRow {
    domain: String,
    normalized_domain: String,
    url: Option<String>,
    title: Option<String>,
    start_time: i64,
    end_time: Option<i64>,
    duration: Option<i64>,
}

fn csv_text(value: &str) -> String {
    sanitize_csv_text_for_excel(value)
}

fn get_csv_value(name: &str, sessions: &[SessionRow], web: &[WebRow], index: usize) -> String {
    if index < sessions.len() {
        let session = &sessions[index];
        match name {
            "record_type" => "session".to_string(),
            "app_name" => csv_text(&session.app_name),
            "exe_name" => csv_text(&session.exe_name),
            "window_title" => csv_text(session.window_title.as_deref().unwrap_or_default()),
            "domain" | "normalized_domain" | "url" | "page_title" => String::new(),
            "start_time" => ms_to_datetime_str(session.start_time),
            "end_time" => session.end_time.map(ms_to_datetime_str).unwrap_or_default(),
            "duration_ms" => session
                .duration
                .map(|duration| duration.to_string())
                .unwrap_or_default(),
            _ => String::new(),
        }
    } else {
        let row = &web[index - sessions.len()];
        match name {
            "record_type" => "web".to_string(),
            "app_name" | "exe_name" | "window_title" => String::new(),
            "domain" => csv_text(&row.domain),
            "normalized_domain" => csv_text(&row.normalized_domain),
            "url" => csv_text(row.url.as_deref().unwrap_or_default()),
            "page_title" => csv_text(row.title.as_deref().unwrap_or_default()),
            "start_time" => ms_to_datetime_str(row.start_time),
            "end_time" => row.end_time.map(ms_to_datetime_str).unwrap_or_default(),
            "duration_ms" => row
                .duration
                .map(|duration| duration.to_string())
                .unwrap_or_default(),
            _ => String::new(),
        }
    }
}

async fn load_sessions(
    pool: &Pool<Sqlite>,
    filter: ExportTimeFilter,
) -> Result<Vec<SessionRow>, String> {
    let (clause, params) = build_overlap_where_clause(filter);
    let sql = format!(
        "SELECT app_name, exe_name, window_title, start_time, end_time, duration
         FROM sessions {} ORDER BY id ASC",
        clause
    );
    let mut query = sqlx::query(&sql);
    for param in params {
        query = query.bind(param);
    }
    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| format!("failed to read sessions: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|row| SessionRow {
            app_name: row.get("app_name"),
            exe_name: row.get("exe_name"),
            window_title: row.get("window_title"),
            start_time: row.get("start_time"),
            end_time: row.get("end_time"),
            duration: row.get("duration"),
        })
        .collect())
}

async fn load_web_activity(
    pool: &Pool<Sqlite>,
    filter: ExportTimeFilter,
) -> Result<Vec<WebRow>, String> {
    let (clause, params) = build_overlap_where_clause(filter);
    let sql = format!(
        "SELECT domain, normalized_domain, url, title, start_time, end_time, duration
         FROM web_activity_segments {} ORDER BY id ASC",
        clause
    );
    let mut query = sqlx::query(&sql);
    for param in params {
        query = query.bind(param);
    }
    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| format!("failed to read web activity: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|row| WebRow {
            domain: row.get("domain"),
            normalized_domain: row.get("normalized_domain"),
            url: row.get("url"),
            title: row.get("title"),
            start_time: row.get("start_time"),
            end_time: row.get("end_time"),
            duration: row.get("duration"),
        })
        .collect())
}
