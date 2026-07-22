import { serialize } from "node:v8";

interface SyntheticRecord {
  appName: string;
  exeName: string;
  startTime: number;
  endTime: number;
  windowTitle?: string;
}

const FACT_ROW_COUNT = 48_000;
const PROJECTION_ROW_COUNT = 365 * 12;
const RANGE_START_MS = 1_750_000_000_000;

function buildLegacyFacts(): SyntheticRecord[] {
  return Array.from({ length: FACT_ROW_COUNT }, (_, index) => ({
    appName: `Application ${index % 12}`,
    exeName: `app-${index % 12}.exe`,
    windowTitle: `Synthetic document ${index}`,
    startTime: RANGE_START_MS + index * 11 * 60_000,
    endTime: RANGE_START_MS + index * 11 * 60_000 + 5 * 60_000,
  }));
}

function buildProjectionRows(): SyntheticRecord[] {
  return Array.from({ length: PROJECTION_ROW_COUNT }, (_, index) => ({
    appName: `Application ${index % 12}`,
    exeName: `app-${index % 12}.exe`,
    startTime: RANGE_START_MS + Math.floor(index / 12) * 24 * 60 * 60_000,
    endTime: RANGE_START_MS + Math.floor(index / 12) * 24 * 60 * 60_000 + 30 * 60_000,
  }));
}

function measureRetainedHeap(factory: () => SyntheticRecord[]) {
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  const value = factory();
  global.gc?.();
  const after = process.memoryUsage().heapUsed;
  return {
    value,
    retainedHeapBytes: Math.max(0, after - before),
  };
}

let legacy = measureRetainedHeap(buildLegacyFacts);
const legacySerializedBytes = serialize(legacy.value).byteLength;
legacy.value = [];
global.gc?.();

let projection = measureRetainedHeap(buildProjectionRows);
const projectionSerializedBytes = serialize(projection.value).byteLength;
projection.value = [];
global.gc?.();

const rowReduction = 1 - PROJECTION_ROW_COUNT / FACT_ROW_COUNT;
const byteReduction = 1 - projectionSerializedBytes / legacySerializedBytes;
const heapReduction = legacy.retainedHeapBytes > 0
  ? 1 - projection.retainedHeapBytes / legacy.retainedHeapBytes
  : null;

console.log(JSON.stringify({
  benchmark: "activity-read-model-payload",
  measuredAt: new Date().toISOString(),
  metadata: {
    factRows: FACT_ROW_COUNT,
    projectionRows: PROJECTION_ROW_COUNT,
    note: "Synthetic retained-object and serialized-payload comparison; process private working set is measured separately in runtime smoke.",
  },
  measurements: [
    {
      name: "legacy-year-facts",
      rowCount: FACT_ROW_COUNT,
      serializedBytes: legacySerializedBytes,
      retainedHeapBytes: legacy.retainedHeapBytes,
    },
    {
      name: "projection-year-day-app",
      rowCount: PROJECTION_ROW_COUNT,
      serializedBytes: projectionSerializedBytes,
      retainedHeapBytes: projection.retainedHeapBytes,
    },
  ],
  reductions: {
    rowsPercent: rowReduction * 100,
    serializedBytesPercent: byteReduction * 100,
    retainedHeapPercent: heapReduction === null ? null : heapReduction * 100,
  },
}, null, 2));
