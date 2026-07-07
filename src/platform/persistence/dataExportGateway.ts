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

export const SHARED_FIELDS = ["record_type", "start_time", "end_time", "duration_ms"] as const;
export const SESSION_FIELDS = ["app_name", "exe_name", "window_title"] as const;
export const WEB_FIELDS = ["domain", "normalized_domain", "url", "page_title"] as const;

export const EXPORT_FIELD_KEYS = [
  ...SHARED_FIELDS,
  ...SESSION_FIELDS,
  ...WEB_FIELDS,
] as const;

export async function pickExportSaveFile(format: string, initialPath?: string): Promise<string | null> {
  return invoke<string | null>(PICK_EXPORT_FILE_COMMAND, { format, initialPath: initialPath ?? null });
}

export async function exportData(request: ExportDataRequest): Promise<ExportDataResult> {
  return invoke<ExportDataResult>(EXPORT_DATA_COMMAND, { request });
}
