import { UI_TEXT } from "../../../shared/copy/uiText.ts";
import type { SessionRange } from "../../../shared/lib/sessionReadCompiler.ts";
import {
  addLocalDays,
  formatLocalDateKey,
  parseLocalDateKey,
  startOfLocalDay,
} from "../../../shared/lib/localDate.ts";

export type DataRollingTrendRange = 7 | 30 | 365;
export type DataTrendPickerMode = "custom" | "week" | "month" | "year";

export type DataTrendRangeSelection =
  | { kind: "rolling"; days: DataRollingTrendRange }
  | { kind: "custom"; startDateKey: string; endDateKey: string }
  | { kind: "week"; anchorDateKey: string }
  | { kind: "month"; anchorDateKey: string }
  | { kind: "year"; anchorDateKey: string };

export interface ResolvedDataTrendRange {
  selection: DataTrendRangeSelection;
  startDateKey: string;
  endDateKey: string;
  startMs: number;
  endMs: number;
  dayCount: number;
  label: string;
  granularity: "day" | "month";
  cacheKey: string;
}

export interface DataTrendRangeDraft {
  mode: DataTrendPickerMode;
  firstDateKey: string | null;
  range: ResolvedDataTrendRange | null;
}

export const DATA_ROLLING_TREND_RANGES: DataRollingTrendRange[] = [7, 30, 365];
export const DATA_TREND_PICKER_MODES: DataTrendPickerMode[] = ["custom", "week", "month", "year"];

export {
  addLocalDays,
  parseLocalDateKey,
  startOfLocalDay,
};

export const toLocalDateKey = formatLocalDateKey;

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

export function countInclusiveLocalDays(startDateKey: string, endDateKey: string): number {
  const start = parseLocalDateKey(startDateKey);
  const end = parseLocalDateKey(endDateKey);
  if (!start || !end || start > end) return 0;
  let count = 0;
  for (let cursor = start; cursor <= end; cursor = addLocalDays(cursor, 1)) count += 1;
  return count;
}

function getIsoWeek(date: Date): { week: number; year: number } {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: utc.getUTCFullYear(),
  };
}

function getRollingLabel(days: DataRollingTrendRange): string {
  if (days === 7) return UI_TEXT.data.pastSevenDays;
  if (days === 30) return UI_TEXT.data.pastThirtyDays;
  return UI_TEXT.data.recentYear;
}

function resolveBounds(
  selection: DataTrendRangeSelection,
  start: Date,
  requestedEnd: Date,
  nowMs: number,
  label: string,
  granularity: "day" | "month",
): ResolvedDataTrendRange {
  const today = startOfLocalDay(new Date(nowMs));
  const end = minDate(requestedEnd, today);
  const startDateKey = toLocalDateKey(start);
  const endDateKey = toLocalDateKey(end);
  const nextDay = addLocalDays(end, 1).getTime();
  return {
    selection,
    startDateKey,
    endDateKey,
    startMs: start.getTime(),
    endMs: Math.min(nextDay, nowMs),
    dayCount: countInclusiveLocalDays(startDateKey, endDateKey),
    label,
    granularity,
    cacheKey: `${startDateKey}:${endDateKey}`,
  };
}

export function resolveDataTrendRange(
  selection: DataTrendRangeSelection,
  nowMs: number = Date.now(),
): ResolvedDataTrendRange {
  const today = startOfLocalDay(new Date(nowMs));
  if (selection.kind === "rolling") {
    if (selection.days === 365) {
      const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return resolveBounds(selection, start, today, nowMs, getRollingLabel(selection.days), "month");
    }
    return resolveBounds(
      selection,
      addLocalDays(today, -(selection.days - 1)),
      today,
      nowMs,
      getRollingLabel(selection.days),
      "day",
    );
  }

  if (selection.kind === "custom") {
    const left = parseLocalDateKey(selection.startDateKey) ?? today;
    const right = parseLocalDateKey(selection.endDateKey) ?? today;
    const start = left <= right ? left : right;
    const end = left <= right ? right : left;
    const dayCount = countInclusiveLocalDays(toLocalDateKey(start), toLocalDateKey(minDate(end, today)));
    return resolveBounds(
      selection,
      start,
      end,
      nowMs,
      UI_TEXT.data.customDayCount(dayCount),
      dayCount > 62 ? "month" : "day",
    );
  }

  const anchor = minDate(parseLocalDateKey(selection.anchorDateKey) ?? today, today);
  if (selection.kind === "week") {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    const start = addLocalDays(anchor, -mondayOffset);
    const isoWeek = getIsoWeek(anchor);
    return resolveBounds(selection, start, addLocalDays(start, 6), nowMs, UI_TEXT.data.weekLabel(isoWeek.week), "day");
  }

  if (selection.kind === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return resolveBounds(selection, start, end, nowMs, UI_TEXT.date.monthLabel(anchor.getMonth() + 1), "day");
  }

  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear(), 11, 31);
  return resolveBounds(selection, start, end, nowMs, UI_TEXT.data.yearLabel(anchor.getFullYear()), "month");
}

export function selectDataTrendDraftDate(
  draft: DataTrendRangeDraft,
  dateKey: string,
  nowMs: number = Date.now(),
): DataTrendRangeDraft {
  const date = parseLocalDateKey(dateKey);
  if (!date || date > startOfLocalDay(new Date(nowMs))) return draft;
  if (draft.mode === "custom") {
    if (!draft.firstDateKey || draft.range) return { mode: "custom", firstDateKey: dateKey, range: null };
    return {
      mode: "custom",
      firstDateKey: null,
      range: resolveDataTrendRange({ kind: "custom", startDateKey: draft.firstDateKey, endDateKey: dateKey }, nowMs),
    };
  }
  return {
    mode: draft.mode,
    firstDateKey: null,
    range: resolveDataTrendRange({ kind: draft.mode, anchorDateKey: dateKey }, nowMs),
  };
}

export function buildDataDayRanges(range: ResolvedDataTrendRange): SessionRange[] {
  const start = parseLocalDateKey(range.startDateKey);
  const end = parseLocalDateKey(range.endDateKey);
  if (!start || !end) return [];
  const result: SessionRange[] = [];
  for (let cursor = start; cursor <= end; cursor = addLocalDays(cursor, 1)) {
    result.push({
      startMs: cursor.getTime(),
      endMs: Math.min(addLocalDays(cursor, 1).getTime(), range.endMs),
    });
  }
  return result;
}

export function buildDataMonthRanges(range: ResolvedDataTrendRange): SessionRange[] {
  const start = parseLocalDateKey(range.startDateKey);
  const end = parseLocalDateKey(range.endDateKey);
  if (!start || !end) return [];
  const result: SessionRange[] = [];
  for (
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    cursor <= end;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    result.push({
      startMs: Math.max(cursor.getTime(), range.startMs),
      endMs: Math.min(next.getTime(), range.endMs),
    });
  }
  return result;
}
