import assert from "node:assert/strict";
import {
  parseActivityAggregateRange,
  parseActivityCatalogPage,
  parseActivityReadModelStatus,
} from "../src/platform/persistence/activityReadModelGateway.ts";

let passed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

await runTest("catalog payload preserves source flags and diagnostics", () => {
  const parsed = parseActivityCatalogPage({
    rows: [{
      rawExeName: "Code.exe",
      appName: "Visual Studio Code",
      lastSeenMs: 42,
      hasNativeRecords: true,
      hasImportExactRecords: true,
      hasImportBucketRecords: false,
    }],
    nextCursor: { lastSeenMs: 42, rawExeName: "Code.exe" },
    hasMore: false,
    readPath: "projection",
    fallbackReason: null,
    sourceRevision: 7,
  });
  assert.equal(parsed.rows[0].hasImportExactRecords, true);
  assert.equal(parsed.readPath, "projection");
});

await runTest("aggregate payload accepts hybrid active-hour reads", () => {
  const parsed = parseActivityAggregateRange({
    records: [{ appName: "Code", exeName: "code.exe", startTime: 10, endTime: 20 }],
    readPath: "hybrid",
    fallbackReason: "partial_dirty_or_active",
    sourceRevision: 8,
    projectionRowCount: 4,
    factRowCount: 1,
    hasActiveSession: true,
  });
  assert.equal(parsed.hasActiveSession, true);
  assert.equal(parsed.records[0].endTime, 20);
});

await runTest("malformed aggregate and status payloads fail closed", () => {
  assert.throws(() => parseActivityAggregateRange({ records: [], readPath: "cache" }));
  assert.throws(() => parseActivityReadModelStatus({ sourceRevision: "1" }));
});

await runTest("status payload accepts nullable coverage", () => {
  const parsed = parseActivityReadModelStatus({
    sourceRevision: 0,
    appCatalogState: "invalid",
    activityHourlyState: "building",
    activityCoverageStartMs: null,
    activityCoverageEndMs: null,
    dirtyAppCount: 0,
    dirtyRangeCount: 0,
  });
  assert.equal(parsed.activityCoverageStartMs, null);
});

console.log(`Passed ${passed} activity read-model gateway tests`);
