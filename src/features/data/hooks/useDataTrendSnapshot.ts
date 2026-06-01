import { useEffect, useMemo, useState } from "react";
import {
  getCachedDataTrendSnapshot,
  type DataTrendSnapshot,
} from "../services/dataTrendSnapshot.ts";
import {
  resolveDataTrendRange,
  type DataTrendRangeSelection,
} from "../services/dataTrendRange.ts";

interface UseDataTrendSnapshotParams {
  selection: DataTrendRangeSelection;
  refreshKey: number;
  loadSnapshot: (selection: DataTrendRangeSelection, nowMs?: number) => Promise<DataTrendSnapshot>;
}

export function useDataTrendSnapshot({
  selection,
  refreshKey,
  loadSnapshot,
}: UseDataTrendSnapshotParams) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resolvedRange = useMemo(() => resolveDataTrendRange(selection, nowMs), [selection, nowMs]);
  const cached = getCachedDataTrendSnapshot(resolvedRange);
  const [snapshot, setSnapshot] = useState<DataTrendSnapshot | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    const nextNowMs = Date.now();
    const nextRange = resolveDataTrendRange(selection, nextNowMs);
    const nextCached = getCachedDataTrendSnapshot(nextRange);
    if (nextCached) {
      setSnapshot(nextCached);
      setNowMs(nextCached.fetchedAtMs);
      setHasFetchedOnce(true);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void loadSnapshot(selection, nextNowMs).then((nextSnapshot) => {
      if (cancelled) return;
      setSnapshot(nextSnapshot);
      setNowMs(nextSnapshot.fetchedAtMs);
      setHasFetchedOnce(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadSnapshot, refreshKey, selection]);

  return {
    hasFetchedOnce,
    loading,
    nowMs,
    resolvedRange,
    snapshot,
  };
}
