import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// CSS Literal color value ratchet access control.
//
// Target state:src/styles except for themes/(skin truth)outside,No literal color values appear.
// (hex / rgb / rgba / hsl),Use semantic variables exclusively. var(--ink|--paper|--surface|
// --shadow-color|â¦) or color-mix Derived â Otherwise decorate theme/These under dark skin
// Color not following skin change.(night Theme partially broken by this.)。
//
// Hundreds of discrepancies remain between current state and target.,Clearing all at once is unrealistic. This test does "ratchet":
// - Limit literal string count per file. ≤ baseline,Add fails immediately.;
// - Run after convergence. UPDATE_CSS_COLOR_BASELINE=1 npm test Tighten ratchet
//   (baseline Decrease only,Reduced portion is frozen.)。
// baseline: tests/helpers/css-color-literals-baseline.json

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");
const THEMES_ROOT = join(PROJECT_ROOT, "src/styles/themes");
const BASELINE_PATH = join(PROJECT_ROOT, "tests/helpers/css-color-literals-baseline.json");

// hex color / rgb(a) / hsl(a) Function.CSS Variable names exclude digits #,No false positives.
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
if (full === THEMES_ROOT) continue; // Skin truth, only place literal colors allowed.
      walkCss(full, out);
    } else if (name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function countLiterals(file) {
  const css = stripComments(readFileSync(file, "utf8"));
  return (css.match(COLOR_LITERAL_RE) || []).length;
}

function currentCounts() {
  const counts = {};
  for (const file of walkCss(STYLES_ROOT).sort()) {
    const n = countLiterals(file);
    if (n > 0) counts[relative(PROJECT_ROOT, file)] = n;
  }
  return counts;
}

test("CSS Text color value only decreases.(Ratchet, Skin files excluded.)", () => {
  const counts = currentCounts();

  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    return; // Tighten ratchet, pass round directly.
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0; // New file must contain zero string literals.
    if (n > allowed) {
regressions.push(`${file}: ${n} occurrences (ratchet limit ${allowed})`);
    }
  }

  assert.deepEqual(
    regressions,
    [],
`Added literal color values.,Use semantic variables instead(var(--ink|--paper|--surface|--shadow-color|â¦) or color-mix):\n  ${regressions.join("\n  ")}\nUse after convergence. UPDATE_CSS_COLOR_BASELINE=1 npm test tighten ratchet.`,
  );
});

test("Ratchet baseline is not inflated (Tighten converged files.)", () => {
  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") return;
  const counts = currentCounts();
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const stale = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    const n = counts[file] ?? 0;
if (n < allowed) stale.push(`${file}: actual ${n} < baseline ${allowed}`);
  }
  assert.deepEqual(
    stale,
    [],
`Convergence results not solidified, run UPDATE_CSS_COLOR_BASELINE=1 npm test Tighten ratchet.:\n  ${stale.join("\n  ")}`,
  );
});
