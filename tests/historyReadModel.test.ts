import assert from "node:assert/strict";
import { loadHistorySnapshot } from "../src/features/history/services/historyReadModel.ts";
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
  await fn();
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

console.log(`Passed ${passed} history read model tests`);
