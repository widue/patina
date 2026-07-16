import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

interface IpcInventory {
  called: Set<string>;
  dynamicCalls: string[];
  declared: Set<string>;
  registered: Set<string>;
}

const DYNAMIC_INVOKE_ALLOWLIST = new Map([
  ["src/platform/persistence/commandError.ts:invokeWithCommandError", "typed persistence command wrapper"],
  ["src/platform/persistence/commandError.ts:invokeWithCommandErrorUsing", "dependency-injected command wrapper covered by mutation tests"],
  ["src/platform/runtime/toolsRuntimeGateway.ts:invokeToolsSnapshot", "typed tools snapshot parser wrapper"],
]);

// Commands intentionally invoked by Rust runtime, auxiliary windows, or tests rather than src/platform.
const RUNTIME_ONLY_COMMANDS = new Map<string, string>([
]);

function normalizePath(path: string) {
  return path.split(sep).join("/");
}

function collectFiles(root: string, extension: RegExp): string[] {
  const files: string[] = [];
  function walk(path: string) {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry));
    } else if (extension.test(path)) {
      files.push(path);
    }
  }
  walk(root);
  return files;
}

function collectFrontendCalls(path: string, sourceText: string) {
  const called = new Set<string>();
  const dynamicCalls: string[] = [];
  const constants = new Map<string, string>();
  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isStringLiteralLike(node.initializer)) {
      constants.set(node.name.text, node.initializer.text);
    }

    if (ts.isCallExpression(node) && (
      (ts.isIdentifier(node.expression) && node.expression.text.startsWith("invoke"))
      || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "invoke")
    )) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) {
        called.add(argument.text);
      } else if (argument && ts.isIdentifier(argument) && constants.has(argument.text)) {
        called.add(constants.get(argument.text)!);
      } else {
        const owner = findContainingFunction(node);
        dynamicCalls.push(`${path}:${owner}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  function findContainingFunction(node: ts.Node) {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
      current = current.parent;
    }
    return "<module>";
  }

  visit(source);
  return { called, dynamicCalls };
}

function collectRustCommands(sourceText: string) {
  const declared = new Set<string>();
  const registered = new Set<string>();
  const commandPattern = /#\s*\[\s*tauri::command(?:\([^\]]*\))?\s*\][\s\S]*?\b(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const match of sourceText.matchAll(commandPattern)) declared.add(match[1]);

  const handlerPattern = /generate_handler!\s*\[([\s\S]*?)\]/g;
  for (const handler of sourceText.matchAll(handlerPattern)) {
    for (const command of handler[1].matchAll(/(?:[A-Za-z_][A-Za-z0-9_]*::)+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      registered.add(command[1]);
    }
  }
  return { declared, registered };
}

function inventory(): IpcInventory {
  const called = new Set<string>();
  const dynamicCalls: string[] = [];
  for (const absolute of collectFiles("src/platform", /\.tsx?$/)) {
    const path = normalizePath(relative(process.cwd(), absolute));
    const result = collectFrontendCalls(path, readFileSync(absolute, "utf8"));
    result.called.forEach((command) => called.add(command));
    dynamicCalls.push(...result.dynamicCalls);
  }

  const declared = new Set<string>();
  const registered = new Set<string>();
  for (const absolute of collectFiles("src-tauri/src/commands", /\.rs$/)) {
    collectRustCommands(readFileSync(absolute, "utf8")).declared.forEach((command) => declared.add(command));
  }
  collectRustCommands(readFileSync("src-tauri/src/app/bootstrap.rs", "utf8"))
    .registered.forEach((command) => registered.add(command));
  return { called, dynamicCalls, declared, registered };
}

function difference(left: Set<string>, right: Set<string>) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function validate(result: IpcInventory) {
  const failures: string[] = [];
  for (const dynamic of result.dynamicCalls.sort()) {
    if (!DYNAMIC_INVOKE_ALLOWLIST.has(dynamic)) failures.push(`dynamic invoke is not allowed: ${dynamic}`);
  }
  for (const command of difference(result.called, result.registered)) {
    failures.push(`frontend command is not registered: ${command}`);
  }
  for (const command of difference(result.declared, result.registered)) {
    failures.push(`Rust command exists but is not registered: ${command}`);
  }
  for (const command of difference(result.registered, result.called)) {
    if (!RUNTIME_ONLY_COMMANDS.has(command)) {
      failures.push(`registered command has no platform caller or runtime-only reason: ${command}`);
    }
  }
  return failures;
}

function runSelfTest() {
  const frontend = collectFrontendCalls(
    "src/platform/demo.ts",
    "const KNOWN = 'cmd_known'; invoke(KNOWN); invokeWithCommandError('cmd_typed'); function proxy(name: string) { invoke(name); }",
  );
  const rust = collectRustCommands(
    "#[tauri::command]\nasync fn cmd_known() {}\n#[tauri::command]\nfn cmd_typed() {}\ngenerate_handler![commands::cmd_known, commands::cmd_typed]",
  );
  const failures = validate({
    called: frontend.called,
    dynamicCalls: [],
    declared: rust.declared,
    registered: rust.registered,
  });
  if (failures.length > 0 || frontend.dynamicCalls[0] !== "src/platform/demo.ts:proxy") {
    throw new Error(`IPC contract self-test failed: ${failures.join("; ")}`);
  }

  const missing = validate({
    called: new Set(["cmd_typo"]),
    dynamicCalls: [],
    declared: new Set(["cmd_known"]),
    registered: new Set(["cmd_known"]),
  });
  if (!missing.some((failure) => failure.includes("cmd_typo"))) {
    throw new Error("IPC contract self-test did not catch a missing registration");
  }
}

runSelfTest();
if (process.argv.includes("--self-test")) {
  console.log("IPC contract self-test passed");
  process.exit(0);
}

const result = inventory();
const failures = validate(result);
if (process.argv.includes("--report")) {
  console.log(JSON.stringify({
    called: [...result.called].sort(),
    declared: [...result.declared].sort(),
    registered: [...result.registered].sort(),
    dynamicCalls: result.dynamicCalls.sort(),
    failures,
  }, null, 2));
  process.exit(0);
}
if (failures.length > 0) {
  console.error("IPC contract check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`IPC contract check passed (${result.called.size} platform calls, ${result.registered.size} registered commands)`);
