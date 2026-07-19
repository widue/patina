import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  buildRecordedAppCatalogQuery,
  type RecordedAppCatalogCursor,
  type RecordedAppCatalogPage,
} from "../src/platform/persistence/classificationPersistence.ts";
import {
  CLASSIFICATION_APP_CATALOG_CARD_LIMIT,
  CLASSIFICATION_APP_CATALOG_MAX_RAW_PAGES,
  ClassificationAppCatalogController,
  loadClassificationAppCatalogBatch,
} from "../src/features/classification/services/classificationAppCatalog.ts";

let passed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

function createCatalogFixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
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
  `);
  return db;
}

function selectRecordedPage(
  db: DatabaseSync,
  cursor: RecordedAppCatalogCursor | null,
  searchQuery: string,
  limit: number,
): RecordedAppCatalogPage {
  const query = buildRecordedAppCatalogQuery({ cursor, searchQuery, limit });
  const rows = db.prepare(query.sql).all(...query.params).map((row) => ({
    rawExeName: String(row.exe_name),
    appName: String(row.app_name),
    lastSeenMs: Number(row.last_seen_ms),
    hasNativeRecords: Number(row.has_native_records) === 1,
  }));
  const last = rows.at(-1);
  return {
    rows,
    nextCursor: last
      ? { lastSeenMs: last.lastSeenMs, rawExeName: last.rawExeName }
      : cursor,
    hasMore: rows.length === limit,
  };
}

await runTest("recorded catalog reaches native and imported applications older than 30 days", () => {
  const db = createCatalogFixture();
  db.exec(`
    INSERT INTO sessions VALUES (1, 'recent.exe', 'Recent', 2000, 3000);
    INSERT INTO import_exact_sessions VALUES (1, 'year-old.exe', 'Year Old', 100, 200);
    INSERT INTO import_time_buckets VALUES (1, 'bucket-only.exe', 'Bucket Only', 50, 60000);
  `);

  const page = selectRecordedPage(db, null, "", 10);
  assert.deepEqual(page.rows.map((row) => row.rawExeName), [
    "recent.exe",
    "year-old.exe",
    "bucket-only.exe",
  ]);
  assert.equal(page.rows[0].hasNativeRecords, true);
  assert.equal(page.rows[2].hasNativeRecords, false);
  db.close();
});

await runTest("recorded catalog keyset cursor is stable for equal last-seen values", () => {
  const db = createCatalogFixture();
  db.exec(`
    INSERT INTO sessions VALUES (1, 'alpha.exe', 'Alpha', 1000, 1100);
    INSERT INTO sessions VALUES (2, 'bravo.exe', 'Bravo', 1000, 1100);
    INSERT INTO sessions VALUES (3, 'charlie.exe', 'Charlie', 900, 1000);
  `);

  const first = selectRecordedPage(db, null, "", 2);
  const second = selectRecordedPage(db, first.nextCursor, "", 2);
  assert.deepEqual(first.rows.map((row) => row.rawExeName), ["alpha.exe", "bravo.exe"]);
  assert.deepEqual(second.rows.map((row) => row.rawExeName), ["charlie.exe"]);
  db.close();
});

await runTest("recorded catalog search treats percent underscore and backslash literally", () => {
  const db = createCatalogFixture();
  db.exec(`
    INSERT INTO sessions VALUES (1, 'literal%app.exe', 'Percent', 3000, 3100);
    INSERT INTO sessions VALUES (2, 'literal_app.exe', 'Underscore', 2000, 2100);
    INSERT INTO sessions VALUES (3, 'literal\\app.exe', 'Backslash', 1000, 1100);
    INSERT INTO sessions VALUES (4, 'ordinary.exe', 'Ordinary', 900, 1000);
  `);

  assert.deepEqual(selectRecordedPage(db, null, "%", 10).rows.map((row) => row.rawExeName), ["literal%app.exe"]);
  assert.deepEqual(selectRecordedPage(db, null, "_", 10).rows.map((row) => row.rawExeName), ["literal_app.exe"]);
  assert.deepEqual(selectRecordedPage(db, null, "\\", 10).rows.map((row) => row.rawExeName), ["literal\\app.exe"]);
  db.close();
});

await runTest("recorded catalog search keeps SQL injection payloads as data", () => {
  const db = createCatalogFixture();
  db.exec("INSERT INTO sessions VALUES (1, 'safe.exe', 'Safe', 1000, 1100)");
  const payload = "' OR 1=1; DROP TABLE sessions; --";
  assert.deepEqual(selectRecordedPage(db, null, payload, 10).rows, []);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions").get()!.count, 1);
  db.close();
});

await runTest("catalog batch canonicalizes duplicates across raw pages", async () => {
  const pages: RecordedAppCatalogPage[] = [
    {
      rows: [
        { rawExeName: "Code.exe", appName: "Code", lastSeenMs: 300, hasNativeRecords: true },
        { rawExeName: "code.exe", appName: "Visual Studio Code", lastSeenMs: 200, hasNativeRecords: false },
      ],
      nextCursor: { lastSeenMs: 200, rawExeName: "code.exe" },
      hasMore: true,
    },
    {
      rows: [
        { rawExeName: "notes.exe", appName: "Notes", lastSeenMs: 100, hasNativeRecords: false },
      ],
      nextCursor: { lastSeenMs: 100, rawExeName: "notes.exe" },
      hasMore: false,
    },
  ];
  let call = 0;
  const result = await loadClassificationAppCatalogBatch({
    cursor: null,
    searchQuery: "",
    seenExeNames: [],
  }, {
    loadRecordedPage: async () => pages[call++],
  });

  assert.deepEqual(result.candidates.map((candidate) => candidate.exeName), ["code.exe", "notes.exe"]);
  assert.equal(result.candidates[0].hasNativeRecords, true);
  assert.equal(call, 2);
});

await runTest("catalog batch stops after the bounded raw-page scan budget", async () => {
  let calls = 0;
  const result = await loadClassificationAppCatalogBatch({
    cursor: null,
    searchQuery: "",
    seenExeNames: ["repeat.exe"],
  }, {
    loadRecordedPage: async ({ cursor }) => {
      calls += 1;
      return {
        rows: [{ rawExeName: "repeat.exe", appName: "Repeat", lastSeenMs: 1000 - calls, hasNativeRecords: true }],
        nextCursor: { lastSeenMs: 1000 - calls, rawExeName: `repeat-${calls}.exe` },
        hasMore: true,
      };
    },
  });

  assert.equal(calls, CLASSIFICATION_APP_CATALOG_MAX_RAW_PAGES);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.hasMore, true);
});

await runTest("catalog never revives applications from classification mappings alone", async () => {
  const result = await loadClassificationAppCatalogBatch({
    cursor: null,
    searchQuery: "",
    seenExeNames: ["recorded.exe"],
  }, {
    loadRecordedPage: async () => ({ rows: [], nextCursor: null, hasMore: false }),
  });

  assert.deepEqual(result.candidates, []);
  assert.equal(result.hasMore, false);
});

await runTest("search results also require an underlying activity record", async () => {
  const result = await loadClassificationAppCatalogBatch({
    cursor: null,
    searchQuery: "previous alias",
    seenExeNames: [],
  }, {
    loadRecordedPage: async () => ({ rows: [], nextCursor: null, hasMore: false }),
  });
  assert.deepEqual(result.candidates, []);
});

await runTest("catalog output never exceeds its canonical card boundary", async () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    rawExeName: `app-${String(index).padStart(3, "0")}.exe`,
    appName: `App ${index}`,
    lastSeenMs: 1000 - index,
    hasNativeRecords: true,
  }));
  const result = await loadClassificationAppCatalogBatch({
    cursor: null,
    searchQuery: "",
    seenExeNames: [],
  }, {
    loadRecordedPage: async () => ({
      rows,
      nextCursor: { lastSeenMs: rows.at(-1)!.lastSeenMs, rawExeName: rows.at(-1)!.rawExeName },
      hasMore: true,
    }),
  });
  assert.equal(result.candidates.length, CLASSIFICATION_APP_CATALOG_CARD_LIMIT);
  assert.equal(result.hasMore, true);
});

await runTest("catalog controller automatically exhausts every internal batch", async () => {
  const db = createCatalogFixture();
  const insert = db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)");
  for (let index = 0; index < 130; index += 1) {
    insert.run(index + 1, `app-${String(index).padStart(3, "0")}.exe`, `App ${index}`, 10_000 - index, 20_000 - index);
  }
  const collected: string[] = [];
  let batches = 0;
  const controller = new ClassificationAppCatalogController({
    loadRecordedPage: async ({ cursor, searchQuery, limit }) => (
      selectRecordedPage(db, cursor, searchQuery, limit)
    ),
  });
  const completed = await controller.loadAll({
    onBatch: (candidates) => {
      batches += 1;
      collected.push(...candidates.map((candidate) => candidate.exeName));
    },
  });
  assert.equal(completed, true);
  assert.equal(collected.length, 130);
  assert.equal(new Set(collected).size, 130);
  assert.ok(batches >= 3);
  db.close();
});

await runTest("only the latest catalog generation may update visible state", () => {
});

console.log(`Passed ${passed} classification app catalog tests`);
