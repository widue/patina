const SEALED_REFRESH_ONLY_REASONS = new Set([
  "watchdog-sealed",
  "startup-sealed",
  "tracking-paused-sealed",
  "continuity-window-sealed",
  "passive-participation-sealed",
  "app-excluded-sealed",
  "web-domain-excluded-sealed",
  "backup-restored",
]);
const PAUSE_TOGGLE_REASONS = new Set([
  "tracking-paused",
  "tracking-resumed",
]);
const DATA_CACHE_INVALIDATION_REASONS = new Set([
  "backup-restored",
  "external-data-imported",
  "external-import-deleted",
]);

export type TrackingDataChangedEffects = {
  shouldRefresh: boolean;
  shouldSyncPauseSetting: boolean;
};

export function resolveTrackingDataChangedEffects(reason: string): TrackingDataChangedEffects {
  if (SEALED_REFRESH_ONLY_REASONS.has(reason)) {
    return {
      shouldRefresh: true,
      shouldSyncPauseSetting: false,
    };
  }

  return {
    shouldRefresh: true,
    shouldSyncPauseSetting: PAUSE_TOGGLE_REASONS.has(reason),
  };
}

export function shouldInvalidateDataCaches(reason: string): boolean {
  return DATA_CACHE_INVALIDATION_REASONS.has(reason);
}
