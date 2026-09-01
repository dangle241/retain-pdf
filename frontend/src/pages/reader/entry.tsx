// reader 页 React 入口。默认 react-pdf 引擎（ReaderAppReactPdf）；
// ?engine=legacy 回退命令式 js/reader 挂载（use-reader-boot）。
// 打包产物 dist/reader.bundle.js（scripts/build-js-bundle.mjs）。

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { ReaderApp } from "./ReaderApp.jsx";

bootTheme();
// 仅 AI 会话切换锁定期拦截误触；并清掉可能残留的全屏指针遮罩
clearReaderAiNavigationLock();
installReaderWindowOpenGuard();

// 渲染前同步 body class:CSS 的 :has()/body-class 驱动规则(reader-page.css)依赖它们。
// 主页已改为跳转独立 reader.html，不再用 iframe 嵌入。
// 若仍有旧书签/测试以 iframe 打开，保留 embedded class 兼容。
function syncReaderBodyClasses(body = document.body) {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

// 过渡期兜底:探针验证时 reader.html 只换 <script> 入口,旧静态骨架仍在 body 里,
// 先清掉再挂 React 树,避免两套 DOM(重复 id/固定层)叠加。
// cutover(2b)后 body 只剩脚本与 #reader-root,此步退化为空操作。
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
 * Legacy 抽屉/选区/AI 样式已拆到 dist/css/reader-legacy.css。
 * 默认 react-pdf 不加载；仅 ?engine=legacy 时注入。
 * 相对路径对齐 reader.html 里已有的 reader.css link（保留同目录）。
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
    // ./dist/css/reader.css?v=abc → ./dist/css/reader-legacy.css（去掉主包 hash，避免错绑）
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
