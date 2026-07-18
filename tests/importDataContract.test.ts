import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseImportBatches,
  parseImportPreview,
} from "../src/platform/persistence/importRuntimeGateway.ts";
import { buildDashboardReadModel } from "../src/features/dashboard/services/dashboardReadModel.ts";
import { resolveTrackerHealth } from "../src/shared/types/tracking.ts";

test("import gateway accepts the canonical preview and dynamic batch payloads", () => {
  const preview = parseImportPreview({
    filePath: "C:\\data\\tai.patina.csv",
    fileName: "tai.patina.csv",
    fileFingerprint: "abc",
    validRecords: 3,
    duplicateRecords: 1,
    errorRecords: 1,
    exactSessions: 0,
    hourBuckets: 3,
    errors: [{ line: 4, message: "bad row" }],
  });
  assert.equal(preview.hourBuckets, 3);

  const batches = parseImportBatches([{
    id: "internal-id",
    importedAt: 1_700_000_000_000,
    sourceName: "tai.patina.csv",
    sourceKind: "patina-csv",
    exactSessions: 0,
    hourBuckets: 2,
    totalRecords: 2,
  }]);
  assert.equal(batches[0]?.id, "internal-id");
});

test("import gateway rejects malformed backend payloads", () => {
  assert.throws(() => parseImportPreview({ fileName: "missing fields" }), /invalid import preview/i);
  assert.throws(() => parseImportBatches([{ id: 1 }]), /invalid import batch/i);
});

test("hourly imports feed aggregates but never the exact history query", () => {
  const source = readFileSync("src/platform/persistence/sessionReadRepository.ts", "utf8");
  const historyFunction = source.slice(
    source.indexOf("export async function getSessionsInRange("),
    source.indexOf("export async function getSessionsInRangeWithoutTitleSamples("),
  );
  const aggregateFunction = source.slice(
    source.indexOf("export async function getSessionSummariesInRange("),
    source.indexOf("export async function getEarliestSessionStartTime("),
  );
  assert.doesNotMatch(historyFunction, /import_time_buckets/);
  assert.match(aggregateFunction, /import_time_buckets/);
  assert.match(aggregateFunction, /bucket_start_time \+ duration/);
});

test("hourly imports contribute to dashboard ranking without becoming history sessions", () => {
  const dashboard = buildDashboardReadModel(
    [],
    resolveTrackerHealth(200_000, 200_000, 8_000),
    200_000,
    [],
    [{ appName: "Music", exeName: "music.exe", startTime: 0, endTime: 60_000 }],
  );
  assert.equal(dashboard.totalTrackedTime, 60_000);
  assert.equal(dashboard.topApplications[0]?.exeName, "music.exe");
});

test("import command set is registered as a complete IPC boundary", () => {
  const bootstrap = readFileSync("src-tauri/src/app/bootstrap.rs", "utf8");
  for (const command of [
    "cmd_pick_canonical_import_file",
    "cmd_pick_external_import_file",
    "cmd_preview_canonical_import",
    "cmd_commit_canonical_import",
    "cmd_destructure_external_data",
    "cmd_list_import_batches",
    "cmd_delete_import_batch",
  ]) {
    assert.match(bootstrap, new RegExp(`commands::import::${command}`));
  }
});
