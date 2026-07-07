use super::common::{
    build_overlap_where_clause, current_time_ms, ms_to_datetime_str, replace_output_file,
    resolve_export_fields, unique_temp_path, ExportTimeFilter,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteRow};
use sqlx::{Pool, Row, Sqlite};
use std::collections::HashSet;
use std::path::Path;

#[derive(Clone, Copy)]
enum ColumnKind {
    Text,
    TimeText,
    Integer,
    RecordType,
}

#[derive(Clone, Copy)]
struct ExportColumn {
    output_name: &'static str,
    source_name: Option<&'static str>,
    nullable: bool,
    kind: ColumnKind,
}

struct ResolvedFields {
    session_cols: Vec<ExportColumn>,
    web_cols: Vec<ExportColumn>,
}

pub async fn export_to_sqlite(
    pool: &Pool<Sqlite>,
    output_path: &str,
    start_time: Option<i64>,
    end_time: Option<i64>,
    selected_fields: Option<&[String]>,
) -> Result<u64, String> {
    let resolved = resolve_sqlite_fields(selected_fields)?;
    let temp_path = unique_temp_path(output_path, "db")?;
    let _ = std::fs::remove_file(&temp_path);

    let dst = open_output_db(&temp_path).await?;
    let filter = ExportTimeFilter {
        start_time,
        end_time,
        effective_now_ms: current_time_ms(),
    };

    let copy_result = async {
        let session_count = copy_sessions(pool, &dst, filter, &resolved).await?;
        let web_count = copy_web(pool, &dst, filter, &resolved).await?;
        Ok::<u64, String>((session_count + web_count) as u64)
    }
    .await;
    dst.close().await;

    let row_count = match copy_result {
        Ok(row_count) => row_count,
        Err(error) => {
            let _ = std::fs::remove_file(&temp_path);
            return Err(error);
        }
    };

    replace_output_file(&temp_path, output_path)?;
    Ok(row_count)
}

fn resolve_sqlite_fields(selected_fields: Option<&[String]>) -> Result<ResolvedFields, String> {
    let fields = resolve_export_fields(selected_fields)?;
    let mut session_cols = Vec::new();
    let mut web_cols = Vec::new();

    for field in fields {
        match field {
            "record_type" => {
                session_cols.push(record_type_col());
                web_cols.push(record_type_col());
            }
            "app_name" => session_cols.push(text_col("app_name", "app_name", false)),
            "exe_name" => session_cols.push(text_col("exe_name", "exe_name", false)),
            "window_title" => {
                session_cols.push(text_col("window_title", "window_title", true));
            }
            "domain" => web_cols.push(text_col("domain", "domain", false)),
            "normalized_domain" => {
                web_cols.push(text_col("normalized_domain", "normalized_domain", false));
            }
            "url" => web_cols.push(text_col("url", "url", true)),
            "page_title" => web_cols.push(text_col("page_title", "title", true)),
            "start_time" => {
                session_cols.push(time_col("start_time", "start_time", false));
                web_cols.push(time_col("start_time", "start_time", false));
            }
            "end_time" => {
                session_cols.push(time_col("end_time", "end_time", true));
                web_cols.push(time_col("end_time", "end_time", true));
            }
            "duration_ms" => {
                session_cols.push(integer_col("duration_ms", "duration", true));
                web_cols.push(integer_col("duration_ms", "duration", true));
            }
            _ => unreachable!("export fields are validated before mapping"),
        }
    }

    Ok(ResolvedFields {
        session_cols,
        web_cols,
    })
}

fn text_col(output_name: &'static str, source_name: &'static str, nullable: bool) -> ExportColumn {
    ExportColumn {
        output_name,
        source_name: Some(source_name),
        nullable,
        kind: ColumnKind::Text,
    }
}

fn time_col(output_name: &'static str, source_name: &'static str, nullable: bool) -> ExportColumn {
    ExportColumn {
        output_name,
        source_name: Some(source_name),
        nullable,
        kind: ColumnKind::TimeText,
    }
}

fn integer_col(
    output_name: &'static str,
    source_name: &'static str,
    nullable: bool,
) -> ExportColumn {
    ExportColumn {
        output_name,
        source_name: Some(source_name),
        nullable,
        kind: ColumnKind::Integer,
    }
}

fn record_type_col() -> ExportColumn {
    ExportColumn {
        output_name: "record_type",
        source_name: None,
        nullable: false,
        kind: ColumnKind::RecordType,
    }
}

async fn open_output_db(path: &Path) -> Result<Pool<Sqlite>, String> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true);

    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| format!("failed to create output database: {e}"))
}

fn fmt_col(column: &ExportColumn) -> String {
    match column.kind {
        ColumnKind::Integer => format!("{} INTEGER", column.output_name),
        ColumnKind::Text | ColumnKind::TimeText | ColumnKind::RecordType => {
            if column.nullable {
                format!("{} TEXT", column.output_name)
            } else {
                format!("{} TEXT NOT NULL", column.output_name)
            }
        }
    }
}

async fn copy_sessions(
    src: &Pool<Sqlite>,
    dst: &Pool<Sqlite>,
    filter: ExportTimeFilter,
    resolved: &ResolvedFields,
) -> Result<usize, String> {
    let mut tx = dst
        .begin()
        .await
        .map_err(|e| format!("begin sqlite export transaction: {e}"))?;

    create_table(&mut tx, "sessions", &resolved.session_cols).await?;
    if resolved.session_cols.is_empty() {
        tx.commit()
            .await
            .map_err(|e| format!("commit sessions export: {e}"))?;
        return Ok(0);
    }

    let source_cols = source_columns(&resolved.session_cols);
    let (query, params) = build_select_query("sessions", &source_cols, filter);
    let rows = fetch_rows(src, &query, params).await?;
    let insert_sql = build_insert_query("sessions", &resolved.session_cols);

    for row in &rows {
        let mut query = sqlx::query(&insert_sql);
        for column in &resolved.session_cols {
            query = match column.output_name {
                "record_type" => query.bind("session"),
                "app_name" | "exe_name" => {
                    let value: String = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                "window_title" => {
                    let value: Option<String> = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                "start_time" => {
                    let value: i64 = row.get(column.source_name.expect("source column"));
                    query.bind(ms_to_datetime_str(value))
                }
                "end_time" => {
                    let value: Option<i64> = row.get(column.source_name.expect("source column"));
                    query.bind(value.map(ms_to_datetime_str))
                }
                "duration_ms" => {
                    let value: Option<i64> = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                _ => unreachable!("session export column should be known"),
            };
        }
        query
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("insert session: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("commit sessions export: {e}"))?;
    Ok(rows.len())
}

async fn copy_web(
    src: &Pool<Sqlite>,
    dst: &Pool<Sqlite>,
    filter: ExportTimeFilter,
    resolved: &ResolvedFields,
) -> Result<usize, String> {
    let mut tx = dst
        .begin()
        .await
        .map_err(|e| format!("begin sqlite export transaction: {e}"))?;

    create_table(&mut tx, "web_activity_segments", &resolved.web_cols).await?;
    if resolved.web_cols.is_empty() {
        tx.commit()
            .await
            .map_err(|e| format!("commit web export: {e}"))?;
        return Ok(0);
    }

    let source_cols = source_columns(&resolved.web_cols);
    let (query, params) = build_select_query("web_activity_segments", &source_cols, filter);
    let rows = fetch_rows(src, &query, params).await?;
    let insert_sql = build_insert_query("web_activity_segments", &resolved.web_cols);

    for row in &rows {
        let mut query = sqlx::query(&insert_sql);
        for column in &resolved.web_cols {
            query = match column.output_name {
                "record_type" => query.bind("web"),
                "domain" | "normalized_domain" => {
                    let value: String = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                "url" | "page_title" => {
                    let value: Option<String> = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                "start_time" => {
                    let value: i64 = row.get(column.source_name.expect("source column"));
                    query.bind(ms_to_datetime_str(value))
                }
                "end_time" => {
                    let value: Option<i64> = row.get(column.source_name.expect("source column"));
                    query.bind(value.map(ms_to_datetime_str))
                }
                "duration_ms" => {
                    let value: Option<i64> = row.get(column.source_name.expect("source column"));
                    query.bind(value)
                }
                _ => unreachable!("web export column should be known"),
            };
        }
        query
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("insert web activity: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("commit web export: {e}"))?;
    Ok(rows.len())
}

async fn create_table(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    table: &str,
    columns: &[ExportColumn],
) -> Result<(), String> {
    let col_defs: Vec<String> = columns.iter().map(fmt_col).collect();
    let create_sql = if col_defs.is_empty() {
        format!("CREATE TABLE {table} (id INTEGER PRIMARY KEY AUTOINCREMENT)")
    } else {
        format!(
            "CREATE TABLE {table} (id INTEGER PRIMARY KEY AUTOINCREMENT, {})",
            col_defs.join(", ")
        )
    };

    sqlx::query(&create_sql)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("create {table}: {e}"))?;
    Ok(())
}

fn source_columns(columns: &[ExportColumn]) -> Vec<&'static str> {
    let mut seen = HashSet::new();
    let mut source_cols = Vec::new();
    for column in columns {
        if let Some(source_name) = column.source_name {
            if seen.insert(source_name) {
                source_cols.push(source_name);
            }
        }
    }
    source_cols
}

fn build_select_query(
    table: &str,
    source_cols: &[&str],
    filter: ExportTimeFilter,
) -> (String, Vec<i64>) {
    let select_cols = if source_cols.is_empty() {
        "id".to_string()
    } else {
        source_cols.join(", ")
    };
    let (clause, params) = build_overlap_where_clause(filter);
    (
        format!("SELECT {select_cols} FROM {table} {clause} ORDER BY id ASC"),
        params,
    )
}

fn build_insert_query(table: &str, columns: &[ExportColumn]) -> String {
    let insert_cols: Vec<&str> = columns.iter().map(|column| column.output_name).collect();
    let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();
    format!(
        "INSERT INTO {table} ({}) VALUES ({})",
        insert_cols.join(", "),
        placeholders.join(", ")
    )
}

async fn fetch_rows(
    pool: &Pool<Sqlite>,
    query: &str,
    params: Vec<i64>,
) -> Result<Vec<SqliteRow>, String> {
    let mut query = sqlx::query(query);
    for param in params {
        query = query.bind(param);
    }
    query
        .fetch_all(pool)
        .await
        .map_err(|e| format!("query failed: {e}"))
}
