import { invoke } from "@tauri-apps/api/core";

const PICK_EXPORT_FILE_COMMAND = "cmd_pick_export_save_file";
const EXPORT_DATA_COMMAND = "cmd_export_data";

export interface ExportDataRequest {
  format: string;
  outputPath: string;
  startTime?: number | null;
  endTime?: number | null;
  selectedFields?: string[] | null;
}

export interface ExportDataResult {
  rowCount: number;
}

export const DEFAULT_DATA_EXPORT_PROTOCOL_FIELDS = [
  "record_type",
  "category",
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
] as const;

export const ANALYSIS_DATA_EXPORT_PROTOCOL_FIELDS = [
  "category_id",
  "local_date",
  "local_week",
  "local_month",
  "weekday",
  "start_hour",
  "duration_minutes",
  "source_key",
  "source_name",
] as const;

export const ADVANCED_DATA_EXPORT_PROTOCOL_FIELDS = [
  "session_id",
  "web_segment_id",
  "continuity_group_start_time",
  "browser_client_id",
  "browser_kind",
  "browser_exe_name",
  "favicon_url",
  "web_source",
  "created_at",
  "updated_at",
  "category_color",
] as const;

export const DATA_EXPORT_PROTOCOL_FIELDS = [
  ...DEFAULT_DATA_EXPORT_PROTOCOL_FIELDS,
  ...ANALYSIS_DATA_EXPORT_PROTOCOL_FIELDS,
  ...ADVANCED_DATA_EXPORT_PROTOCOL_FIELDS,
] as const;

export type DataExportProtocolField = (typeof DATA_EXPORT_PROTOCOL_FIELDS)[number];

export async function pickExportSaveFile(format: string, initialPath?: string): Promise<string | null> {
  return invoke<string | null>(PICK_EXPORT_FILE_COMMAND, { format, initialPath: initialPath ?? null });
}

export async function exportData(request: ExportDataRequest): Promise<ExportDataResult> {
  return invoke<ExportDataResult>(EXPORT_DATA_COMMAND, { request });
}
