import { invoke } from "@tauri-apps/api/core";

export interface ImportPreviewError {
  line: number;
  message: string;
}

export interface ImportPreview {
  filePath: string;
  fileName: string;
  fileFingerprint: string;
  validRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  exactSessions: number;
  hourBuckets: number;
  errors: ImportPreviewError[];
}

export interface ImportCommitReport {
  batchId: string | null;
  importedRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  exactSessions: number;
  hourBuckets: number;
}

export interface ImportBatch {
  id: string;
  importedAt: number;
  sourceName: string;
  sourceKind: string;
  exactSessions: number;
  hourBuckets: number;
  totalRecords: number;
}

export interface ImportDeleteReport {
  deletedExactSessions: number;
  deletedHourBuckets: number;
}

export interface DestructureReport {
  sourceKind: string;
  outputPath: string;
  recordsWritten: number;
  skippedRecords: number;
  exactSessions: number;
  hourBuckets: number;
  warnings: ImportPreviewError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number" && Number.isFinite(record[key]);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function isPreviewError(value: unknown): value is ImportPreviewError {
  return isRecord(value) && hasNumber(value, "line") && hasString(value, "message");
}

export function parseImportPreview(value: unknown): ImportPreview {
  if (!isRecord(value)
    || !hasString(value, "filePath")
    || !hasString(value, "fileName")
    || !hasString(value, "fileFingerprint")
    || !hasNumber(value, "validRecords")
    || !hasNumber(value, "duplicateRecords")
    || !hasNumber(value, "errorRecords")
    || !hasNumber(value, "exactSessions")
    || !hasNumber(value, "hourBuckets")
    || !Array.isArray(value.errors)
    || !value.errors.every(isPreviewError)) {
    throw new Error("Received invalid import preview payload");
  }
  return value as unknown as ImportPreview;
}

export function parseImportBatches(value: unknown): ImportBatch[] {
  if (!Array.isArray(value) || !value.every((item) => isRecord(item)
    && hasString(item, "id")
    && hasNumber(item, "importedAt")
    && hasString(item, "sourceName")
    && hasString(item, "sourceKind")
    && hasNumber(item, "exactSessions")
    && hasNumber(item, "hourBuckets")
    && hasNumber(item, "totalRecords"))) {
    throw new Error("Received invalid import batch payload");
  }
  return value as ImportBatch[];
}

function parseCommitReport(value: unknown): ImportCommitReport {
  if (!isRecord(value)
    || !(value.batchId === null || typeof value.batchId === "string")
    || !hasNumber(value, "importedRecords")
    || !hasNumber(value, "duplicateRecords")
    || !hasNumber(value, "errorRecords")
    || !hasNumber(value, "exactSessions")
    || !hasNumber(value, "hourBuckets")) {
    throw new Error("Received invalid import commit payload");
  }
  return value as unknown as ImportCommitReport;
}

function parseDeleteReport(value: unknown): ImportDeleteReport {
  if (!isRecord(value)
    || !hasNumber(value, "deletedExactSessions")
    || !hasNumber(value, "deletedHourBuckets")) {
    throw new Error("Received invalid import deletion payload");
  }
  return value as unknown as ImportDeleteReport;
}

function parseDestructureReport(value: unknown): DestructureReport {
  if (!isRecord(value)
    || !hasString(value, "sourceKind")
    || !hasString(value, "outputPath")
    || !hasNumber(value, "recordsWritten")
    || !hasNumber(value, "skippedRecords")
    || !hasNumber(value, "exactSessions")
    || !hasNumber(value, "hourBuckets")
    || !Array.isArray(value.warnings)
    || !value.warnings.every(isPreviewError)) {
    throw new Error("Received invalid destructure payload");
  }
  return value as unknown as DestructureReport;
}

export function pickCanonicalImportFile(initialPath?: string): Promise<string | null> {
  return invoke("cmd_pick_canonical_import_file", { initialPath: initialPath ?? null });
}

export function pickExternalImportFile(initialPath?: string): Promise<string | null> {
  return invoke("cmd_pick_external_import_file", { initialPath: initialPath ?? null });
}

export async function previewCanonicalImport(filePath: string): Promise<ImportPreview> {
  return parseImportPreview(await invoke("cmd_preview_canonical_import", { filePath }));
}

export async function commitCanonicalImport(preview: ImportPreview): Promise<ImportCommitReport> {
  return parseCommitReport(await invoke("cmd_commit_canonical_import", {
    filePath: preview.filePath,
    expectedFingerprint: preview.fileFingerprint,
  }));
}

export async function destructureExternalData(filePath: string): Promise<DestructureReport> {
  return parseDestructureReport(await invoke("cmd_destructure_external_data", { filePath }));
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  return parseImportBatches(await invoke("cmd_list_import_batches"));
}

export async function deleteImportBatch(batchId: string): Promise<ImportDeleteReport> {
  return parseDeleteReport(await invoke("cmd_delete_import_batch", { batchId }));
}
