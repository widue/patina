import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseImportBatches,
  parseImportPreview,
  type ImportPreview,
} from "../src/platform/persistence/importRuntimeGateway.ts";
import { buildDashboardReadModel } from "../src/features/dashboard/services/dashboardReadModel.ts";
import { resolveTrackerHealth } from "../src/shared/types/tracking.ts";
import {
  buildImportedClassificationDraft,
} from "../src/features/classification/services/importedClassification.ts";
import {
  commitImportWithClassification,
  deleteImportBatchWithRefresh,
} from "../src/features/settings/services/settingsImportService.ts";
import {
  buildObservedSessionStats,
} from "../src/platform/persistence/classificationPersistence.ts";
import type { ClassificationDraftState } from "../src/features/classification/services/classificationDraftState.ts";

function emptyClassificationState(): ClassificationDraftState {
  return {
    overrides: {},
    webDomainOverrides: {},
    categoryColorOverrides: {},
    categoryLabelOverrides: {},
    persistedCategoryIds: [],
    deletedCategories: [],
  };
}

function importPreview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return {
    filePath: "C:\\data\\tai.patina.csv",
    fileName: "tai.patina.csv",
    fileFingerprint: "abc",
    validRecords: 3,
    duplicateRecords: 0,
    errorRecords: 0,
    exactSessions: 0,
    hourBuckets: 3,
    categoryCandidates: [],
    errors: [],
    ...overrides,
  };
}

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
    categoryCandidates: [
      { exeName: "code.exe", categories: ["开发"] },
      { exeName: "chrome.exe", categories: ["工作", "娱乐"] },
    ],
    errors: [{ line: 4, message: "bad row" }],
  });
  assert.equal(preview.hourBuckets, 3);
  assert.deepEqual(preview.categoryCandidates[1]?.categories, ["工作", "娱乐"]);

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

test("one unique imported category creates a category and classifies repeated rows once", () => {
  const result = buildImportedClassificationDraft(
    emptyClassificationState(),
    [{ exeName: "code.exe", categories: [" 开发 ", "开发"] }],
    { createCategoryId: () => "custom:category_import_development" },
  );

  assert.equal(result.draft.overrides["code.exe"]?.category, "development");
  assert.deepEqual(result.draft.persistedCategoryIds, []);
  assert.equal(result.classifiedApps, 1);
  assert.equal(result.conflictedApps, 0);
});

test("two distinct imported categories keep the app unclassified but create reusable categories", () => {
  let nextId = 0;
  const result = buildImportedClassificationDraft(
    emptyClassificationState(),
    [{ exeName: "chrome.exe", categories: ["工作", "娱乐"] }],
    { createCategoryId: () => `custom:category_import_${++nextId}` as `custom:${string}` },
  );

  assert.equal(result.draft.overrides["chrome.exe"], undefined);
  assert.equal(result.draft.persistedCategoryIds.length, 2);
  assert.deepEqual(
    Object.values(result.draft.categoryLabelOverrides).sort(),
    ["娱乐", "工作"],
  );
  assert.equal(result.classifiedApps, 0);
  assert.equal(result.conflictedApps, 1);
});

test("missing and unknown imported categories leave the app unclassified", () => {
  const result = buildImportedClassificationDraft(
    emptyClassificationState(),
    [
      { exeName: "empty.exe", categories: [] },
      { exeName: "unknown.exe", categories: ["未知"] },
    ],
  );

  assert.deepEqual(result.draft.overrides, {});
  assert.equal(result.categoriesCreated, 0);
  assert.equal(result.classifiedApps, 0);
  assert.equal(result.conflictedApps, 0);
});

test("import classification never overwrites an existing manual category", () => {
  const state = emptyClassificationState();
  state.overrides["code.exe"] = { enabled: true, category: "office" };

  const result = buildImportedClassificationDraft(
    state,
    [{ exeName: "code.exe", categories: ["开发"] }],
  );

  assert.equal(result.draft.overrides["code.exe"]?.category, "office");
  assert.equal(result.preservedManualApps, 1);
});

test("import classification resolves executable aliases before preserving a manual category", () => {
  const state = emptyClassificationState();
  state.overrides["code.exe"] = { enabled: true, category: "office" };

  const result = buildImportedClassificationDraft(
    state,
    [{ exeName: "CODE.EXE", categories: ["开发"] }],
  );

  assert.equal(result.draft.overrides["code.exe"]?.category, "office");
  assert.equal(result.draft.overrides["CODE.EXE"], undefined);
  assert.equal(result.preservedManualApps, 1);
});

test("classification mutations commit atomically with the import and runtime state updates afterward", async () => {
  const events: string[] = [];
  const expectedMutations = [{ key: "__app_override::code.exe", value: "{}" }];
  const report = await commitImportWithClassification(importPreview(), {
    prepareClassification: async () => ({
      mutations: expectedMutations,
      applyRuntime: () => events.push("runtime"),
    }),
    commitImport: async (_preview, mutations) => {
      assert.deepEqual(mutations, expectedMutations);
      events.push("commit");
      return { batchId: "batch-1", importedRecords: 3 };
    },
  });

  assert.equal(report.batchId, "batch-1");
  assert.deepEqual(events, ["commit", "runtime"]);
});

test("failed atomic import never applies prepared classification to runtime", async () => {
  let runtimeApplied = false;
  await assert.rejects(
    commitImportWithClassification(importPreview(), {
      prepareClassification: async () => ({
        mutations: [],
        applyRuntime: () => { runtimeApplied = true; },
      }),
      commitImport: async () => { throw new Error("atomic commit failed"); },
    }),
    /atomic commit failed/,
  );
  assert.equal(runtimeApplied, false);
});

test("a duplicate-only commit never applies prepared classification to runtime", async () => {
  let runtimeApplied = false;
  const report = await commitImportWithClassification(importPreview(), {
    prepareClassification: async () => ({
      mutations: [{ key: "__app_override::code.exe", value: "{}" }],
      applyRuntime: () => { runtimeApplied = true; },
    }),
    commitImport: async () => ({ batchId: null, importedRecords: 0 }),
  });

  assert.equal(report.batchId, null);
  assert.equal(runtimeApplied, false);
});

test("deleting an import batch invalidates read models after the delete and before list refresh", async () => {
  const events: string[] = [];
  const result = await deleteImportBatchWithRefresh("batch-1", {
    deleteImportBatch: async () => {
      events.push("delete");
      return { deletedExactSessions: 2, deletedHourBuckets: 3 };
    },
    onImportedDataChanged: async () => {
      await Promise.resolve();
      events.push("invalidate");
    },
    refreshBatches: async () => {
      events.push("refresh");
      return [];
    },
  });

  assert.deepEqual(events, ["delete", "invalidate", "refresh"]);
  assert.equal(result.report.deletedExactSessions, 2);
  assert.deepEqual(result.batches, []);
});

test("failed import batch deletion does not invalidate read models", async () => {
  let invalidations = 0;
  await assert.rejects(deleteImportBatchWithRefresh("batch-1", {
    deleteImportBatch: async () => {
      throw new Error("delete failed");
    },
    onImportedDataChanged: () => { invalidations += 1; },
    refreshBatches: async () => [],
  }), /delete failed/);
  assert.equal(invalidations, 0);
});

test("classification statistics apply native precedence and clip the requested range", () => {
  const stats = buildObservedSessionStats([
    {
      record_id: 1,
      origin: "native",
      exe_name: "code.exe",
      app_name: "Code",
      start_time: 0,
      effective_end_time: 1_800_000,
      capacity_end_time: null,
    },
    {
      record_id: 2,
      origin: "import_exact",
      exe_name: "code.exe",
      app_name: "External Code",
      start_time: 0,
      effective_end_time: 3_600_000,
      capacity_end_time: null,
    },
    {
      record_id: 3,
      origin: "import_bucket",
      exe_name: "code.exe",
      app_name: "Bucket Code",
      start_time: 0,
      effective_end_time: 3_600_000,
      capacity_end_time: 3_600_000,
    },
  ], 0, 3_600_000);

  const clippedStats = buildObservedSessionStats([{
    record_id: 4,
    origin: "import_exact",
    exe_name: "editor.exe",
    app_name: "Editor",
    start_time: -1_000,
    effective_end_time: 1_000,
    capacity_end_time: null,
  }], 0, 3_600_000);

  const code = stats.find((row) => row.exeName === "code.exe");
  const editor = clippedStats.find((row) => row.exeName === "editor.exe");
  assert.equal(code?.totalDuration, 3_600_000);
  assert.equal(code?.appName, "Code");
  assert.equal(code?.hasNativeRecords, true);
  assert.equal(editor?.totalDuration, 1_000);
  assert.equal(editor?.hasNativeRecords, false);
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
    source.indexOf("async function loadEffectiveAggregateCandidateRows("),
    source.indexOf("export async function getEarliestSessionStartTime("),
  );
  assert.doesNotMatch(historyFunction, /import_time_buckets/);
  assert.match(aggregateFunction, /import_time_buckets/);
  assert.match(aggregateFunction, /bucket_start_time \+ duration/);
  assert.match(aggregateFunction, /resolveNativeSessionPrecedence/);
  assert.match(aggregateFunction, /origin === "import_bucket"/);
});

test("batch deletion removes only orphaned imported app mappings and never native sessions", () => {
  const readRepository = readFileSync("src/platform/persistence/sessionReadRepository.ts", "utf8");
  const historyFunction = readRepository.slice(
    readRepository.indexOf("export async function getSessionsInRange("),
    readRepository.indexOf("export async function getSessionsInRangeWithoutTitleSamples("),
  );
  const importRepository = readFileSync(
    "src-tauri/src/data/repositories/import_batches.rs",
    "utf8",
  );

  assert.match(historyFunction, /import_exact_sessions/);
  assert.doesNotMatch(historyFunction, /import_time_buckets/);
  assert.doesNotMatch(importRepository, /DELETE FROM sessions/i);
  assert.match(importRepository, /has_native_records/);
  assert.match(importRepository, /has_remaining_external_records/);
  assert.match(importRepository, /APP_OVERRIDE_KEY_PREFIX/);
  assert.match(importRepository, /DELETE FROM settings WHERE key = \?/i);
});

test("external backup owner cannot write or delete native sessions", () => {
  const externalBackupSource = readFileSync(
    "src-tauri/src/data/backup/import_data.rs",
    "utf8",
  );
  const externalBackupOwner = externalBackupSource.slice(
    0,
    externalBackupSource.indexOf("#[cfg(test)]"),
  );

  assert.doesNotMatch(externalBackupOwner, /INSERT\s+INTO\s+sessions\b/i);
  assert.doesNotMatch(externalBackupOwner, /UPDATE\s+sessions\b/i);
  assert.doesNotMatch(externalBackupOwner, /DELETE\s+FROM\s+sessions\b/i);
  assert.match(externalBackupOwner, /INSERT INTO import_exact_sessions/);
  assert.match(externalBackupOwner, /INSERT INTO import_time_buckets/);
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
