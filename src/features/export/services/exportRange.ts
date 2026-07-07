import {
  addLocalDays,
  formatLocalDateKey,
  parseLocalDateKey,
  startOfLocalDay,
} from "../../../shared/lib/localDate.ts";

export type TimeRangePreset = "today" | "thisWeek" | "thisMonth" | "thisYear" | "custom";
export type ExportFormat = "csv" | "sqlite" | "parquet";

export type ExportTimeRangeError = "missingCustomRange" | "invalidCustomRange";

export interface DateInputRange {
  startDateKey: string;
  endDateKey: string;
}

export interface ResolvedExportTimeRange {
  startTime: number | null;
  endTime: number | null;
  error: ExportTimeRangeError | null;
}

interface ResolveExportTimeRangeInput {
  preset: TimeRangePreset;
  customStart: string;
  customEnd: string;
  nowMs?: number;
}

export function getPresetDateInputs(preset: Exclude<TimeRangePreset, "custom">, nowMs = Date.now()): DateInputRange {
  const now = new Date(nowMs);
  const todayStart = startOfLocalDay(now);
  const todayKey = formatLocalDateKey(todayStart);

  switch (preset) {
    case "today":
      return { startDateKey: todayKey, endDateKey: todayKey };
    case "thisWeek": {
      const monday = new Date(todayStart);
      monday.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7));
      return { startDateKey: formatLocalDateKey(monday), endDateKey: todayKey };
    }
    case "thisMonth":
      return {
        startDateKey: formatLocalDateKey(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)),
        endDateKey: todayKey,
      };
    case "thisYear":
      return {
        startDateKey: formatLocalDateKey(new Date(todayStart.getFullYear(), 0, 1)),
        endDateKey: todayKey,
      };
  }
}

export function resolveExportTimeRange({
  preset,
  customStart,
  customEnd,
  nowMs = Date.now(),
}: ResolveExportTimeRangeInput): ResolvedExportTimeRange {
  const dateInputs = preset === "custom"
    ? { startDateKey: customStart, endDateKey: customEnd }
    : getPresetDateInputs(preset, nowMs);

  if (!dateInputs.startDateKey || !dateInputs.endDateKey) {
    return { startTime: null, endTime: null, error: "missingCustomRange" };
  }

  const startDate = parseLocalDateKey(dateInputs.startDateKey);
  const endDate = parseLocalDateKey(dateInputs.endDateKey);
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    return { startTime: null, endTime: null, error: "invalidCustomRange" };
  }

  return {
    startTime: startOfLocalDay(startDate).getTime(),
    endTime: addLocalDays(startOfLocalDay(endDate), 1).getTime(),
    error: null,
  };
}

export function countInclusiveDays(startDateKey: string, endDateKey: string): number | null {
  const start = parseLocalDateKey(startDateKey);
  const end = parseLocalDateKey(endDateKey);
  if (!start || !end || start.getTime() > end.getTime()) return null;
  return Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86_400_000) + 1;
}
