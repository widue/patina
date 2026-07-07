use super::common::{
    build_overlap_where_clause, current_time_ms, ms_to_datetime_str, replace_output_file,
    resolve_export_fields, unique_temp_path, ExportTimeFilter,
};
use arrow::array::{Int64Array, StringArray};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use parquet::arrow::ArrowWriter;
use parquet::file::properties::WriterProperties;
use sqlx::{Pool, Row, Sqlite};
use std::sync::Arc;

pub async fn export_to_parquet(
    pool: &Pool<Sqlite>,
    output_path: &str,
    selected_fields: Option<&[String]>,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> Result<u64, String> {
    let fields = resolve_export_fields(selected_fields)?;
    let schema = Schema::new(
        fields
            .iter()
            .map(|name| {
                Field::new(
                    *name,
                    field_data_type(name),
                    !field_is_always_not_null(name),
                )
            })
            .collect::<Vec<_>>(),
    );
    let filter = ExportTimeFilter {
        start_time,
        end_time,
        effective_now_ms: current_time_ms(),
    };

    let sessions = load_sessions(pool, filter).await?;
    let web = load_web_activity(pool, filter).await?;
    let total_rows = (sessions.len() + web.len()) as u64;
    let batch = build_record_batch(&fields, schema, &sessions, &web)?;

    let temp_path = unique_temp_path(output_path, "parquet")?;
    let write_result = (|| -> Result<(), String> {
        let file = std::fs::File::create(&temp_path)
            .map_err(|e| format!("failed to create output file: {e}"))?;
        let props = WriterProperties::builder().build();
        let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))
            .map_err(|e| format!("failed to create parquet writer: {e}"))?;
        writer
            .write(&batch)
            .map_err(|e| format!("failed to write parquet: {e}"))?;
        writer
            .close()
            .map_err(|e| format!("failed to close parquet writer: {e}"))?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error);
    }

    replace_output_file(&temp_path, output_path)?;
    Ok(total_rows)
}

fn field_data_type(name: &str) -> DataType {
    match name {
        "record_type" | "exe_name" | "app_name" | "window_title" | "domain"
        | "normalized_domain" | "url" | "page_title" | "start_time" | "end_time" => DataType::Utf8,
        "duration_ms" => DataType::Int64,
        _ => unreachable!("export fields are validated before schema creation"),
    }
}

fn field_is_always_not_null(name: &str) -> bool {
    matches!(name, "record_type")
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

fn build_record_batch(
    fields: &[&str],
    schema: Schema,
    sessions: &[SessionRow],
    web: &[WebRow],
) -> Result<RecordBatch, String> {
    let num_rows = sessions.len() + web.len();
    let mut columns: Vec<Arc<dyn arrow::array::Array>> = Vec::with_capacity(fields.len());
    let null_str: Vec<Option<&str>> = vec![None; num_rows];

    for &name in fields {
        let array: Arc<dyn arrow::array::Array> = match name {
            "record_type" => {
                let mut values: Vec<&str> = Vec::with_capacity(num_rows);
                values.extend(sessions.iter().map(|_| "session"));
                values.extend(web.iter().map(|_| "web"));
                Arc::new(StringArray::from(values))
            }
            "exe_name" => {
                let values: Vec<Option<&str>> = sessions
                    .iter()
                    .map(|row| Some(row.exe_name.as_str()))
                    .chain(null_str.iter().copied().take(web.len()))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "app_name" => {
                let values: Vec<Option<&str>> = sessions
                    .iter()
                    .map(|row| {
                        let value = row.app_name.trim();
                        if value.is_empty() {
                            None
                        } else {
                            Some(value)
                        }
                    })
                    .chain(null_str.iter().copied().take(web.len()))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "window_title" => {
                let values: Vec<Option<&str>> = sessions
                    .iter()
                    .map(|row| row.window_title.as_deref())
                    .chain(null_str.iter().copied().take(web.len()))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "domain" => {
                let values: Vec<Option<&str>> = null_str
                    .iter()
                    .copied()
                    .take(sessions.len())
                    .chain(web.iter().map(|row| Some(row.domain.as_str())))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "normalized_domain" => {
                let values: Vec<Option<&str>> = null_str
                    .iter()
                    .copied()
                    .take(sessions.len())
                    .chain(web.iter().map(|row| Some(row.normalized_domain.as_str())))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "url" => {
                let values: Vec<Option<&str>> = null_str
                    .iter()
                    .copied()
                    .take(sessions.len())
                    .chain(web.iter().map(|row| row.url.as_deref()))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "page_title" => {
                let values: Vec<Option<&str>> = null_str
                    .iter()
                    .copied()
                    .take(sessions.len())
                    .chain(web.iter().map(|row| row.title.as_deref()))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "start_time" => {
                let values: Vec<Option<String>> = sessions
                    .iter()
                    .map(|row| Some(ms_to_datetime_str(row.start_time)))
                    .chain(
                        web.iter()
                            .map(|row| Some(ms_to_datetime_str(row.start_time))),
                    )
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "end_time" => {
                let values: Vec<Option<String>> = sessions
                    .iter()
                    .map(|row| row.end_time.map(ms_to_datetime_str))
                    .chain(web.iter().map(|row| row.end_time.map(ms_to_datetime_str)))
                    .collect();
                Arc::new(StringArray::from(values))
            }
            "duration_ms" => {
                let values: Vec<Option<i64>> = sessions
                    .iter()
                    .map(|row| row.duration)
                    .chain(web.iter().map(|row| row.duration))
                    .collect();
                Arc::new(Int64Array::from(values))
            }
            _ => unreachable!("export fields are validated before array creation"),
        };
        columns.push(array);
    }

    RecordBatch::try_new(Arc::new(schema), columns)
        .map_err(|e| format!("failed to create record batch: {e}"))
}
