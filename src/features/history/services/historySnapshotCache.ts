import { loadHistorySnapshot, type HistorySnapshot } from "./historyReadModel.ts";

const HISTORY_SNAPSHOT_CACHE_LIMIT = 14;
const HISTORY_SNAPSHOT_CACHE = new Map<string, HistorySnapshot>();

function formatHistorySnapshotCacheKey(date: Date, rollingDayCount: number): string {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}:${rollingDayCount}`;
}

export function getHistorySnapshotCache(
  date: Date = new Date(),
  rollingDayCount: number = 7,
): HistorySnapshot | null {
  const cacheKey = formatHistorySnapshotCacheKey(date, rollingDayCount);
  const snapshot = HISTORY_SNAPSHOT_CACHE.get(cacheKey);
  if (!snapshot) return null;

  HISTORY_SNAPSHOT_CACHE.delete(cacheKey);
  HISTORY_SNAPSHOT_CACHE.set(cacheKey, snapshot);
  return snapshot;
}

export function setHistorySnapshotCache(
  snapshot: HistorySnapshot,
  date: Date = new Date(),
  rollingDayCount: number = 7,
): void {
  const cacheKey = formatHistorySnapshotCacheKey(date, rollingDayCount);
  HISTORY_SNAPSHOT_CACHE.delete(cacheKey);
  HISTORY_SNAPSHOT_CACHE.set(cacheKey, snapshot);

  while (HISTORY_SNAPSHOT_CACHE.size > HISTORY_SNAPSHOT_CACHE_LIMIT) {
    const oldestKey = HISTORY_SNAPSHOT_CACHE.keys().next().value;
    if (!oldestKey) break;
    HISTORY_SNAPSHOT_CACHE.delete(oldestKey);
  }
}

export function clearHistorySnapshotCache(): void {
  HISTORY_SNAPSHOT_CACHE.clear();
}

export function getHistorySnapshotCacheSizeForTests(): number {
  return HISTORY_SNAPSHOT_CACHE.size;
}

export async function prewarmHistorySnapshotCache(
  date: Date = new Date(),
  rollingDayCount: number = 7,
): Promise<HistorySnapshot> {
  const snapshot = await loadHistorySnapshot(date, rollingDayCount);
  setHistorySnapshotCache(snapshot, date, rollingDayCount);
  return snapshot;
}
