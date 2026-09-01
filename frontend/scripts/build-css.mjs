// 按页编译 CSS：home / detail / reader 独立产物，切断「一份 styles.css 打天下」。
//
//   src/styles/entries/home.css          → dist/css/home.css
//   src/styles/entries/detail.css        → dist/css/detail.css
//   src/styles/entries/reader.css        → dist/css/reader.css      (默认 react-pdf)
//   src/styles/entries/reader-legacy.css → dist/css/reader-legacy.css (?engine=legacy 附加)
//
// 兼容：仍写一份 styles.css = home 的副本，避免外部脚本/文档旧路径立刻挂掉。

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRIES = [
  { in: "src/styles/entries/home.css", out: "dist/css/home.css" },
  { in: "src/styles/entries/detail.css", out: "dist/css/detail.css" },
  { in: "src/styles/entries/reader.css", out: "dist/css/reader.css" },
  { in: "src/styles/entries/reader-legacy.css", out: "dist/css/reader-legacy.css" },
];

mkdirSync(join(ROOT, "dist/css"), { recursive: true });

const minify = !process.argv.includes("--no-minify");
const watch = process.argv.includes("--watch");

function runOne(entry, { watchMode = false } = {}) {
  const args = [
    "tailwindcss",
    "-i",
    join(ROOT, entry.in),
    "-o",
    join(ROOT, entry.out),
  ];
  if (minify && !watchMode) args.push("--minify");
  if (watchMode) args.push("--watch");
  console.log(`[build-css] ${entry.in} → ${entry.out}`);
  const r = spawnSync("npx", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

if (watch) {
  // 并行 watch 三个入口
  const kids = ENTRIES.map((entry) => {
    const args = [
      "tailwindcss",
      "-i",
      join(ROOT, entry.in),
      "-o",
      join(ROOT, entry.out),
      "--watch",
    ];
    console.log(`[build-css:watch] ${entry.in} → ${entry.out}`);
    return spawnSync("npx", args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  });
  process.exit(kids.some((k) => k.status !== 0) ? 1 : 0);
}

for (const entry of ENTRIES) {
  runOne(entry);
}

// 兼容旧路径 styles.css（= 主页包）
const homeOut = join(ROOT, "dist/css/home.css");
const legacyOut = join(ROOT, "styles.css");
if (existsSync(homeOut)) {
  copyFileSync(homeOut, legacyOut);
  console.log("[build-css] styles.css ← dist/css/home.css (compat)");
}

console.log("[build-css] done");
