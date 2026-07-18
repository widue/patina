import { commitClassificationSettingMutations } from "./classificationSettingsGateway.ts";
import {
  deleteSessionsByExeNames as deleteSessionsByExeNamesViaCommand,
  deleteSessionsByExeNamesBetween as deleteSessionsByExeNamesBetweenViaCommand,
} from "./persistenceWriteRuntimeGateway.ts";
import { getDB } from "./sqlite.ts";
import {
  resolveNativeSessionPrecedence,
  type TimeRecordOrigin,
} from "./nativeSessionPrecedence.ts";

export interface SettingKeyValueRow {
  key: string;
  value: string;
}

export interface SettingKeyRow {
  key: string;
}

interface RawSessionExeNameRow {
  exe_name: string;
}

export interface RawObservedSessionCandidateRow {
  record_id: number;
  origin: TimeRecordOrigin;
  exe_name: string;
  app_name: string;
  start_time: number;
  effective_end_time: number;
  capacity_end_time: number | null;
}

export interface SessionExeNameRow {
  exeName: string;
}

export interface ObservedSessionStatRow {
  exeName: string;
  appName: string;
  totalDuration: number;
  lastSeenMs: number;
  hasNativeRecords: boolean;
}

interface MutableObservedSessionStat extends ObservedSessionStatRow {
  appNameOriginRank: number;
  appNameLastSeenMs: number;
}

const APP_NAME_ORIGIN_RANK: Record<TimeRecordOrigin, number> = {
  native: 0,
  import_exact: 1,
  import_bucket: 2,
};

function clipObservedCandidate(
  row: RawObservedSessionCandidateRow,
  sinceMs: number,
  nowMs: number,
) {
  if (row.origin !== "import_bucket") {
    return {
      startTime: Math.max(sinceMs, row.start_time),
      endTime: Math.min(nowMs, row.effective_end_time),
      capacityEndTime: undefined,
    };
  }

  const originalCapacityEnd = row.capacity_end_time ?? row.effective_end_time;
  const clippedStart = Math.max(sinceMs, row.start_time);
  const clippedCapacityEnd = Math.min(nowMs, originalCapacityEnd);
  const originalCapacity = Math.max(0, originalCapacityEnd - row.start_time);
  const clippedCapacity = Math.max(0, clippedCapacityEnd - clippedStart);
  const requestedDuration = Math.max(0, row.effective_end_time - row.start_time);
  const clippedRequestedDuration = originalCapacity > 0
    ? Math.round(requestedDuration * clippedCapacity / originalCapacity)
    : 0;
  return {
    startTime: clippedStart,
    endTime: clippedStart + Math.min(clippedCapacity, clippedRequestedDuration),
    capacityEndTime: clippedCapacityEnd,
  };
}

export function buildObservedSessionStats(
  candidates: RawObservedSessionCandidateRow[],
  sinceMs: number,
  nowMs: number,
): ObservedSessionStatRow[] {
  const effectiveRanges = resolveNativeSessionPrecedence(candidates.map((row, index) => {
    const clipped = clipObservedCandidate(row, sinceMs, nowMs);
    return {
      key: `${row.origin}:${row.record_id}:${index}`,
      origin: row.origin,
      ...clipped,
      value: row,
    };
  }));
  const aggregated = new Map<string, MutableObservedSessionStat>();

  for (const range of effectiveRanges) {
    const row = range.value;
    if (!row) continue;
    const duration = Math.max(0, range.endTime - range.startTime);
    if (duration <= 0) continue;
    const originRank = APP_NAME_ORIGIN_RANK[row.origin];
    const previous = aggregated.get(row.exe_name);
    if (!previous) {
      aggregated.set(row.exe_name, {
        exeName: row.exe_name,
        appName: row.app_name?.trim() || row.exe_name,
        totalDuration: duration,
        lastSeenMs: range.startTime,
        hasNativeRecords: row.origin === "native",
        appNameOriginRank: originRank,
        appNameLastSeenMs: range.startTime,
      });
      continue;
    }

    previous.totalDuration += duration;
    previous.hasNativeRecords ||= row.origin === "native";
    previous.lastSeenMs = Math.max(previous.lastSeenMs, range.startTime);
    if (
      originRank < previous.appNameOriginRank
      || (originRank === previous.appNameOriginRank && range.startTime > previous.appNameLastSeenMs)
    ) {
      previous.appName = row.app_name?.trim() || row.exe_name;
      previous.appNameOriginRank = originRank;
      previous.appNameLastSeenMs = range.startTime;
    }
  }

  return Array.from(aggregated.values()).map((row) => ({
    exeName: row.exeName,
    appName: row.appName,
    totalDuration: row.totalDuration,
    lastSeenMs: row.lastSeenMs,
    hasNativeRecords: row.hasNativeRecords,
  }));
}

export async function upsertSettingValue(key: string, value: string): Promise<void> {
  await commitClassificationSettingMutations([{ key, value }]);
}

export async function deleteSettingValue(key: string): Promise<void> {
  await commitClassificationSettingMutations([{ key, value: null }]);
}

export async function loadSettingValue(key: string): Promise<string | null> {
  const db = await getDB();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ? LIMIT 1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function loadSettingRowsByKeyPrefix(keyPrefix: string): Promise<SettingKeyValueRow[]> {
  const db = await getDB();
  return db.select<SettingKeyValueRow[]>(
    "SELECT key, value FROM settings WHERE key LIKE ?",
    [`${keyPrefix}%`],
  );
}

export async function loadSettingKeysByKeyPrefix(keyPrefix: string): Promise<SettingKeyRow[]> {
  const db = await getDB();
  return db.select<SettingKeyRow[]>(
    "SELECT key FROM settings WHERE key LIKE ?",
    [`${keyPrefix}%`],
  );
}

export async function loadDistinctSessionExeNames(): Promise<SessionExeNameRow[]> {
  const db = await getDB();
  const rows = await db.select<RawSessionExeNameRow[]>(
    `SELECT DISTINCT exe_name
     FROM (
       SELECT exe_name FROM sessions
       UNION ALL
       SELECT exe_name FROM import_exact_sessions
       UNION ALL
       SELECT exe_name FROM import_time_buckets
     )`,
  );
  return rows.map((row) => ({
    exeName: row.exe_name,
  }));
}

export async function loadObservedSessionStats(
  sinceMs: number,
  nowMs: number,
): Promise<ObservedSessionStatRow[]> {
  const db = await getDB();
  const candidates = await db.select<RawObservedSessionCandidateRow[]>(
    `SELECT record_id, origin, exe_name, app_name, start_time,
            effective_end_time, capacity_end_time
     FROM (
       SELECT id AS record_id, 'native' AS origin, exe_name, app_name, start_time,
              COALESCE(end_time, ?) AS effective_end_time,
              NULL AS capacity_end_time
       FROM sessions
       WHERE start_time < ? AND COALESCE(end_time, ?) > ?
       UNION ALL
       SELECT id AS record_id, 'import_exact' AS origin, exe_name, app_name, start_time,
              end_time AS effective_end_time,
              NULL AS capacity_end_time
       FROM import_exact_sessions
       WHERE start_time < ? AND end_time > ?
       UNION ALL
       SELECT id AS record_id, 'import_bucket' AS origin, exe_name,
              COALESCE(NULLIF(app_name, ''), exe_name) AS app_name,
              bucket_start_time AS start_time,
              bucket_start_time + duration AS effective_end_time,
              bucket_start_time + 3600000 AS capacity_end_time
       FROM import_time_buckets
       WHERE bucket_start_time < ? AND bucket_start_time + 3600000 > ?
     )
     ORDER BY start_time ASC, origin ASC, record_id ASC`,
    [nowMs, nowMs, nowMs, sinceMs, nowMs, sinceMs, nowMs, sinceMs],
  );
  return buildObservedSessionStats(candidates, sinceMs, nowMs);
}

export async function deleteSessionsByExeNames(exeNames: string[]): Promise<void> {
  if (exeNames.length === 0) {
    return;
  }
  await deleteSessionsByExeNamesViaCommand(exeNames);
}

export async function deleteSessionsByExeNamesBetween(
  exeNames: string[],
  startTime: number,
  endTime: number,
): Promise<void> {
  if (exeNames.length === 0) {
    return;
  }
  await deleteSessionsByExeNamesBetweenViaCommand(exeNames, startTime, endTime);
}
