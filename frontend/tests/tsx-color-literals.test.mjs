import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// TSX/JSX theme-blind color ratchet gateâsister piece to css-color-literals, filling its blind spots:
// Tailwind utility classes like bg-white/text-black in className, arbitrary values [rgba(...)],
// inline style literal colors; CSS ratchet (scanning only src/styles) misses these under night/decorative themes
// These colors do not follow theme changes (accumulated 30+ instances during library redesign).
//
// Same rule: hits per file must be â¤ baseline, new files must be 0;
// After convergence, tighten with UPDATE_TSX_COLOR_BASELINE=1 npm test.
// Semantic alternatives: bg-paper/bg-ink/bg-scrim etc.(@theme mapping in core/tailwind-theme.css).

const PROJECT_ROOT = process.cwd();
const SCAN_ROOTS = ["src/pages", "src/components", "src/shared", "src/lib"]
  .map((p) => join(PROJECT_ROOT, p));
// Location of skin truth values (preview color block data), exempt
const EXEMPT = [join(PROJECT_ROOT, "src/shared/theme")];
const BASELINE_PATH = join(PROJECT_ROOT, "tests/helpers/tsx-color-literals-baseline.json");

// 1) Theme-blind utility classes: white/black series (including /alpha variants and forms after hover: prefixes)
const UTILITY_RE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|caret|accent)-(?:white|black)(?:\/\d+)?\b/g;
// 2) Literal colors: rgba()/rgb()/hsl()/6+ digit hex (includes arbitrary value classes, inline styles, constants)
const LITERAL_RE = /\brgba?\(|\bhsla?\(|#[0-9a-fA-F]{6}\b/g;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (EXEMPT.some((e) => full === e || full.startsWith(`${e}/`))) continue;
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(?:tsx|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source) {
// Conservative stripping: block comments + full-line // comments (leave trailing // to avoid breaking URLs)
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function countFile(file) {
  const source = stripComments(readFileSync(file, "utf8"));
  const utilities = (source.match(UTILITY_RE) || []).length;
  const literals = (source.match(LITERAL_RE) || []).length;
  return utilities + literals;
}

function currentCounts() {
  const counts = {};
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root).sort()) {
      const n = countFile(file);
      if (n > 0) counts[relative(PROJECT_ROOT, file)] = n;
    }
  }
  return counts;
}

test("TSX theme-blind colors only decrease (ratchet)", () => {
  const counts = currentCounts();

  if (process.env.UPDATE_TSX_COLOR_BASELINE === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
if (n > allowed) regressions.push(`${file}: ${n} instances (ratchet limit ${allowed})`);
  }
  assert.deepEqual(
    regressions,
    [],
`The following files added theme-blind colors (bg-white/rgba(...) etc.), please use semantic classes bg-paper/bg-ink/bg-scrim or var(--...):\n  ${regressions.join("\n  ")}\nAfter convergence, tighten ratchet with UPDATE_TSX_COLOR_BASELINE=1 npm test.`,
  );
});

test("TSX ratchet baseline is not inflated", () => {
  if (process.env.UPDATE_TSX_COLOR_BASELINE === "1") return;
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
`Convergence results not solidified, run UPDATE_TSX_COLOR_BASELINE=1 npm test:\n  ${stale.join("\n  ")}`,
  );
});
