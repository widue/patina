import { getSessionSummariesInRange } from "../../../platform/persistence/sessionReadRepository.ts";
import type { AggregateSessionRecord } from "../../../platform/persistence/sessionReadRepository.ts";
import {
  resolveDataTrendRange,
  type DataTrendRangeSelection,
  type ResolvedDataTrendRange,
} from "./dataTrendRange.ts";

export interface DataTrendSnapshot {
  fetchedAtMs: number;
  range: ResolvedDataTrendRange;
  sessions: AggregateSessionRecord[];
}

export interface DataTrendSnapshotDependencies {
  getSessionSummariesInRange: (startMs: number, endMs: number) => Promise<AggregateSessionRecord[]>;
}

const snapshotCache = new Map<string, DataTrendSnapshot>();
const sessionPromises = new Map<string, Promise<AggregateSessionRecord[]>>();

export function getCachedDataTrendSnapshot(range: ResolvedDataTrendRange): DataTrendSnapshot | null {
  const snapshot = snapshotCache.get(range.cacheKey);
  return snapshot ? { ...snapshot, range } : null;
}

export function setDataTrendSnapshotCache(snapshot: DataTrendSnapshot): void {
  snapshotCache.set(snapshot.range.cacheKey, snapshot);
}

export function clearDataTrendSnapshotCache(): void {
  snapshotCache.clear();
  sessionPromises.clear();
}

export async function loadDataTrendSnapshot(
  selection: DataTrendRangeSelection,
  nowMs: number = Date.now(),
  deps: DataTrendSnapshotDependencies = { getSessionSummariesInRange },
): Promise<DataTrendSnapshot> {
  const range = resolveDataTrendRange(selection, nowMs);
  const pending = sessionPromises.get(range.cacheKey);
  const sessionPromise = pending ?? deps.getSessionSummariesInRange(range.startMs, range.endMs).finally(() => {
    sessionPromises.delete(range.cacheKey);
  });
  if (!pending) sessionPromises.set(range.cacheKey, sessionPromise);
  return sessionPromise.then((sessions) => {
    const snapshot = { fetchedAtMs: nowMs, range, sessions };
    setDataTrendSnapshotCache(snapshot);
    return snapshot;
  });
}

export function prewarmDefaultDataTrendSnapshot(nowMs: number = Date.now()) {
  return loadDataTrendSnapshot({ kind: "rolling", days: 7 }, nowMs);
}
