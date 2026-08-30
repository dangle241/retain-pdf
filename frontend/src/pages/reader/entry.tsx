// Điểm vào React của trang reader. Mặc định dùng engine react-pdf (ReaderAppReactPdf);
// ?engine=legacy fallback sang việc mount js/reader theo kiểu mệnh lệnh (use-reader-boot).
// Sản phẩm bundle dist/reader.bundle.js (scripts/build-js-bundle.mjs).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { ReaderApp } from "./ReaderApp.jsx";

bootTheme();
// Chỉ chặn bấm nhầm trong thời gian khóa đổi hội thoại AI; đồng thời xóa lớp che con trỏ toàn màn hình có thể còn sót.
clearReaderAiNavigationLock();
installReaderWindowOpenGuard();

// Đồng bộ lớp body trước khi render: quy tắc do :has()/body-class điều khiển trong CSS (reader-page.css) phụ thuộc chúng.
// Trang chủ đã chuyển sang điều hướng tới reader.html độc lập, không còn nhúng bằng iframe.
// Nếu bookmark/kiểm thử cũ vẫn mở bằng iframe, giữ lớp embedded để tương thích.
function syncReaderBodyClasses(body = document.body) {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

// Dự phòng giai đoạn chuyển tiếp: khi xác minh bằng probe, reader.html chỉ đổi điểm vào <script>, khung tĩnh cũ vẫn ở trong body,
// xóa trước rồi mới mount cây React để tránh hai bộ DOM (ID trùng/lớp cố định) chồng nhau.
// Sau cutover (2b), body chỉ còn script và #reader-root; bước này trở thành no-op.
function purgeLegacyMarkup(body = document.body) {
  Array.from(body.children).forEach((element) => {
    if (element.tagName !== "SCRIPT" && element.id !== "reader-root") {
      element.remove();
    }
  });
}

function resolveReaderRoot(body = document.body) {
  let host = document.getElementById("reader-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "reader-root";
    body.appendChild(host);
  }
  return host;
}

function resolveReaderEngine(search = globalThis.location?.search || "") {
  const engine = new URLSearchParams(search).get("engine")?.trim().toLowerCase() || "";
  if (engine === "legacy" || engine === "classic") {
    return "legacy";
  }
  return "react-pdf";
}

/**
 * Kiểu drawer/vùng chọn/AI legacy đã tách sang dist/css/reader-legacy.css.
 * react-pdf mặc định không tải; chỉ inject khi ?engine=legacy.
 * Đường dẫn tương đối căn với liên kết reader.css hiện có trong reader.html (giữ cùng thư mục).
 */
function ensureLegacyReaderCss() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.querySelector('link[data-reader-legacy-css]')) {
    return;
  }
  const main = document.querySelector(
    'link[rel="stylesheet"][href*="reader.css"]',
  ) as HTMLLinkElement | null;
  let href = "./dist/css/reader-legacy.css";
  if (main?.getAttribute("href")) {
    // ./dist/css/reader.css?v=abc → ./dist/css/reader-legacy.css (bỏ hash bundle chính để tránh liên kết sai).
    href = main
      .getAttribute("href")!
      .replace(/reader\.css(\?v=[^"']*)?$/i, "reader-legacy.css");
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.readerLegacyCss = "1";
  document.head.appendChild(link);
}

syncReaderBodyClasses();
purgeLegacyMarkup();
if (resolveReaderEngine() === "legacy") {
  ensureLegacyReaderCss();
}
createRoot(resolveReaderRoot()).render(<ReaderApp />);
