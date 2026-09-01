// Reader page React entry point. Default react-pdf engine (ReaderAppReactPdf);
// ?engine=legacy falls back to imperative js/reader mount (use-reader-boot).
// Build artifacts dist/reader.bundle.js（scripts/build-js-bundle.mjs）。

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { ReaderApp } from "./ReaderApp.jsx";

bootTheme();
// Block accidental touches during session switch lockout; clear any residual fullscreen pointer overlay
clearReaderAiNavigationLock();
installReaderWindowOpenGuard();

// Sync before render body class: CSS :has()/body-class driving rules (reader-page.css) depend on them.
// Homepage now redirects to standalone. reader.htmlno longer using iframe Embed.
// If legacy bookmarks remain/Test starting with iframe Open, keep embedded class Compatible.
function syncReaderBodyClasses(body = document.body) {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

// Transition fallback: During probe validation, reader.html only changes <script> entry; old static skeleton remains in body.
// Clear then mount React tree; avoid duplicate DOM sets (duplicate id/Fixed layer) overlay.
// After cutover(2b), body contains only scripts and #reader-root; this step becomes a no-op.
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
* Legacy drawer/selection/AI styles extracted to dist/css/reader-legacy.css.
* Default react-pdf does not load; only inject at runtime via ?engine=legacy.
 * Align relative paths. reader.html Existing reader.css linkSame directory.
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
    // ./dist/css/reader.css?v=abc → ./dist/css/reader-legacy.cssMain package removed. hashAvoid misbinding
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
