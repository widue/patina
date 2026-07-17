import assert from "node:assert/strict";
import { resolveTrendDateFromChartEvent } from "../src/features/data/services/dataChartInteraction.ts";
import {
  buildDataHeatmapKeyboardModel,
  resolveDataHeatmapActiveDate,
  resolveDataHeatmapNavigationDate,
} from "../src/features/data/services/dataHeatmapInteraction.ts";
import type { HeatmapCell, HeatmapWeek } from "../src/features/data/services/dataReadModel.ts";

let passed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await runTest("chart interaction resolves date from active payload", () => {
  assert.equal(
    resolveTrendDateFromChartEvent({
      activePayload: [
        {
          payload: {
            date: "2026-05-29",
            hours: 1.5,
          },
        },
      ],
    }),
    "2026-05-29",
  );
});

await runTest("chart interaction falls back to direct payload", () => {
  assert.equal(
    resolveTrendDateFromChartEvent({
      payload: {
        date: "2026-05-28",
      },
    }),
    "2026-05-28",
  );
});

await runTest("chart interaction resolves date from active label and points", () => {
  assert.equal(
    resolveTrendDateFromChartEvent(
      {
        activeLabel: "05-28",
        activeTooltipIndex: "3",
      },
      [
        { date: "2026-05-25", label: "05-25" },
        { date: "2026-05-26", label: "05-26" },
        { date: "2026-05-27", label: "05-27" },
        { date: "2026-05-28", label: "05-28" },
      ],
    ),
    "2026-05-28",
  );
});

await runTest("chart interaction resolves date from active index when label is absent", () => {
  assert.equal(
    resolveTrendDateFromChartEvent(
      {
        activeTooltipIndex: 2,
      },
      [
        { date: "2026-05-25", label: "05-25" },
        { date: "2026-05-26", label: "05-26" },
        { date: "2026-05-27", label: "05-27" },
      ],
    ),
    "2026-05-27",
  );
});

await runTest("chart interaction ignores month keys and invalid dates", () => {
  assert.equal(
    resolveTrendDateFromChartEvent({
      activePayload: [{ payload: { date: "2026-05" } }],
    }),
    null,
  );
  assert.equal(
    resolveTrendDateFromChartEvent({
      activePayload: [{ payload: { date: "2026-02-31" } }],
    }),
    null,
  );
  assert.equal(
    resolveTrendDateFromChartEvent(
      { activeLabel: "5月" },
      [{ date: "2026-05", label: "5月" }],
    ),
    null,
  );
});

function buildHeatmapCell(
  date: string,
  options: Partial<Pick<HeatmapCell, "isFuture" | "isOutsideYear">> = {},
): HeatmapCell {
  return {
    key: date,
    date,
    duration: 0,
    intensity: 0,
    isFuture: options.isFuture ?? false,
    isOutsideYear: options.isOutsideYear ?? false,
    label: date,
  };
}

const heatmapRows: HeatmapWeek[] = [
  {
    key: "2026-07-06",
    monthLabel: "",
    cells: [
      buildHeatmapCell("2026-07-06", { isOutsideYear: true }),
      buildHeatmapCell("2026-07-07"),
      buildHeatmapCell("2026-07-08"),
      buildHeatmapCell("2026-07-09"),
      buildHeatmapCell("2026-07-10"),
      buildHeatmapCell("2026-07-11"),
      buildHeatmapCell("2026-07-12"),
    ],
  },
  {
    key: "2026-07-13",
    monthLabel: "",
    cells: [
      buildHeatmapCell("2026-07-13"),
      buildHeatmapCell("2026-07-14"),
      buildHeatmapCell("2026-07-15"),
      buildHeatmapCell("2026-07-16"),
      buildHeatmapCell("2026-07-17"),
      buildHeatmapCell("2026-07-18"),
      buildHeatmapCell("2026-07-19"),
    ],
  },
  {
    key: "2026-07-20",
    monthLabel: "",
    cells: [
      buildHeatmapCell("2026-07-20"),
      buildHeatmapCell("2026-07-21"),
      buildHeatmapCell("2026-07-22"),
      buildHeatmapCell("2026-07-23"),
      buildHeatmapCell("2026-07-24"),
      buildHeatmapCell("2026-07-25"),
      buildHeatmapCell("2026-07-26", { isFuture: true }),
    ],
  },
];

await runTest("heatmap keyboard model keeps one valid active-date fallback", () => {
  const model = buildDataHeatmapKeyboardModel(heatmapRows);

  assert.equal(resolveDataHeatmapActiveDate(model, "2026-07-15", "2026-07-17"), "2026-07-15");
  assert.equal(resolveDataHeatmapActiveDate(model, "2025-01-01", "2026-07-17"), "2026-07-17");
  assert.equal(resolveDataHeatmapActiveDate(model, null, "2027-01-01"), "2026-07-25");
  assert.equal(model.positionsByDate.has("2026-07-06"), false);
  assert.equal(model.positionsByDate.has("2026-07-26"), false);
});

await runTest("heatmap keyboard model follows the visual grid without wrapping", () => {
  const model = buildDataHeatmapKeyboardModel(heatmapRows);

  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "ArrowUp"), "2026-07-14");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "ArrowDown"), "2026-07-16");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "ArrowLeft"), "2026-07-08");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "ArrowRight"), "2026-07-22");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "Home"), "2026-07-08");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "End"), "2026-07-22");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-07", "ArrowUp"), null);
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-25", "ArrowDown"), null);
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "Home", true), "2026-07-07");
  assert.equal(resolveDataHeatmapNavigationDate(model, "2026-07-15", "End", true), "2026-07-25");
});

console.log(`Passed ${passed} data visualization interaction tests`);
