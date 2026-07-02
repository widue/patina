import assert from "node:assert/strict";
import { loadHistorySnapshot } from "../src/features/history/services/historyReadModel.ts";
import {
  clearHistorySnapshotCache,
  loadHistorySnapshotWithCache,
} from "../src/features/history/services/historySnapshotCache.ts";
import type { HistorySession } from "../src/shared/types/sessions.ts";
import type { WebActivitySegment } from "../src/shared/types/webActivity.ts";

function makeSession(overrides: Partial<HistorySession> = {}): HistorySession {
  const startTime = overrides.startTime ?? new Date(2026, 0, 2, 9, 0, 0, 0).getTime();
  const endTime = Object.hasOwn(overrides, "endTime")
    ? overrides.endTime!
    : startTime + 60 * 60_000;

  return {
    id: overrides.id ?? 1,
    appName: overrides.appName ?? "VSCodium",
    exeName: overrides.exeName ?? "vscodium.exe",
    windowTitle: overrides.windowTitle ?? "Work",
    startTime,
    endTime,
    duration: overrides.duration ?? (endTime === null ? null : endTime - startTime),
    continuityGroupStartTime: overrides.continuityGroupStartTime ?? startTime,
    titleSampleDetails: overrides.titleSampleDetails ?? [],
  };
}

function makeWebSegment(overrides: Partial<WebActivitySegment> = {}): WebActivitySegment {
  return {
    id: overrides.id ?? 1,
    browserClientId: "client",
    browserKind: "chrome",
    browserExeName: "chrome.exe",
    domain: overrides.domain ?? "github.com",
    normalizedDomain: overrides.normalizedDomain ?? "github.com",
    url: overrides.url ?? null,
    title: overrides.title ?? null,
    faviconUrl: overrides.faviconUrl ?? null,
    startTime: overrides.startTime ?? new Date(2026, 0, 2, 10, 0, 0, 0).getTime(),
    endTime: overrides.endTime ?? new Date(2026, 0, 2, 11, 0, 0, 0).getTime(),
    duration: overrides.duration ?? 60 * 60_000,
  };
}

let passed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  clearHistorySnapshotCache();
  await fn();
  clearHistorySnapshotCache();
  passed += 1;
  console.log(`PASS ${name}`);
}

await runTest("history snapshot keeps app sessions when optional web reads fail", async () => {
  const daySession = makeSession({ id: 1 });
  const weeklySession = makeSession({ id: 2 });
  const originalWarn = console.warn;
  let warning = "";
  console.warn = (message?: unknown) => {
    warning = String(message ?? "");
  };

  try {
    const snapshot = await loadHistorySnapshot(new Date(2026, 0, 2), 7, {
      getHistoryByDate: async () => [daySession],
      getSessionsInRange: async () => [weeklySession],
      getWebActivitySegmentsInRange: async () => {
        throw new Error("no such table: web_activity_segments");
      },
      getWebFaviconsForDomains: async () => ({}),
      loadWebDomainOverrides: async () => ({
        "github.com": {
          displayName: "GitHub",
        },
      }),
    });

    assert.deepEqual(snapshot.daySessions, [daySession]);
    assert.deepEqual(snapshot.weeklySessions, [weeklySession]);
    assert.deepEqual(snapshot.dayWebSegments, []);
    assert.deepEqual(snapshot.webDomainFavicons, {});
    assert.deepEqual(snapshot.webDomainOverrides, {});
    assert.match(warning, /History web activity data is unavailable/);
  } finally {
    console.warn = originalWarn;
  }
});

await runTest("history snapshot keeps web segments when favicon cache read fails", async () => {
  const webSegment = makeWebSegment();
  const originalWarn = console.warn;
  let warning = "";
  console.warn = (message?: unknown) => {
    warning = String(message ?? "");
  };

  try {
    const snapshot = await loadHistorySnapshot(new Date(2026, 0, 2), 7, {
      getHistoryByDate: async () => [],
      getSessionsInRange: async () => [],
      getWebActivitySegmentsInRange: async () => [webSegment],
      getWebFaviconsForDomains: async () => {
        throw new Error("no such table: web_favicon_cache");
      },
      loadWebDomainOverrides: async () => ({}),
    });

    assert.deepEqual(snapshot.dayWebSegments, [webSegment]);
    assert.deepEqual(snapshot.webDomainFavicons, {});
    assert.deepEqual(snapshot.webDomainOverrides, {});
    assert.match(warning, /History web favicon cache is unavailable/);
  } finally {
    console.warn = originalWarn;
  }
});

await runTest("history snapshot uses lightweight weekly loader when provided", async () => {
  const daySession = makeSession({
    id: 1,
    titleSampleDetails: [{
      title: "README.md",
      startTime: new Date(2026, 0, 2, 9, 0, 0, 0).getTime(),
      endTime: new Date(2026, 0, 2, 10, 0, 0, 0).getTime(),
    }],
  });
  const weeklySession = makeSession({ id: 2, titleSampleDetails: [] });
  let weeklyLoadCount = 0;

  const snapshot = await loadHistorySnapshot(new Date(2026, 0, 2), 7, {
    getHistoryByDate: async () => [daySession],
    getSessionsInRange: async () => {
      throw new Error("full weekly session loader should not run");
    },
    getWeeklySessionsInRange: async () => {
      weeklyLoadCount += 1;
      return [weeklySession];
    },
    getWebActivitySegmentsInRange: async () => [],
    getWebFaviconsForDomains: async () => ({}),
    loadWebDomainOverrides: async () => ({}),
  });

  assert.equal(weeklyLoadCount, 1);
  assert.equal(snapshot.daySessions[0].titleSampleDetails?.length, 1);
  assert.deepEqual(snapshot.weeklySessions, [weeklySession]);
  assert.deepEqual(snapshot.weeklySessions[0].titleSampleDetails, []);
});

await runTest("history snapshot cache dedupes matching in-flight loads", async () => {
  const daySession = makeSession({ id: 1 });
  const weeklySession = makeSession({ id: 2 });
  let dayLoadCount = 0;
  let weeklyLoadCount = 0;
  let releaseDayLoad: (() => void) | null = null;
  const deps = {
    getHistoryByDate: async () => {
      dayLoadCount += 1;
      await new Promise<void>((resolve) => {
        releaseDayLoad = resolve;
      });
      return [daySession];
    },
    getSessionsInRange: async () => {
      weeklyLoadCount += 1;
      return [weeklySession];
    },
    getWebActivitySegmentsInRange: async () => [],
    getWebFaviconsForDomains: async () => ({}),
    loadWebDomainOverrides: async () => ({}),
  };
  const date = new Date(2026, 0, 2);

  const first = loadHistorySnapshotWithCache(date, 7, deps);
  const second = loadHistorySnapshotWithCache(date, 7, deps);
  releaseDayLoad?.();
  const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

  assert.equal(firstSnapshot, secondSnapshot);
  assert.deepEqual(firstSnapshot.daySessions, [daySession]);
  assert.deepEqual(firstSnapshot.weeklySessions, [weeklySession]);
  assert.equal(dayLoadCount, 1);
  assert.equal(weeklyLoadCount, 1);
});

await runTest("history snapshot cache keeps different dates separate while pending", async () => {
  let dayLoadCount = 0;
  const deps = {
    getHistoryByDate: async (date: Date) => {
      dayLoadCount += 1;
      return [makeSession({ id: date.getDate() })];
    },
    getSessionsInRange: async () => [],
    getWebActivitySegmentsInRange: async () => [],
    getWebFaviconsForDomains: async () => ({}),
    loadWebDomainOverrides: async () => ({}),
  };

  const [first, second] = await Promise.all([
    loadHistorySnapshotWithCache(new Date(2026, 0, 2), 7, deps),
    loadHistorySnapshotWithCache(new Date(2026, 0, 3), 7, deps),
  ]);

  assert.equal(first.daySessions[0].id, 2);
  assert.equal(second.daySessions[0].id, 3);
  assert.equal(dayLoadCount, 2);
});

console.log(`Passed ${passed} history read model tests`);
