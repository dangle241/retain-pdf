import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// detail.html / reader.html hiện được gắn cây React bởi dist/{detail,reader}.bundle.js do esbuild đóng gói
// (Phase 1 / 2b cutover), nhưng logic thuần còn giữ lại dưới src/js/job-detail, src/js/reader vẫn dùng
// string literal để tham chiếu DOM id/class, esbuild không thực hiện loại kiểm tra này: đổi tên id, typo, xóa class CSS đều chỉ
// âm thầm失效 lúc runtime (guard của dom/query.js sẽ nuốt null). Kiểm thử này cross-validate: mỗi string literal "detail-*" / "reader-*" xuất hiện trong JS dưới thư mục job-detail / reader
// phải tìm thấy归属 trong id/class của HTML trang tương ứng, định nghĩa class trong src/styles, JSX của src/pages/{detail,reader} (id=.../className=...),
// hoặc phần tử tự xây dựng trong JS (id="...").
//
// Trang home (index.html / src/pages/home) không được đưa vào file này: home không có quy ước tiền tố id đơn lẻ (các miền feature
// tự đặt tên), dùng tests/home-app-component.test.mjs (render HomeApp để assert contract id) + các *-component.test.mjs của từng miền
// (như recent-jobs-library-component / status-card-component v.v., render cây React thực tế để assert DOM contract) để bao phủ, là kiểm tra mạnh hơn so với quét string literal ở đây — trực tiếp render
// component để assert DOM thật, thay vì quét string trong mã nguồn để đoán归属. Phase 4 rà soát xác nhận判断 này vẫn đúng,
// không cần bổ sung home vào file này.

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");

// Tham chiếu遗留 đã xác nhận (phần tử/class thực sự không tồn tại lúc runtime). Trước khi thêm mục mới phải xác nhận thủ công,
// và ghi rõ lý do; một khi tham chiếu khôi phục归属,用例 hygiene bên dưới sẽ bắt buộc loại bỏ khỏi đây.
const KNOWN_ORPHANS = {
  "src/js/job-detail": Object.freeze([
    // Class do template生成, không có quy tắc tương ứng trong src/styles (div không có style)
    "detail-artifact-meta",
  ]),
  "src/js/reader": Object.freeze([]),
};

const PAGES = [
  {
    jsDir: "src/js/job-detail",
    prefix: "detail",
    htmlFile: "detail.html",
    // Sau Phase 1 cutover, detail.html chỉ còn điểm gắn #detail-root, khung trang
    // (id/class) do cây React render: kiểm tra归属 cần quét JSX của thế giới mới
    // id="..." và className="..." (logic thuần cũ còn giữ lại vẫn viết các node này theo id).
    jsxDir: "src/pages/detail",
  },
  {
    jsDir: "src/js/reader",
    prefix: "reader",
    htmlFile: "reader.html",
    // Sau Phase 2b cutover, reader.html chỉ còn điểm gắn #reader-root, khung trang
    // (id/class) do cây React render (theo tiền lệ detail, quét JSX thế giới mới).
    jsxDir: "src/pages/reader",
  },
];

function walkFiles(dir, extension) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkFiles(fullPath, extension));
    } else if (entry.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectLiterals(jsFiles, prefix) {
  const pattern = new RegExp(`["'](${prefix}-[a-z0-9-]+)["']`, "g");
  const literals = new Map();
  for (const file of jsFiles) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(pattern)) {
      const literal = match[1];
      if (!literals.has(literal)) {
        literals.set(literal, relative(PROJECT_ROOT, file));
      }
    }
  }
  return literals;
}

function collectOwnership(htmlText, jsTexts, cssText, jsxTexts = []) {
  const ids = new Set(
    [...htmlText.matchAll(/id="([a-z0-9-]+)"/g)].map((m) => m[1]),
  );
  for (const text of [...jsTexts, ...jsxTexts]) {
    for (const match of text.matchAll(/\bid\s*=\s*"([a-z0-9-]+)"/g)) {
      ids.add(match[1]);
    }
  }
  const classes = new Set();
  for (const match of htmlText.matchAll(/class="([^"]+)"/g)) {
    for (const name of match[1].split(/\s+/)) {
      classes.add(name);
    }
  }
  // Khung trang React: className của JSX tương đương với归属 class của HTML cũ
  for (const text of jsxTexts) {
    for (const match of text.matchAll(/className="([^"]+)"/g)) {
      for (const name of match[1].split(/\s+/)) {
        classes.add(name);
      }
    }
  }
  for (const match of cssText.matchAll(/\.([a-z0-9][a-z0-9-]*)/g)) {
    classes.add(match[1]);
  }
  return { ids, classes };
}

function isOwned(literal, ownership) {
  if (ownership.ids.has(literal) || ownership.classes.has(literal)) {
    return true;
  }
  // Chế độ id phức hợp, ví dụ showReaderPaneEmpty dùng "reader-pdf" để ghép thành "reader-pdf-wrap"
  const family = `${literal}-`;
  for (const id of ownership.ids) {
    if (id.startsWith(family)) {
      return true;
    }
  }
  return false;
}

function analyzePage({ jsDir, prefix, htmlFile, jsxDir = "" }) {
  // Sau migration TS, file nguồn là .ts/.tsx; vẫn tương thích với .js/.jsx còn sót lại
  const jsFiles = [
    ...walkFiles(join(PROJECT_ROOT, jsDir), ".ts"),
    ...walkFiles(join(PROJECT_ROOT, jsDir), ".js"),
  ];
  const jsTexts = jsFiles.map((file) => readFileSync(file, "utf8"));
  const jsxTexts = jsxDir
    ? [
      ...walkFiles(join(PROJECT_ROOT, jsxDir), ".tsx"),
      ...walkFiles(join(PROJECT_ROOT, jsxDir), ".jsx"),
      ...walkFiles(join(PROJECT_ROOT, jsxDir), ".ts"),
      ...walkFiles(join(PROJECT_ROOT, jsxDir), ".js"),
    ].map((file) => readFileSync(file, "utf8"))
    : [];
  const htmlText = readFileSync(join(PROJECT_ROOT, htmlFile), "utf8");
  const cssText = walkFiles(STYLES_ROOT, ".css")
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const literals = collectLiterals(jsFiles, prefix);
  const ownership = collectOwnership(htmlText, jsTexts, cssText, jsxTexts);
  return { literals, ownership };
}

for (const page of PAGES) {
  const allowlist = new Set(KNOWN_ORPHANS[page.jsDir]);

  test(`Tham chiếu ${page.prefix}-* của ${page.jsDir} có归属 trong ${page.htmlFile}/style/template`, () => {
    const { literals, ownership } = analyzePage(page);
    assert.ok(literals.size > 0, `Không tìm thấy bất kỳ literal ${page.prefix}-* nào trong ${page.jsDir}, kiểm tra logic quét`);
    const orphans = [];
    for (const [literal, file] of literals) {
      if (!isOwned(literal, ownership) && !allowlist.has(literal)) {
        orphans.push(`${literal} (首见于 ${file})`);
      }
    }
    assert.deepEqual(
      orphans,
      [],
      `Các tham chiếu sau không tồn tại trong id/class của ${page.htmlFile}, định nghĩa class của src/styles, hoặc phần tử tự xây dựng trong JS,` +
        `sẽ âm thầm失效 lúc runtime:\n  ${orphans.join("\n  ")}`,
    );
  });

  test(`Danh sách KNOWN_ORPHANS của ${page.jsDir} không có mục hết hạn`, () => {
    const { literals, ownership } = analyzePage(page);
    const stale = [];
    for (const literal of allowlist) {
      if (!literals.has(literal) || isOwned(literal, ownership)) {
        stale.push(literal);
      }
    }
    assert.deepEqual(
      stale,
      [],
      `Các mục KNOWN_ORPHANS sau không còn là orphan (tham chiếu đã bị xóa hoặc đã khôi phục归属), vui lòng loại bỏ khỏi danh sách: ${stale.join(", ")}`,
    );
  });
}
