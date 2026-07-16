import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { CdpConnection, delay, waitFor } from "./uiBrowserSmoke/browserHarness.ts";

const STARTUP_TIMEOUT_MS = 180_000;

async function reservePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function findMainTarget(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return null;
    const targets = await response.json() as Array<{
      type?: string;
      url?: string;
      webSocketDebuggerUrl?: string;
    }>;
    return targets.find((target) => target.type === "page"
      && target.url?.startsWith("http://127.0.0.1:1420")
      && target.webSocketDebuggerUrl) ?? null;
  } catch {
    return null;
  }
}

async function evaluate(client: CdpConnection, expression: string) {
  const response = await client.command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return (response.result as { value?: unknown } | undefined)?.value;
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcessTree(child: ChildProcess) {
  if (!child.pid) return null;
  const pid = child.pid;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
    });
    if ((result.error || result.status !== 0) && isProcessRunning(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // The process may have exited between the liveness check and the fallback.
      }
    }
  } else {
    child.kill("SIGTERM");
  }
  return pid;
}

function verifyDatabase(dbPath: string) {
  const script = [
    "import sqlite3, sys",
    "db = sqlite3.connect(sys.argv[1])",
    "integrity = db.execute('PRAGMA integrity_check').fetchone()[0]",
    "value = db.execute(\"SELECT value FROM settings WHERE key='refresh_interval_secs'\").fetchone()",
    "db.close()",
    "assert integrity == 'ok', integrity",
    "assert value == ('77',), value",
  ].join("; ");
  const result = spawnSync("python", ["-c", script, dbPath], { encoding: "utf8" });
  assert.equal(result.status, 0, `database verification failed: ${result.stderr || result.stdout}`);
}

const root = mkdtempSync(join(tmpdir(), "patina-tauri-e2e-"));
const devtoolsPort = await reservePort();
const logs: string[] = [];
let appProcess: ChildProcess | null = null;
let viteProcess: ChildProcess | null = null;
let client: CdpConnection | null = null;

try {
  const build = spawnSync("cargo", [
    "build",
    "--manifest-path",
    join(process.cwd(), "src-tauri", "Cargo.toml"),
    "--locked",
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(build.status, 0, `Tauri debug build failed: ${build.stderr || build.stdout}`);

  viteProcess = spawn(process.execPath, [
    join(process.cwd(), "node_modules", "vite", "bin", "vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "1420",
    "--strictPort",
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  viteProcess.stdout?.on("data", (chunk) => logs.push(String(chunk)));
  viteProcess.stderr?.on("data", (chunk) => logs.push(String(chunk)));
  await waitFor("Vite dev server", async () => {
    try {
      return (await fetch("http://127.0.0.1:1420")).ok;
    } catch {
      return null;
    }
  }, 30_000);

  appProcess = spawn(join(process.cwd(), "src-tauri", "target", "debug", "patina.exe"), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATINA_E2E: "1",
      PATINA_E2E_DATA_ROOT: root,
      WEBVIEW2_USER_DATA_FOLDER: join(root, "webview-user-data"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${devtoolsPort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  appProcess.stdout?.on("data", (chunk) => logs.push(String(chunk)));
  appProcess.stderr?.on("data", (chunk) => logs.push(String(chunk)));

  const target = await waitFor(
    "Patina main WebView CDP target",
    () => findMainTarget(devtoolsPort),
    STARTUP_TIMEOUT_MS,
  );
  client = await CdpConnection.connect(target.webSocketDebuggerUrl!);
  await client.command("Runtime.enable");
  await client.command("Page.enable");
  await waitFor(
    "real Tauri runtime",
    async () => evaluate(client!, "Boolean(window.__TAURI_INTERNALS__ && document.querySelector('#root')?.children.length)"),
    30_000,
  );

  const storage = await evaluate(client, `window.__TAURI_INTERNALS__.invoke("cmd_get_storage_snapshot")`);
  assert.equal(typeof storage, "object");

  await evaluate(client, `
    (async () => {
      window.__patinaE2eEvents = [];
      const handler = window.__TAURI_INTERNALS__.transformCallback(
        (event) => window.__patinaE2eEvents.push(event.event),
      );
      await window.__TAURI_INTERNALS__.invoke("plugin:event|listen", {
        event: "app-settings-changed",
        target: { kind: "Any" },
        handler,
      });
      return true;
    })()
  `);
  await evaluate(client, `window.__TAURI_INTERNALS__.invoke("cmd_commit_app_settings", {
    mutations: [{ key: "refresh_interval_secs", value: "77" }],
  })`);
  await waitFor(
    "Rust to frontend settings event",
    async () => evaluate(client!, "window.__patinaE2eEvents?.includes('app-settings-changed')"),
    10_000,
  );

  const rows = await evaluate(client, `window.__TAURI_INTERNALS__.invoke("plugin:sql|select", {
    db: "sqlite:patina.db",
    query: "SELECT value FROM settings WHERE key = ?",
    values: ["refresh_interval_secs"],
  })`);
  assert.deepEqual(rows, [{ value: "77" }]);

  const deniedWrite = await evaluate(client, `
    window.__TAURI_INTERNALS__.invoke("plugin:sql|execute", {
      db: "sqlite:patina.db",
      query: "DELETE FROM settings",
      values: [],
    }).then(() => null, (error) => String(error))
  `);
  assert.match(String(deniedWrite), /not allowed|permission|denied/i);

  const structuredError = await evaluate(client, `
    window.__TAURI_INTERNALS__.invoke("cmd_commit_app_settings", {
      mutations: [{ key: "not_allowed", value: "1" }],
    }).then(() => null, (error) => error)
  `) as { code?: string; retryable?: boolean };
  assert.equal(structuredError.code, "SQLITE_INVALID_INPUT");
  assert.equal(structuredError.retryable, false);

  console.log("PASS real Tauri runtime command/event/SQLite/capability smoke");
} catch (error) {
  console.error(logs.join(""));
  throw error;
} finally {
  client?.close();
  const appPid = appProcess ? stopProcessTree(appProcess) : null;
  const vitePid = viteProcess ? stopProcessTree(viteProcess) : null;
  for (const [label, pid] of [["Tauri app", appPid], ["Vite server", vitePid]] as const) {
    if (!pid) continue;
    await waitFor(`${label} process exit`, () => isProcessRunning(pid) ? null : true, 10_000);
  }
  await delay(250);
  const dbPath = join(root, "data", "patina.db");
  if (existsSync(dbPath)) verifyDatabase(dbPath);
  await waitFor("isolated runtime directory cleanup", () => {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
      return !existsSync(root);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
      if (code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY") return null;
      throw error;
    }
  }, 20_000);
}
