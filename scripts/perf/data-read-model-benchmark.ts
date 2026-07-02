import {
  buildActivityHeatmap,
  buildDataAppTrendViewModel,
  buildDataAppTrendViewModelFromAggregate,
  buildDataTrendAggregateContext,
  buildDataTrendViewModelFromAggregate,
  buildDataTrendViewModel,
  type AggregateSessionRecord,
} from "../../src/features/data/services/dataReadModel.ts";
import { measureBenchmark, printBenchmarkReport } from "./benchmarkUtils.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeSession(
  appName: string,
  exeName: string,
  startTime: number,
  durationMs: number,
): AggregateSessionRecord {
  return {
    appName,
    exeName,
    startTime,
    endTime: startTime + durationMs,
  };
}

function buildSyntheticSessions(dayCount: number, sessionsPerDay: number): AggregateSessionRecord[] {
  const sessions: AggregateSessionRecord[] = [];
  const executables = [
    "QQ.exe",
    "chrome.exe",
    "cursor.exe",
    "Code.exe",
    "WeChat.exe",
    "Teams.exe",
    "Obsidian.exe",
    "Figma.exe",
  ];
  const baseStart = new Date(2026, 5, 30, 0, 0, 0, 0).getTime() - (dayCount - 1) * DAY_MS;

  for (let day = 0; day < dayCount; day += 1) {
    const dayStart = baseStart + day * DAY_MS;
    for (let index = 0; index < sessionsPerDay; index += 1) {
      const exeName = executables[(day + index) % executables.length];
      const appName = exeName.replace(/\.exe$/i, "");
      const startTime = dayStart + 8 * 60 * 60 * 1000 + index * 6 * 60 * 1000;
      const durationMs = 2 * 60 * 1000 + (index % 11) * 45 * 1000;
      sessions.push(makeSession(appName, exeName, startTime, durationMs));
    }
  }

  return sessions;
}

const nowMs = new Date(2026, 5, 30, 12, 0, 0, 0).getTime();
const sevenDaySessions = buildSyntheticSessions(7, 120);
const yearlySessions = buildSyntheticSessions(365, 120);
const yearlyAggregateContext = buildDataTrendAggregateContext(yearlySessions, 365, nowMs);

const measurements = [
  measureBenchmark("data-trend-7d", 200, 25, () => {
    buildDataTrendViewModel(sevenDaySessions, 7, nowMs);
  }),
  measureBenchmark("data-app-trend-7d", 200, 35, () => {
    buildDataAppTrendViewModel(sevenDaySessions, 7, nowMs, null);
  }),
  measureBenchmark("data-trend-365d", 20, 400, () => {
    buildDataTrendViewModel(yearlySessions, 365, nowMs);
  }),
  measureBenchmark("data-app-trend-365d", 10, 550, () => {
    buildDataAppTrendViewModel(yearlySessions, 365, nowMs, null);
  }),
  measureBenchmark("data-combined-trends-7d", 100, 45, () => {
    const context = buildDataTrendAggregateContext(sevenDaySessions, 7, nowMs);
    buildDataTrendViewModelFromAggregate(context);
    buildDataAppTrendViewModelFromAggregate(context, null);
  }),
  measureBenchmark("data-combined-trends-365d", 10, 420, () => {
    const context = buildDataTrendAggregateContext(yearlySessions, 365, nowMs);
    buildDataTrendViewModelFromAggregate(context);
    buildDataAppTrendViewModelFromAggregate(context, null);
  }),
  measureBenchmark("data-selected-app-derive-365d", 100, 35, () => {
    buildDataAppTrendViewModelFromAggregate(yearlyAggregateContext, "cursor.exe");
  }),
  measureBenchmark("data-heatmap-recent", 20, 80, () => {
    buildActivityHeatmap(yearlySessions, "recent", nowMs);
  }),
];

printBenchmarkReport({
  benchmark: "data-read-model",
  measuredAt: new Date().toISOString(),
  measurements,
  metadata: {
    nowMs,
    sevenDaySessionCount: sevenDaySessions.length,
    yearlySessionCount: yearlySessions.length,
    comparisonNotes: [
      "The 7 day measurements model normal visible Data page ranges.",
      "The 365 day measurements model long-running local history where repeated range/session scans become visible.",
      "The combined trend measurements model the Data page path where overview and app trend can share the same aggregate context.",
      "Treat these as budgeted reference measurements, not direct optimization deltas unless compared before and after the same code change.",
    ],
  },
});
