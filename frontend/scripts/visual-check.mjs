#!/usr/bin/env node
// Visual regression baseline: screenshot key states for three pages, compare with tests/visual/baseline.
//   node scripts/visual-check.mjs           # compare, exit code 1 if diff exceeds threshold, diff graph written to tests/visual/output
//   node scripts/visual-check.mjs --update  # Rebuild baseline.(Run after confirming visual changes match expectations.)
// Full mock Mode, freeze clock,Backend-independent. Baseline generated locally.,Local comparison only.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE_DIR = join(FRONTEND_ROOT, "tests/visual/baseline");
const OUTPUT_DIR = join(FRONTEND_ROOT, "tests/visual/output");
const PORT = 40151;
const FIXED_TIME = new Date("2026-06-01T10:00:00+08:00");
const MOCK_JOB_ID = "mock-job-20260415";
// Allowed pixel difference ratio(Anti-aliasing noise)
const DIFF_RATIO_THRESHOLD = 0.001;

const STATES = [
  {
    name: "home",
    url: `/index.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "detail",
    url: `/detail.html?mock=succeeded&job_id=${MOCK_JOB_ID}`,
    prepare: async (page) => {
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "reader-compare",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Right column default expansion triggers PDF Resize/reorder,Wait for zoom settle before screenshot.(otherwise PDF Text subpixel jitter)
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "reader-ai-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
// Three-column skeleton: right column (AI Q&A) default expanded, no need to open again.
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
      // Triggered by right column expansion. PDF Resize settle.,Avoid sub-pixel jitter
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "status-dialog-failed",
    url: `/index.html?mock=failed`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#status-detail-btn");
      await page.waitForTimeout(800);
    },
  },
  {
    name: "detail-page-failed",
    url: `/detail.html?mock=failed&job_id=${MOCK_JOB_ID}`,
    prepare: async (page) => {
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "reader-markdown-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.click("#reader-markdown-toggle-btn");
      await page.waitForSelector("#reader-markdown-content:not(.hidden)", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "reader-dialog-embedded",
    diffThreshold: 0.008,
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#reader-btn");
      const frameElement = await page.waitForSelector("iframe[src*='reader.html']", { timeout: 10000 });
      const frame = await frameElement.contentFrame();
      await frame.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "reader-ai-answer",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Right column expanded by default,Ask directly.(Stop clicking toggle button)
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
await page.fill("#reader-ai-input", "How does conjugation affect selectivity?");
      await page.click("#reader-ai-submit-btn");
      await page.waitForSelector(".reader-ai-citation-item", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "reader-annotations-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.click("#reader-annotations-toggle-btn");
      await page.waitForSelector(".reader-annotations-item", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "library-search-island",
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
await page.fill("#library-search-input", "Chemistry");
      await page.waitForSelector(".lib-search-panel", { timeout: 8000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "status-dialog-translation",
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#status-detail-btn");
      await page.waitForTimeout(600);
      await page.click("#detail-tab-translation");
      await page.waitForTimeout(900);
    },
  },
];

const update = process.argv.includes("--update");
mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const server = spawn(
  "python3",
  ["scripts/serve_static.py", "--host", "127.0.0.1", "--port", String(PORT), "--root", "."],
  { cwd: FRONTEND_ROOT, stdio: "ignore" },
);
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch();
let failures = 0;
try {
  for (const state of STATES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.clock.install({ time: FIXED_TIME });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${PORT}${state.url}`, { waitUntil: "networkidle" });
    await state.prepare(page);
    const shot = await page.screenshot();
    await page.close();

    if (consoleErrors.length) {
console.error(✖ ${state.name}: page error ${consoleErrors[0]});
      failures += 1;
      continue;
    }

    const baselinePath = join(BASELINE_DIR, `${state.name}.png`);
    if (update || !existsSync(baselinePath)) {
      writeFileSync(baselinePath, shot);
      console.log(`● ${state.name}: 基线已${update ? "更新" : "创建"}`);
      continue;
    }

    const baseline = PNG.sync.read(readFileSync(baselinePath));
    const current = PNG.sync.read(shot);
    if (baseline.width !== current.width || baseline.height !== current.height) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
console.error(✖ ${state.name}: size changed ${baseline.width}x${baseline.height} -> ${current.width}x${current.height});
      failures += 1;
      continue;
    }
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const diffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
      threshold: 0.15,
    });
    const ratio = diffPixels / (baseline.width * baseline.height);
    // Minority by PDF Canvas-centric state,pdf.js Text rendering has run-to-run Subpixel antialiasing dither
// (Layout pixel-perfect, see diff), relax threshold to absorb noise; keep other states strict at 0.1%.
    const stateThreshold = state.diffThreshold ?? DIFF_RATIO_THRESHOLD;
    if (ratio > stateThreshold) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
      writeFileSync(join(OUTPUT_DIR, `${state.name}.diff.png`), PNG.sync.write(diff));
console.error(✖ ${state.name}: diff ${(ratio * 100).toFixed(2)}% (${diffPixels}px), diff see tests/visual/output/);
      failures += 1;
    } else {
console.log(✔ ${state.name}: consistent (diff ${(ratio * 100).toFixed(3)}%));
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) {
console.error(\\n${failures} states differ from baseline. After confirming changes are as expected, run: npm run visual:update);
  process.exit(1);
}
