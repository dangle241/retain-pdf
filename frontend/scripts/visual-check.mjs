#!/usr/bin/env node
// Đường cơ sở hồi quy hình ảnh: chụp các trạng thái chính của ba trang và so sánh với tests/visual/baseline.
//   node scripts/visual-check.mjs           # So sánh; nếu khác biệt vượt ngưỡng thì thoát mã 1 và ghi ảnh diff vào tests/visual/output
//   node scripts/visual-check.mjs --update  # Tạo lại đường cơ sở (chạy sau khi xác nhận thay đổi hình ảnh đúng mong đợi)
// Toàn bộ chạy ở chế độ mô phỏng với đồng hồ cố định, không phụ thuộc backend. Đường cơ sở được tạo cục bộ và chỉ dùng để so sánh trên máy này.

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
// Tỷ lệ pixel khác biệt cho phép (nhiễu khử răng cưa, v.v.)
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
      // Cột phải mở mặc định sẽ làm PDF bố trí và thu phóng lại; chờ đủ lâu để ổn định trước khi chụp (nếu không, chữ PDF sẽ rung ở mức pixel phụ).
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "reader-ai-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Bố cục ba cột: cột phải (hỏi đáp AI) mở mặc định, không cần bấm mở.
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
      // Chờ PDF bố trí và thu phóng lại sau khi cột phải mở để tránh rung ở mức pixel phụ.
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
      // Cột phải mở mặc định; đặt câu hỏi trực tiếp, không bấm nút đóng/mở nữa.
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
      await page.fill("#reader-ai-input", "Sự liên hợp ảnh hưởng đến tính chọn lọc như thế nào?");
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
      await page.fill("#library-search-input", "Hóa học");
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
      console.error(`✖ ${state.name}: lỗi trang ${consoleErrors[0]}`);
      failures += 1;
      continue;
    }

    const baselinePath = join(BASELINE_DIR, `${state.name}.png`);
    if (update || !existsSync(baselinePath)) {
      writeFileSync(baselinePath, shot);
      console.log(`● ${state.name}: đường cơ sở đã được ${update ? "cập nhật" : "tạo"}`);
      continue;
    }

    const baseline = PNG.sync.read(readFileSync(baselinePath));
    const current = PNG.sync.read(shot);
    if (baseline.width !== current.width || baseline.height !== current.height) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
      console.error(`✖ ${state.name}: kích thước thay đổi ${baseline.width}x${baseline.height} -> ${current.width}x${current.height}`);
      failures += 1;
      continue;
    }
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const diffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
      threshold: 0.15,
    });
    const ratio = diffPixels / (baseline.width * baseline.height);
    // Ở một số trạng thái chủ yếu là canvas PDF, kết xuất chữ của pdf.js có dao động khử răng cưa ở mức pixel phụ giữa các lần chạy.
    // (Bản thân bố cục khớp từng pixel, xem diff); nới ngưỡng để hấp thụ nhiễu này, các trạng thái khác vẫn giữ ngưỡng nghiêm ngặt 0,1%.
    const stateThreshold = state.diffThreshold ?? DIFF_RATIO_THRESHOLD;
    if (ratio > stateThreshold) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
      writeFileSync(join(OUTPUT_DIR, `${state.name}.diff.png`), PNG.sync.write(diff));
      console.error(`✖ ${state.name}: khác biệt ${(ratio * 100).toFixed(2)}% (${diffPixels}px), xem ảnh diff tại tests/visual/output/`);
      failures += 1;
    } else {
      console.log(`✔ ${state.name}: khớp (khác biệt ${(ratio * 100).toFixed(3)}%)`);
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) {
  console.error(`\n${failures} trạng thái không khớp baseline. Sau khi xác nhận thay đổi đúng mong đợi, hãy chạy: npm run visual:update`);
  process.exit(1);
}
