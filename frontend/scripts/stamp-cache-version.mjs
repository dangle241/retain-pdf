// Provide three pages. HTML referenced in CSS / *.bundle.js Content-hashed ?v= Cache string.
//
// CSS Split by page:
//   index  → dist/css/home.css
//   detail → dist/css/detail.css
//   reader → dist/css/reader.css
// （styles.css Only for home Compatibility shim; generally unused. HTML Quote.
//
// Correct: after building artifacts, write per-resource content hash. ?v= — content unchanged → URL unchanged
// (Cache hit.), content changes → URL changes (force origin fetch).

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// per page HTML referenced resources (relative to frontend root), stamp will ?v= on href/src
// Rewrite to corresponding file content hash.
const PAGES = [
  { html: "index.html", assets: ["dist/css/home.css", "dist/app.bundle.js"] },
  { html: "detail.html", assets: ["dist/css/detail.css", "dist/detail.bundle.js"] },
  { html: "reader.html", assets: ["dist/css/reader.css", "dist/reader.bundle.js"] },
];

function contentHash(absPath) {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

// unify HTML references to a certain asset (href/src="./asset" or "./asset?v=old value")
// Rewrite to "./asset?v=". Dots and slashes in asset need escaping for regex.
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

console.log([stamp-cache-version] Updated resource cache strings for ${changed} HTML files);
