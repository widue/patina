import { invoke } from "@tauri-apps/api/core";

export interface StoragePathSnapshot {
  installDir: string;
  dataRoot: string;
  databasePath: string;
  backupDir: string;
  remoteBackupTempDir: string;
  webviewRoot: string;
  isCustomDataRoot: boolean;
  isCustomWebviewRoot: boolean;
}

export interface StorageSizeSnapshot {
  installDirSizeBytes: number;
  dataSizeBytes: number;
  backupDirSizeBytes: number;
}

export interface WebviewCacheEntrySnapshot {
  label: string;
  path: string;
  sizeBytes: number;
}

export interface WebviewCacheSnapshot {
  webviewRoot: string;
  ebwebviewPath: string;
  totalSizeBytes: number;
  reclaimableSizeBytes: number;
  pendingClear: boolean;
  lastTrimAtMs: number | null;
  entries: WebviewCacheEntrySnapshot[];
}

export interface StorageMaintenanceSnapshot {
  lastError: string | null;
  lastMigrationStatus: string | null;
}

export interface StoragePendingMigrationSnapshot {
  id: string;
  sourceDataRoot: string;
  targetDataRoot: string;
  targetWebviewRoot: string;
  createdAtMs: number;
  state: string;
}

export interface StorageSnapshot {
  paths: StoragePathSnapshot;
  sizes: StorageSizeSnapshot;
  webviewCache: WebviewCacheSnapshot;
  maintenance: StorageMaintenanceSnapshot;
  pendingMigration: StoragePendingMigrationSnapshot | null;
}

export interface StorageMigrationPreview {
  currentDataRoot: string;
  targetDataRoot: string;
  currentWebviewRoot: string;
  targetWebviewRoot: string;
  databaseSizeBytes: number;
  backupDirSizeBytes: number;
  webviewCacheReclaimableBytes: number;
  requiresRestart: boolean;
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  return invoke<StorageSnapshot>("cmd_get_storage_snapshot");
}

export async function pickStorageDirectory(): Promise<string | null> {
  return invoke<string | null>("cmd_pick_storage_directory");
}

export async function previewStorageMigration(targetDataRoot: string): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_preview_storage_migration", { targetDataRoot });
}

export async function previewWebviewCacheMigration(targetWebviewRoot: string): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_preview_webview_cache_migration", { targetWebviewRoot });
}

export async function previewRestoreDefaultStorageMigration(): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_preview_restore_default_storage_migration");
}

export async function previewRestoreDefaultWebviewCacheMigration(): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_preview_restore_default_webview_cache_migration");
}

export async function scheduleStorageMigration(targetDataRoot: string): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_schedule_storage_migration", { targetDataRoot });
}

export async function scheduleWebviewCacheMigration(targetWebviewRoot: string): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_schedule_webview_cache_migration", { targetWebviewRoot });
}

export async function scheduleRestoreDefaultStorageMigration(): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_schedule_restore_default_storage_migration");
}

export async function scheduleRestoreDefaultWebviewCacheMigration(): Promise<StorageMigrationPreview> {
  return invoke<StorageMigrationPreview>("cmd_schedule_restore_default_webview_cache_migration");
}

export async function cancelPendingStorageMigration(): Promise<void> {
  await invoke("cmd_cancel_pending_storage_migration");
}

export async function scheduleWebviewCacheClear(): Promise<WebviewCacheSnapshot> {
  return invoke<WebviewCacheSnapshot>("cmd_schedule_webview_cache_clear");
}

export async function openStorageDirectory(path: string): Promise<void> {
  await invoke("cmd_open_storage_directory", { path });
}
