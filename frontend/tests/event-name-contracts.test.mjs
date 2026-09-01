import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Event name/Command name is string contract.,typo Silent failure at runtime only.
// Current status: retainpdf:* Events fully converged in contracts/app-contract.js's APP_EVENTS,
// Command bus both ends. RECENT_JOBS_COMMANDS Constant. This test locks this state,
// Ban bare literals bypassing contract.
// Scan coverage for .js and .jsx (Include src/pages and src/shared together for React migration).

const PROJECT_ROOT = process.cwd();
const JS_ROOT = join(PROJECT_ROOT, "src/js");
const SCAN_ROOTS = [JS_ROOT, join(PROJECT_ROOT, "src/pages"), join(PROJECT_ROOT, "src/shared")];
const EVENT_CONTRACT_FILE = join(JS_ROOT, "contracts/app-contract.js");
// generated/ for build artifacts(Bundled inline event name literals originate from source code.,Guarded by source code scanning)
const GENERATED_ROOT = join(JS_ROOT, "generated");

// Non-event use. retainpdf: Prefix string (e.g., localStorage key), Register item by item
const ALLOWED_LITERALS = [
  { file: join(JS_ROOT, "features/app-update/state.js"), literal: "retainpdf:update-check:v1" },
];

function walkJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (fullPath === GENERATED_ROOT) {
      continue;
    }
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkJsFiles(fullPath));
    } else if (entry.endsWith(".js") || entry.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = SCAN_ROOTS.filter((root) => existsSync(root)).flatMap(walkJsFiles);

test("retainpdf:* event names must only be defined in contracts/app-contract.js", () => {
  const violations = [];
  for (const file of jsFiles) {
    if (file === EVENT_CONTRACT_FILE) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'](retainpdf:[^"']+)["']/g)) {
      const allowed = ALLOWED_LITERALS.some(
        (entry) => entry.file === file && entry.literal === match[1],
      );
      if (!allowed) {
        violations.push(`${relative(PROJECT_ROOT, file)}: "${match[1]}"`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
`Found retainpdf:* literal outside of contract, please use APP_EVENTS constant:\n  ${violations.join("\n  ")}`,
  );
});

test("Command bus and CustomEvent do not allow bare string event names", () => {
  const patterns = [
    [/\.dispatch\(\s*["']/, ".dispatch(\"...\")"],
    [/\.on\(\s*["']/, ".on(\"...\")"],
    [/dispatchEvent\(\s*new\s+CustomEvent\(\s*["']/, "dispatchEvent(new CustomEvent(\"...\"))"],
    [/addEventListener\(\s*["']retainpdf/, "addEventListener(\"retainpdf...\")"],
  ];
  const violations = [];
  for (const file of jsFiles) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) {
        violations.push(`${relative(PROJECT_ROOT, file)}: ${label}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
`Found bare string event/command name, please reference contract constant:\n  ${violations.join("\n  ")}`,
  );
});
