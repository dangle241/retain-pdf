// Reader page React entry. Default react-pdf engine (ReaderAppReactPdf);
// ?engine=legacy falls back to imperative js/reader mount (use-reader-boot).
// Bundle output dist/reader.bundle.js (scripts/build-js-bundle.mjs).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { ReaderApp } from "./ReaderApp.jsx";

bootTheme();
// Only intercept accidental clicks during the AI session-switch lock; also clear any leftover fullscreen pointer overlay
clearReaderAiNavigationLock();
installReaderWindowOpenGuard();

// Sync body class before render: CSS :has()/body-class-driven rules (reader-page.css) depend on them.
// Home page now navigates to a standalone reader.html; no longer embeds via iframe.
// If old bookmarks/tests still open it in an iframe, keep the embedded class for compatibility.
function syncReaderBodyClasses(body = document.body) {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

// Transition fallback: during probe verification reader.html only swaps the <script> entry, old static skeleton is still in body;
// clear it before mounting the React tree so two DOMs (duplicate ids / fixed layers) do not stack.
// After cutover (2b) body only has scripts and #reader-root; this step degrades to a no-op.
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
 * Legacy drawer/selection/AI styles were split into dist/css/reader-legacy.css.
 * Default react-pdf does not load them; inject only for ?engine=legacy.
 * Relative path matches the existing reader.css link in reader.html (keep same directory).
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
    // ./dist/css/reader.css?v=abc → ./dist/css/reader-legacy.css (drop main-bundle hash so we do not bind the wrong file)
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




