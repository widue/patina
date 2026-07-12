import {
  queryScreenshots as queryScreenshotsGateway,
  getScreenshotData as getScreenshotDataGateway,
  getScreenshotFilePath as getScreenshotFilePathGateway,
  revealScreenshotInFolder as revealScreenshotInFolderGateway,
} from "../../../platform/persistence/screenshotGateway.ts";
import type {
  ScreenshotEntry,
} from "../../../platform/persistence/screenshotGateway.ts";
import type {
  HistoryAppTimelineAppItem,
} from "./historyAppTimelineViewModel";

export type { ScreenshotEntry };

export async function queryScreenshots(
  startTime: number,
  endTime: number,
  limit?: number,
): Promise<ScreenshotEntry[]> {
  return queryScreenshotsGateway(startTime, endTime, limit);
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

export function groupScreenshotsByApp(
  appItems: HistoryAppTimelineAppItem[],
  screenshots: ScreenshotEntry[],
): Record<string, ScreenshotEntry[]> {
  const result: Record<string, ScreenshotEntry[]> = {};
  for (const app of appItems) {
    result[app.exeName] = [];
  }
  if (screenshots.length === 0) return result;

  const sessionIdToExeName = new Map<number, string>();
  for (const app of appItems) {
    for (const seg of app.segments) {
      sessionIdToExeName.set(seg.sourceSessionId, app.exeName);
    }
  }

  const unmatched: ScreenshotEntry[] = [];
  for (const shot of screenshots) {
    if (shot.sessionId != null) {
      const exeName = sessionIdToExeName.get(shot.sessionId);
      if (exeName) {
        result[exeName].push(shot);
        continue;
      }
    }
    unmatched.push(shot);
  }

  if (unmatched.length > 0) {
    for (const app of appItems) {
      for (const shot of unmatched) {
        for (const seg of app.segments) {
          const segEnd = seg.startTime + seg.duration;
          if (shot.capturedAt >= seg.startTime && shot.capturedAt <= segEnd) {
            if (!result[app.exeName].find((r) => r.id === shot.id)) {
              result[app.exeName].push(shot);
            }
            break;
          }
        }
      }
    }
  }

  for (const app of appItems) {
    result[app.exeName].sort((a, b) => a.capturedAt - b.capturedAt);
  }

  return result;
}

export function getAppScreenshots(
  appItem: HistoryAppTimelineAppItem,
  screenshots: ScreenshotEntry[],
): ScreenshotEntry[] {
  if (screenshots.length === 0) return [];
  const sessionIds = new Set(
    appItem.segments.map((seg) => seg.sourceSessionId),
  );
  const result: ScreenshotEntry[] = [];

  for (const shot of screenshots) {
    if (shot.sessionId != null && sessionIds.has(shot.sessionId)) {
      result.push(shot);
      continue;
    }
    for (const seg of appItem.segments) {
      const segEnd = seg.startTime + seg.duration;
      if (shot.capturedAt >= seg.startTime && shot.capturedAt <= segEnd) {
        if (!result.find((r) => r.id === shot.id)) {
          result.push(shot);
        }
        break;
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
