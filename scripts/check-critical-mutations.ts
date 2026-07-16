import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

const TEMP_ROOT = resolve(".tmp/critical-mutations");
const SQLITE_SOURCE = "src/platform/persistence/sqliteTransactions.ts";
const ERROR_SOURCE = "src/platform/persistence/commandError.ts";

interface Mutant {
  name: string;
  source: typeof SQLITE_SOURCE | typeof ERROR_SOURCE;
  search: string;
  replacement: string;
}

const MUTANTS: Mutant[] = [
  {
    name: "batch stops awaiting writes",
    source: SQLITE_SOURCE,
    search: "await executor.execute(operation.query, operation.values);",
    replacement: "void executor.execute(operation.query, operation.values);",
  },
  {
    name: "batch executes only first write",
    source: SQLITE_SOURCE,
    search: "for (const operation of operations) {",
    replacement: "for (const operation of operations.slice(0, 1)) {",
  },
  {
    name: "serialized runner skips predecessor",
    source: SQLITE_SOURCE,
    search: "await previous;",
    replacement: "await Promise.resolve();",
  },
  {
    name: "serialized runner never releases successor",
    source: SQLITE_SOURCE,
    search: "releaseCurrent();",
    replacement: "void 0;",
  },
  {
    name: "retryability is inverted",
    source: ERROR_SOURCE,
    search: "return parseCommandError(error).retryable;",
    replacement: "return !parseCommandError(error).retryable;",
  },
  {
    name: "malformed structured errors are accepted",
    source: ERROR_SOURCE,
    search: "typeof (value as Record<string, unknown>).retryable === \"boolean\"",
    replacement: "true",
  },
  {
    name: "native error message is discarded",
    source: ERROR_SOURCE,
    search: "value instanceof Error ? value.message : UNKNOWN_COMMAND_ERROR.message",
    replacement: "UNKNOWN_COMMAND_ERROR.message",
  },
  {
    name: "invoke rejection bypasses normalization",
    source: ERROR_SOURCE,
    search: "throw parseCommandError(error);",
    replacement: "throw error;",
  },
];

function transpile(sourcePath: string, mutation?: Mutant) {
  let source = readFileSync(sourcePath, "utf8");
  if (sourcePath === ERROR_SOURCE) {
    source = source.replace(
      'import { invoke } from "@tauri-apps/api/core";',
      "const invoke = async () => { throw new Error('unconfigured invoke'); };",
    );
  }
  if (mutation) {
    assert(source.includes(mutation.search), `stale mutant search: ${mutation.name}`);
    source = source.replace(mutation.search, mutation.replacement);
  }
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function importMutant(sourcePath: string, mutation?: Mutant) {
  const suffix = mutation ? MUTANTS.indexOf(mutation).toString() : "baseline";
  const outputPath = resolve(TEMP_ROOT, `${sourcePath.includes("sqlite") ? "sqlite" : "error"}-${suffix}.mjs`);
  writeFileSync(outputPath, transpile(sourcePath, mutation), "utf8");
  return import(`${pathToFileURL(outputPath).href}?run=${Date.now()}`);
}

async function withTimeout<T>(promise: Promise<T>, milliseconds = 200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("mutation timeout")), milliseconds)),
  ]);
}

async function verifySqlite(module: Record<string, unknown>) {
  const executeBatch = module.executeWriteBatchWithExecutor as (
    executor: { execute(query: string): Promise<void> },
    operations: Array<{ query: string }>,
  ) => Promise<void>;
  const createRunner = module.createSerializedJobRunner as () => <T>(job: () => Promise<T>) => Promise<T>;

  const writes: string[] = [];
  await executeBatch({ execute: async (query) => { writes.push(query); } }, [{ query: "a" }, { query: "b" }]);
  assert.deepEqual(writes, ["a", "b"]);

  await assert.rejects(executeBatch({
    execute: async (query) => {
      if (query === "b") throw new Error("stop");
      writes.push(query);
    },
  }, [{ query: "a" }, { query: "b" }, { query: "c" }]), /stop/);

  const run = createRunner();
  const order: string[] = [];
  let releaseSlowJob!: () => void;
  const slowJobGate = new Promise<void>((resolve) => {
    releaseSlowJob = resolve;
  });
  const slowJob = run(async () => {
    order.push("slow:start");
    await slowJobGate;
    order.push("slow:end");
  });
  const fastJob = run(async () => { order.push("fast"); });
  await Promise.resolve();
  assert.deepEqual(order, ["slow:start"]);
  releaseSlowJob();
  await withTimeout(Promise.all([slowJob, fastJob]));
  assert.deepEqual(order, ["slow:start", "slow:end", "fast"]);
}

async function verifyError(module: Record<string, unknown>) {
  const parse = module.parseCommandError as (value: unknown) => { code: string; message: string; retryable: boolean };
  const retryable = module.isRetryableCommandError as (value: unknown) => boolean;
  const invokeUsing = module.invokeWithCommandErrorUsing as (
    invokeCommand: () => Promise<never>,
    command: string,
  ) => Promise<unknown>;

  const busy = { code: "SQLITE_BUSY", message: "later", retryable: true };
  assert.equal(retryable(busy), true);
  assert.equal(retryable({ ...busy, retryable: false }), false);
  assert.deepEqual(parse({ message: "partial" }), {
    code: "UNKNOWN_COMMAND_ERROR",
    message: "The operation could not be completed.",
    retryable: false,
  });
  assert.deepEqual(parse({ code: "SQLITE_BUSY", message: "later", retryable: "yes" }), {
    code: "UNKNOWN_COMMAND_ERROR",
    message: "The operation could not be completed.",
    retryable: false,
  });
  assert.equal(parse(new Error("native failure")).message, "native failure");
  await assert.rejects(
    invokeUsing(async () => { throw new Error("backend failure"); }, "cmd_fail"),
    (error) => {
      const candidate = error as { code?: unknown; message?: unknown; retryable?: unknown };
      return candidate.code === "UNKNOWN_COMMAND_ERROR"
        && candidate.message === "backend failure"
        && candidate.retryable === false;
    },
  );
}

async function verify(module: Record<string, unknown>, source: Mutant["source"]) {
  if (source === SQLITE_SOURCE) await verifySqlite(module);
  else await verifyError(module);
}

async function verifyMutant(mutant: Mutant) {
  const detachedRejections: unknown[] = [];
  const captureDetachedRejection = (reason: unknown) => detachedRejections.push(reason);
  process.on("unhandledRejection", captureDetachedRejection);
  try {
    await verify(await importMutant(mutant.source, mutant), mutant.source);
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (detachedRejections.length > 0) {
      throw new Error(`mutant created ${detachedRejections.length} detached rejection(s)`);
    }
  } finally {
    process.off("unhandledRejection", captureDetachedRejection);
  }
}

rmSync(TEMP_ROOT, { recursive: true, force: true });
mkdirSync(TEMP_ROOT, { recursive: true });
try {
  await verify(await importMutant(SQLITE_SOURCE), SQLITE_SOURCE);
  await verify(await importMutant(ERROR_SOURCE), ERROR_SOURCE);

  let killed = 0;
  for (const mutant of MUTANTS) {
    try {
      await verifyMutant(mutant);
      console.error(`SURVIVED ${mutant.name}`);
    } catch {
      killed += 1;
      console.log(`KILLED ${mutant.name}`);
    }
  }

  const score = (killed / MUTANTS.length) * 100;
  console.log(`Critical mutation score: ${killed}/${MUTANTS.length} (${score.toFixed(1)}%)`);
  if (score < 80) process.exitCode = 1;
} finally {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
}
