import { getUiLocale } from "../../../shared/copy/uiText.ts";

const ZH_CN_STORAGE_SETTINGS_COPY = {
  storageDirectoryTitle: "本机目录",
  storageDirectoryBetaLabel: "Beta",
  storageDirectorySummary: "安装目录随安装位置；数据目录和缓存目录可更改",
  changePathAction: "更改地址",
  restoreDefaultPathAction: "恢复默认目录",
  installDirectoryLabel: "安装目录",
  dataDirectoryLabel: "数据目录",
  webviewCacheDirectoryLabel: "缓存目录",
  openDirectoryAction: "打开目录",
  storageMigrationPendingTitle: "迁移将在下次启动前执行",
  storageMigrationPendingHint: (dataPath: string | null, cachePath: string | null) => [
    dataPath ? `数据目录迁移到：${dataPath}` : null,
    cachePath ? `缓存目录迁移到：${cachePath}` : null,
  ].filter(Boolean).join("\n"),
  storageMigrationCancelAction: "取消迁移",
  storageDataMigrationConfirmTitle: "更改数据目录",
  storageDataMigrationConfirmDetail: (currentDataRoot: string, targetDataRoot: string) => (
    `当前目录：${currentDataRoot}\n目标目录：${targetDataRoot}\n\nPatina 会在下次启动时迁移数据目录：\n- 本次运行中不会移动数据文件。\n- 下次启动时，Patina 会将当前数据复制到目标目录。\n- 迁移完成前，请不要删除或移动当前目录和目标目录。\n- 迁移成功后，默认目录只保留必要的锚点文件。`
  ),
  storageCacheMigrationConfirmTitle: "更改缓存目录",
  storageCacheMigrationConfirmDetail: (currentWebviewRoot: string, targetWebviewRoot: string) => (
    `当前缓存：${currentWebviewRoot}\n目标缓存：${targetWebviewRoot}\n\nPatina 会在下次启动时更改缓存目录：\n- 本次运行中不会更改缓存目录。\n- 下次启动时，Patina 会使用目标缓存目录。\n- 更改完成前，请不要删除或移动目标目录。\n- 更改成功后，默认目录只保留必要的锚点文件。`
  ),
  storageMigrationConfirmAction: "确认更改",
  storageRestoreDefaultDataConfirmDetail: (currentDataRoot: string, defaultDataRoot: string) => (
    `当前数据：${currentDataRoot}\n默认数据：${defaultDataRoot}\n\nPatina 会在下次启动时迁移数据目录：\n- 本次运行中不会移动数据文件。\n- 下次启动时，Patina 会将当前数据复制到默认目录。\n- 迁移完成前，请不要删除或移动当前目录和默认目录。\n- 迁移成功后，自定义目录会被删除，清理其中的数据文件。`
  ),
  storageRestoreDefaultCacheConfirmDetail: (currentWebviewRoot: string, defaultWebviewRoot: string) => (
    `当前缓存：${currentWebviewRoot}\n默认缓存：${defaultWebviewRoot}\n\nPatina 会在下次启动时更改缓存目录：\n- 本次运行中不会更改缓存目录。\n- 下次启动时，Patina 会使用默认缓存目录。\n- 更改完成前，请不要删除或移动默认目录。\n- 更改成功后，自定义目录会被删除，清理其中的缓存文件。`
  ),
  webviewCacheClearTitle: "清理缓存",
  webviewCacheClearPending: "已安排在下次启动前清理。",
  webviewCacheClearAction: "下次启动清理",
  webviewCacheClearConfirmTitle: "清理缓存",
  webviewCacheClearConfirmDetail: "下次启动创建窗口前，清理可重新生成的缓存。",
  webviewCacheClearScheduled: "已安排下次启动前清理缓存。",
  webviewCacheClearFailed: "无法安排缓存清理。",
  storageMigrationScheduled: "迁移已安排，下次启动前执行。",
  storageMigrationFailed: "无法安排迁移，请检查目标目录。",
  storageMigrationCancelled: "已取消待执行迁移。",
  storageMigrationCancelFailed: "无法取消迁移。",
  storageOpenDirectoryFailed: "无法打开该目录。",
};

type StorageSettingsCopy = typeof ZH_CN_STORAGE_SETTINGS_COPY;

const EN_US_STORAGE_SETTINGS_COPY: StorageSettingsCopy = {
  storageDirectoryTitle: "Local paths",
  storageDirectoryBetaLabel: "Beta",
  storageDirectorySummary: "Install directory follows the installed location; data and cache directories can be changed.",
  changePathAction: "Change location",
  restoreDefaultPathAction: "Restore default location",
  installDirectoryLabel: "Install directory",
  dataDirectoryLabel: "Data directory",
  webviewCacheDirectoryLabel: "Cache directory",
  openDirectoryAction: "Open directory",
  storageMigrationPendingTitle: "Migration runs before next launch",
  storageMigrationPendingHint: (dataPath: string | null, cachePath: string | null) => [
    dataPath ? `Data directory moves to: ${dataPath}` : null,
    cachePath ? `Cache directory moves to: ${cachePath}` : null,
  ].filter(Boolean).join("\n"),
  storageMigrationCancelAction: "Cancel migration",
  storageDataMigrationConfirmTitle: "Change data directory",
  storageDataMigrationConfirmDetail: (currentDataRoot: string, targetDataRoot: string) => (
    `Current directory: ${currentDataRoot}\nTarget directory: ${targetDataRoot}\n\nPatina will migrate the data directory before the next launch:\n- No data files move during this run.\n- On the next launch, Patina copies the current data to the target directory.\n- Until migration finishes, do not delete or move the current or target directory.\n- After migration succeeds, the default directory only keeps the required anchor files.`
  ),
  storageCacheMigrationConfirmTitle: "Change cache directory",
  storageCacheMigrationConfirmDetail: (currentWebviewRoot: string, targetWebviewRoot: string) => (
    `Current cache: ${currentWebviewRoot}\nTarget cache: ${targetWebviewRoot}\n\nPatina will change the cache directory before the next launch:\n- The cache directory will not change during this run.\n- On the next launch, Patina uses the target cache directory.\n- Until the change finishes, do not delete or move the target directory.\n- After the change succeeds, the default directory only keeps the required anchor files.`
  ),
  storageMigrationConfirmAction: "Confirm change",
  storageRestoreDefaultDataConfirmDetail: (currentDataRoot: string, defaultDataRoot: string) => (
    `Current data: ${currentDataRoot}\nDefault data: ${defaultDataRoot}\n\nPatina will migrate the data directory before the next launch:\n- No data files move during this run.\n- On the next launch, Patina copies the current data to the default directory.\n- Until migration finishes, do not delete or move the current or default directory.\n- After migration succeeds, the custom directory is removed and its data files are cleaned.`
  ),
  storageRestoreDefaultCacheConfirmDetail: (currentWebviewRoot: string, defaultWebviewRoot: string) => (
    `Current cache: ${currentWebviewRoot}\nDefault cache: ${defaultWebviewRoot}\n\nPatina will change the cache directory before the next launch:\n- The cache directory will not change during this run.\n- On the next launch, Patina uses the default cache directory.\n- Until the change finishes, do not delete or move the default directory.\n- After the change succeeds, the custom directory is removed and its cache files are cleaned.`
  ),
  webviewCacheClearTitle: "Clear cache",
  webviewCacheClearPending: "Scheduled to clear before the next launch.",
  webviewCacheClearAction: "Clear next launch",
  webviewCacheClearConfirmTitle: "Clear cache",
  webviewCacheClearConfirmDetail: "Before the next window starts, Patina clears regenerable cache.",
  webviewCacheClearScheduled: "Cache cleanup scheduled for next launch.",
  webviewCacheClearFailed: "Could not schedule cache cleanup.",
  storageMigrationScheduled: "Migration scheduled for next launch.",
  storageMigrationFailed: "Could not schedule migration. Check the target.",
  storageMigrationCancelled: "Pending migration cancelled.",
  storageMigrationCancelFailed: "Could not cancel migration.",
  storageOpenDirectoryFailed: "Could not open that directory.",
};

export function getStorageSettingsCopy(): StorageSettingsCopy {
  return getUiLocale() === "en-US" ? EN_US_STORAGE_SETTINGS_COPY : ZH_CN_STORAGE_SETTINGS_COPY;
}
