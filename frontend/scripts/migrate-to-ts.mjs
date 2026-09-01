#!/usr/bin/env node
// One-time mechanical migration: .js → .ts, .jsx → .tsx under src, skip existing .ts/.tsx
// import paths still written as .js/.jsx, mapped to .ts/.tsx by esbuild/test loader.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "../src");

const SKIP_DIRS = new Set(["node_modules", "dist"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(srcRoot);
let renamed = 0;

for (const file of files) {
  let to = null;
  if (file.endsWith(".jsx")) {
    to = file.slice(0, -".jsx".length) + ".tsx";
  } else if (file.endsWith(".js") && !file.endsWith(".min.js")) {
    to = file.slice(0, -".js".length) + ".ts";
  }
  if (!to || fs.existsSync(to)) continue;
  fs.renameSync(file, to);
  renamed += 1;
}

console.log(`renamed ${renamed} files under src/`);
