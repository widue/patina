import {
  queryScreenshots as queryScreenshotsGateway,
  queryScreenshotsPaginated as queryScreenshotsPaginatedGateway,
  countScreenshots as countScreenshotsGateway,
  getScreenshotStats as getScreenshotStatsGateway,
  getScreenshotData as getScreenshotDataGateway,
  getScreenshotFilePath as getScreenshotFilePathGateway,
  revealScreenshotInFolder as revealScreenshotInFolderGateway,
} from "../../../platform/persistence/screenshotGateway.ts";
import type {
  ScreenshotEntry,
  ScreenshotQueryResult,
  ScreenshotStats,
} from "../../../platform/persistence/screenshotGateway.ts";
import type {
  HistoryAppTimelineAppItem,
} from "./historyAppTimelineViewModel";

export type { ScreenshotEntry, ScreenshotQueryResult, ScreenshotStats };

export async function queryScreenshots(
  startTime: number,
  endTime: number,
): Promise<ScreenshotEntry[]> {
  return queryScreenshotsGateway(startTime, endTime);
}

export async function queryScreenshotsPaginated(
  startTime: number,
  endTime: number,
  page: number,
  pageSize: number,
): Promise<ScreenshotQueryResult> {
  return queryScreenshotsPaginatedGateway(startTime, endTime, page, pageSize);
}

export async function countScreenshots(
  startTime: number,
  endTime: number,
): Promise<number> {
  return countScreenshotsGateway(startTime, endTime);
}

export async function getScreenshotStats(): Promise<ScreenshotStats> {
  return getScreenshotStatsGateway();
}

export async function getScreenshotData(id: number): Promise<string> {
  return getScreenshotDataGateway(id);
}

export async function getScreenshotFilePath(id: number): Promise<string> {
  return getScreenshotFilePathGateway(id);
}

export async function revealScreenshotInFolder(id: number): Promise<void> {
  return revealScreenshotInFolderGateway(id);
}

export function findClosestScreenshotIndex(
  screenshots: ScreenshotEntry[],
  targetTime: number,
): number {
  if (screenshots.length === 0) return -1;
  let closestIdx = 0;
  let minDiff = Math.abs(screenshots[0].capturedAt - targetTime);
  for (let i = 1; i < screenshots.length; i++) {
    const diff = Math.abs(screenshots[i].capturedAt - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  return closestIdx;
}

export function getAppScreenshots(
  appItem: HistoryAppTimelineAppItem,
  screenshots: ScreenshotEntry[],
): ScreenshotEntry[] {
  if (screenshots.length === 0) return [];
  const result: ScreenshotEntry[] = [];
  for (const seg of appItem.segments) {
    const segStart = seg.startTime;
    const segEnd = seg.startTime + seg.duration;
    for (const shot of screenshots) {
      if (shot.capturedAt >= segStart && shot.capturedAt <= segEnd) {
        if (!result.find((r) => r.id === shot.id)) {
          result.push(shot);
        }
      }
    }
  }
  return result.sort((a, b) => a.capturedAt - b.capturedAt);
}

export function getContextScreenshots(
  appItem: HistoryAppTimelineAppItem,
  screenshots: ScreenshotEntry[],
  selectedTime: number | null,
): ScreenshotEntry[] {
  const allAppShots = getAppScreenshots(appItem, screenshots);
  return sliceContextScreenshots(allAppShots, selectedTime);
}

export function sliceContextScreenshots(
  appScreenshots: ScreenshotEntry[],
  selectedTime: number | null,
): ScreenshotEntry[] {
  if (appScreenshots.length === 0) return [];

  if (selectedTime === null) {
    return appScreenshots.slice(0, 5);
  }

  const closestIdx = findClosestScreenshotIndex(appScreenshots, selectedTime);
  const startIdx = Math.max(0, closestIdx - 2);
  const endIdx = Math.min(appScreenshots.length, startIdx + 5);
  return appScreenshots.slice(startIdx, endIdx);
}

export function groupScreenshotsByApp(
  appItems: HistoryAppTimelineAppItem[],
  screenshots: ScreenshotEntry[],
): Record<string, ScreenshotEntry[]> {
  const result: Record<string, ScreenshotEntry[]> = {};
  for (const app of appItems) {
    result[app.exeName] = getAppScreenshots(app, screenshots);
  }
  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
