import { readFileSync } from "node:fs";

interface HotspotBudget {
  path: string;
  owner: string;
  maxLines: number;
}

const HOTSPOT_BUDGETS: HotspotBudget[] = [
  // Includes shared Quiet Pro controls that previously lived in unowned feature/shared CSS.
  { path: "src/styles/quiet-pro.css", owner: "Quiet Pro design system", maxLines: 2008 },
  // Includes the dedicated button-radius token that keeps button geometry independent from other controls.
  { path: "src/styles/tokens.css", owner: "Quiet Pro design tokens", maxLines: 1473 },
  { path: "src-tauri/src/data/sqlite_pool.rs", owner: "Rust data/sqlite pool production", maxLines: 850 },
  { path: "src-tauri/src/data/storage_migration.rs", owner: "Rust data/storage migration production", maxLines: 990 },
  { path: "src/features/history/components/History.tsx", owner: "history feature UI", maxLines: 1244 },
  { path: "src-tauri/src/engine/tracking/runtime.rs", owner: "Rust tracking engine production", maxLines: 350 },
  { path: "src-tauri/src/data/backup.rs", owner: "Rust data/backup production", maxLines: 160 },
  { path: "src-tauri/src/engine/tools/mod.rs", owner: "Rust tools engine production", maxLines: 730 },
  { path: "src-tauri/src/data/repositories/tools.rs", owner: "Rust tools repository production", maxLines: 730 },
  { path: "src/features/data/services/dataReadModel.ts", owner: "data feature read model", maxLines: 903 },
  { path: "src/app/AppShell.tsx", owner: "frontend app shell", maxLines: 613 },
];

function countLines(path: string): number {
  const content = readFileSync(path, "utf8");
  if (!path.endsWith(".rs")) return content.split(/\r?\n/).length;

  const lines = content.split(/\r?\n/);
  const production = [...lines];
  let pendingTestAttribute = false;
  let testDepth: number | null = null;
  let itemStarted = false;
  const braceDelta = (line: string) => (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (testDepth !== null) {
      production[index] = "";
      testDepth += braceDelta(line);
      if (testDepth <= 0) testDepth = null;
      return;
    }
    if (/^#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\]/.test(trimmed)) {
      pendingTestAttribute = true;
      production[index] = "";
      return;
    }
    if (pendingTestAttribute) {
      production[index] = "";
      if (!trimmed || (!itemStarted && trimmed.startsWith("#"))) return;
      itemStarted = true;
      const delta = braceDelta(line);
      if (delta > 0) {
        testDepth = delta;
        pendingTestAttribute = false;
        itemStarted = false;
      } else if (trimmed.endsWith(";") || (trimmed.includes("{") && delta === 0)) {
        pendingTestAttribute = false;
        itemStarted = false;
      }
    }
  });

  return production.filter((line) => line.trim().length > 0).length;
}

const failures: string[] = [];

for (const budget of HOTSPOT_BUDGETS) {
  const actualLines = countLines(budget.path);
  if (actualLines > budget.maxLines) {
    failures.push(
      `${budget.path}: ${actualLines} lines exceeds ${budget.maxLines} (${budget.owner})`,
    );
  }
}

if (failures.length > 0) {
  console.error("Quality hotspot growth guard failed.");
  for (const failure of failures) {
    console.error(failure);
  }
  console.error("Split by owner or deliberately update the hotspot budget with justification.");
  process.exitCode = 1;
} else {
  console.log("Quality hotspot growth guard passed");
}
