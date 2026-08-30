// Gắn chuỗi cache ?v= theo hash nội dung cho CSS / *.bundle.js được tham chiếu trong ba trang HTML.
//
// CSS đã được tách theo trang:
//   index  → dist/css/home.css
//   detail → dist/css/detail.css
//   reader → dist/css/reader.css
// (styles.css chỉ là bản sao tương thích của home và thường không còn được HTML tham chiếu.)
//
// Cách đúng: sau khi build, ghi ?v=<hash> theo hash nội dung của từng tài nguyên; nội dung không đổi → URL không đổi
// (cache được dùng bình thường); nội dung đổi → URL đổi (buộc tải lại từ nguồn).

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Với tài nguyên được mỗi trang HTML tham chiếu (tương đối từ gốc frontend), stamp sẽ thay ?v= trên các href/src này
// bằng hash nội dung của tệp tương ứng.
const PAGES = [
  { html: "index.html", assets: ["dist/css/home.css", "dist/app.bundle.js"] },
  { html: "detail.html", assets: ["dist/css/detail.css", "dist/detail.bundle.js"] },
  { html: "reader.html", assets: ["dist/css/reader.css", "dist/reader.bundle.js"] },
];

function contentHash(absPath) {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

// Chuẩn hóa tham chiếu tới một asset trong HTML (href/src="./asset" hoặc "./asset?v=giá-trị-cũ")
// thành "./asset?v=<hash>". Dấu . và / trong asset phải được escape trong biểu thức chính quy.
function stampAssetRef(htmlText, asset, hash) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["']\\.\\/${escaped})(\\?v=[^"']*)?(["'])`, "g");
  return htmlText.replace(pattern, `$1?v=${hash}$3`);
}

let changed = 0;
for (const page of PAGES) {
  const htmlPath = join(FRONTEND_ROOT, page.html);
  if (!existsSync(htmlPath)) {
    continue;
  }
  let htmlText = readFileSync(htmlPath, "utf8");
  const before = htmlText;
  for (const asset of page.assets) {
    const assetPath = join(FRONTEND_ROOT, asset);
    if (!existsSync(assetPath)) {
      continue;
    }
    htmlText = stampAssetRef(htmlText, asset, contentHash(assetPath));
  }
  if (htmlText !== before) {
    writeFileSync(htmlPath, htmlText);
    changed += 1;
  }
}

console.log(`[stamp-cache-version] Đã cập nhật chuỗi bộ nhớ đệm tài nguyên của ${changed} tệp HTML`);
