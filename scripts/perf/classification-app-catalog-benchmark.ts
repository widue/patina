import { DatabaseSync } from "node:sqlite";
import {
  buildRecordedAppCatalogQuery,
  type RecordedAppCatalogCursor,
} from "../../src/platform/persistence/classificationPersistence.ts";
import {
  measureBenchmark,
  printBenchmarkReport,
  type BenchmarkMeasurement,
} from "./benchmarkUtils.ts";

const NATIVE_RECORD_COUNT = 80_000;
const EXACT_RECORD_COUNT = 20_000;
const BUCKET_RECORD_COUNT = 10_000;
const APP_COUNT = 1_500;
const PAGE_LIMIT = 120;
const ITERATIONS = 12;
const QUERY_BUDGET_MS = 250;

const db = new DatabaseSync(":memory:");
db.exec(`
  PRAGMA journal_mode = MEMORY;
  PRAGMA synchronous = OFF;
  PRAGMA temp_store = MEMORY;
  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    exe_name TEXT NOT NULL,
    app_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER
  );
  CREATE TABLE import_exact_sessions (
    id INTEGER PRIMARY KEY,
    exe_name TEXT NOT NULL,
    app_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL
  );
  CREATE TABLE import_time_buckets (
    id INTEGER PRIMARY KEY,
    exe_name TEXT NOT NULL,
    app_name TEXT,
    bucket_start_time INTEGER NOT NULL,
    duration INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_exe_usage_time ON sessions(exe_name, start_time);
  CREATE INDEX idx_import_exact_sessions_exe_time ON import_exact_sessions(exe_name, start_time);
  CREATE INDEX idx_import_time_buckets_exe_time ON import_time_buckets(exe_name, bucket_start_time);
  BEGIN;
`);

const nativeInsert = db.prepare(
  "INSERT INTO sessions (id, exe_name, app_name, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
);
const exactInsert = db.prepare(
  "INSERT INTO import_exact_sessions (id, exe_name, app_name, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
);
const bucketInsert = db.prepare(
  "INSERT INTO import_time_buckets (id, exe_name, app_name, bucket_start_time, duration) VALUES (?, ?, ?, ?, ?)",
);

function appExe(index: number) {
  return `catalog-perf-${String(index % APP_COUNT).padStart(4, "0")}.exe`;
}

for (let index = 0; index < NATIVE_RECORD_COUNT; index += 1) {
  const exeName = appExe(index);
  nativeInsert.run(index + 1, exeName, `Native App ${index % APP_COUNT}`, index * 1_000, index * 1_000 + 500);
}
for (let index = 0; index < EXACT_RECORD_COUNT; index += 1) {
  const exeName = appExe(index + 300);
  exactInsert.run(index + 1, exeName, `Imported App ${index % APP_COUNT}`, index * 1_200, index * 1_200 + 600);
}
for (let index = 0; index < BUCKET_RECORD_COUNT; index += 1) {
  const exeName = appExe(index + 600);
  bucketInsert.run(index + 1, exeName, `Bucket App ${index % APP_COUNT}`, index * 3_600_000, 60_000);
}
db.exec("COMMIT; ANALYZE;");

function selectPage(cursor: RecordedAppCatalogCursor | null, searchQuery: string) {
  const query = buildRecordedAppCatalogQuery({ cursor, searchQuery, limit: PAGE_LIMIT });
  return db.prepare(query.sql).all(...query.params) as Array<{
    exe_name: string;
    last_seen_ms: number;
  }>;
}

const firstRows = selectPage(null, "");
const firstLast = firstRows[firstRows.length - 1];
const deepCursor: RecordedAppCatalogCursor = {
  lastSeenMs: Number(firstLast.last_seen_ms),
  rawExeName: String(firstLast.exe_name),
};

const firstPage = measureBenchmark("classification-catalog-first-page", ITERATIONS, QUERY_BUDGET_MS, () => {
  void selectPage(null, "");
});
const deepPage = measureBenchmark("classification-catalog-deep-page", ITERATIONS, QUERY_BUDGET_MS, () => {
  void selectPage(deepCursor, "");
});
const searchPage = measureBenchmark("classification-catalog-search", ITERATIONS, QUERY_BUDGET_MS, () => {
  void selectPage(null, "Native App 1499");
});

const planQuery = buildRecordedAppCatalogQuery({ cursor: null, searchQuery: "", limit: PAGE_LIMIT });
const queryPlan = db.prepare(`EXPLAIN QUERY PLAN ${planQuery.sql}`)
  .all(...planQuery.params)
  .map((row) => String(row.detail));
const baseTables = ["sessions", "import_exact_sessions", "import_time_buckets"];
const baseTableScans = queryPlan.filter((detail) => (
  baseTables.some((table) => detail.includes(`SCAN ${table}`))
  && !detail.includes("USING INDEX")
  && !detail.includes("USING COVERING INDEX")
));

for (const measurement of [firstPage, deepPage, searchPage] as Array<BenchmarkMeasurement & { usesTableScan?: boolean }>) {
  measurement.usesTableScan = baseTableScans.length > 0;
}

printBenchmarkReport({
  benchmark: "classification-app-catalog",
  measuredAt: new Date().toISOString(),
  measurements: [firstPage, deepPage, searchPage],
  metadata: {
    fixture: {
      nativeRecords: NATIVE_RECORD_COUNT,
      exactImportRecords: EXACT_RECORD_COUNT,
      bucketImportRecords: BUCKET_RECORD_COUNT,
      distinctApps: APP_COUNT,
      returnedRows: firstRows.length,
    },
    queryPlan,
    baseTableScans,
  },
});

db.close();
