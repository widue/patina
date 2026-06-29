export {
  getAppIcon as getDashboardIcon,
  getAppIconRuntimeCacheSnapshot as getDashboardIconRuntimeCacheSnapshot,
  getRetryableMissingAppIconExecutables as getRetryableMissingDashboardIconExecutables,
  hasAppIconForExecutable as hasDashboardIconForExecutable,
  loadAppIconsForExecutables as loadDashboardIconsForExecutables,
  resetAppIconRuntimeCacheForTests as resetDashboardIconRuntimeCacheForTests,
  resolveAppIconKeys as resolveDashboardIconKeys,
} from "../../../platform/persistence/appIconRuntimeCache.ts";

export type {
  AppIconRuntimeCacheDeps as DashboardIconRuntimeCacheDeps,
} from "../../../platform/persistence/appIconRuntimeCache.ts";
