import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";

const SCAN_ROOTS = ["src/app", "src/features", "src/shared", "src/platform"] as const;

interface SourceFile {
  path: string;
  content: string;
}

interface ArchitectureViolation {
  path: string;
  line: number;
  rule: string;
  text: string;
}

function normalizePath(path: string) {
  return path.split(sep).join("/");
}

function normalizeImportPath(fromFile: string, specifier: string) {
  if (specifier.startsWith(".")) {
    return normalizePath(normalize(join(dirname(fromFile), specifier)));
  }

  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }

  return specifier;
}

function extractImportSpecifiers(lineText: string) {
  const specifiers: string[] = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of lineText.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function collectSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(path: string) {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) {
        walk(join(path, entry));
      }
      return;
    }

    if (!/\.(ts|tsx)$/.test(path)) {
      return;
    }

    files.push({
      path: normalizePath(relative(process.cwd(), path)),
      content: readFileSync(path, "utf8"),
    });
  }

  walk(root);
  return files;
}

function isFeatureComponentOrHook(path: string) {
  return /^src\/features\/[^/]+\/(components|hooks)\//.test(path);
}

function isSharedSource(path: string) {
  return /^src\/shared\//.test(path);
}

function isPlatformSource(path: string) {
  return /^src\/platform\//.test(path);
}

function isAppComponentOrHook(path: string) {
  return /^src\/app\/(components|hooks)\//.test(path);
}

function findArchitectureViolations(files: SourceFile[]): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((lineText, index) => {
      const importedPaths = extractImportSpecifiers(lineText).map((specifier) =>
        normalizeImportPath(file.path, specifier),
      );

      for (const importedPath of importedPaths) {
        if (isSharedSource(file.path) && /^src\/app\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "shared-no-app-import",
            text: lineText.trim(),
          });
        }

        if (isSharedSource(file.path) && /^src\/features\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "shared-no-feature-import",
            text: lineText.trim(),
          });
        }

        if (isSharedSource(file.path) && /^src\/platform\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "shared-no-platform-import",
            text: lineText.trim(),
          });
        }

        if (isFeatureComponentOrHook(file.path) && /^src\/platform\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "feature-ui-no-platform-import",
            text: lineText.trim(),
          });
        }

        if (isAppComponentOrHook(file.path) && /^src\/platform\/persistence\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "app-shell-no-direct-persistence-import",
            text: lineText.trim(),
          });
        }

        if (isPlatformSource(file.path) && /^src\/app\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "platform-no-app-import",
            text: lineText.trim(),
          });
        }

        if (isPlatformSource(file.path) && /^src\/features\//.test(importedPath)) {
          violations.push({
            path: file.path,
            line: index + 1,
            rule: "platform-no-feature-import",
            text: lineText.trim(),
          });
        }
      }

      if (isFeatureComponentOrHook(file.path) && lineText.includes("@tauri-apps")) {
        violations.push({
          path: file.path,
          line: index + 1,
          rule: "feature-ui-no-tauri-api",
          text: lineText.trim(),
        });
      }

      if (isFeatureComponentOrHook(file.path) && /\binvoke\s*\(/.test(lineText)) {
        violations.push({
          path: file.path,
          line: index + 1,
          rule: "feature-ui-no-direct-invoke",
          text: lineText.trim(),
        });
      }
    });
  }

  return violations;
}

function runSelfTest() {
  const violations = findArchitectureViolations([
    {
      path: "src/features/data/components/Data.tsx",
      content: "import { getSessionsInRange } from '../../../platform/persistence/sessionReadRepository.ts';",
    },
    {
      path: "src/features/data/services/dataReadModel.ts",
      content: "const repository = await import('../../../platform/persistence/sessionReadRepository.ts');",
    },
    {
      path: "src/shared/lib/sessionReadRepository.ts",
      content: [
        "export type { HistorySession } from '../../platform/persistence/sessionReadRepository.ts';",
        "import type { View } from '../../app/types/view.ts';",
        "import Dashboard from '../../features/dashboard/components/Dashboard.tsx';",
      ].join("\n"),
    },
    {
      path: "src/features/settings/hooks/useSettings.ts",
      content: "await invoke('cmd_save_settings');",
    },
    {
      path: "src/features/settings/services/settingsRuntimeAdapterService.ts",
      content: "import { setAfkThreshold } from '../../../platform/runtime/trackingRuntimeGateway.ts';",
    },
    {
      path: "src/app/components/AppTitleBar.tsx",
      content: "import { getSessionsInRange } from '../../platform/persistence/sessionReadRepository.ts';",
    },
    {
      path: "src/platform/persistence/sessionReadRepository.ts",
      content: "import { loadDashboardSnapshot } from '../../features/dashboard/services/dashboardReadModel.ts';",
    },
    {
      path: "src/platform/runtime/trackingRuntimeGateway.ts",
      content: "import { invoke } from '@tauri-apps/api/core';",
    },
  ]);

  const rules = violations.map((violation) => violation.rule).sort();
  const expectedRules = [
    "app-shell-no-direct-persistence-import",
    "feature-ui-no-direct-invoke",
    "feature-ui-no-platform-import",
    "platform-no-feature-import",
    "shared-no-app-import",
    "shared-no-feature-import",
    "shared-no-platform-import",
  ].sort();

  if (JSON.stringify(rules) !== JSON.stringify(expectedRules)) {
    throw new Error("Architecture boundary self-test failed");
  }
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    console.log("Architecture boundary self-test passed");
    return;
  }

  const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(root));
  const violations = findArchitectureViolations(files);

  if (violations.length === 0) {
    console.log("Architecture boundary check passed");
    return;
  }

  console.error("Architecture boundary check failed. Feature UI and hooks must not bypass owned services.");
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line} ${violation.rule} -> ${violation.text}`);
  }
  process.exitCode = 1;
}

main();
